import {createActor} from 'xstate'
import type {
	GameEvent,
	MinOrMaxActor,
	MinOrMaxSnapshot,
	ClientMessage,
	ServerMessage,
} from '@repo/state'
import {getPhaseFromState, minOrMaxMachine, calculateSpin} from '@repo/state'
import type {Rng} from '@repo/rng'
import type {PlayerInfo, StoredEvent} from './types'
import {canPlayerSendEvent} from './orchestrator/validation'

// TODO: Hard to test without Vitest v4 support:
// https://github.com/cloudflare/workers-sdk/issues/11064
export class GameRoom implements DurableObject {
	private currentActor: MinOrMaxActor | null = null
	private players: Map<WebSocket, PlayerInfo> = new Map()
	private playerRegistry: Map<string, PlayerInfo> = new Map()
	private eventCounter = 0
	private lastPlayerIndex = -1

	constructor(private ctx: DurableObjectState) {
		void this.ctx.blockConcurrencyWhile(async () => {
			await this.initializeTables()
			await this.restoreState()
		})
	}

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade')
		if (upgradeHeader !== 'websocket') {
			return new Response('Expected WebSocket', {status: 426})
		}

		const {0: client, 1: server} = new WebSocketPair()

		const url = new URL(request.url)
		const seed = url.searchParams.get('seed')

		this.ctx.acceptWebSocket(server)

		if (seed) {
			server.serializeAttachment({seed})
		}

		return new Response(null, {
			status: 101,
			webSocket: client,
		})
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		try {
			const data = JSON.parse(message as string) as ClientMessage

			let playerInfo = this.players.get(ws)
			if (!playerInfo) {
				playerInfo = ws.deserializeAttachment() as PlayerInfo
				if (playerInfo) {
					this.players.set(ws, playerInfo)
				}
			}

			if (data.type === 'PLAY_AGAIN') {
				await this.resetToLobby()
				return
			}

			if (data.type === 'JOIN_GAME') {
				const existingPlayer = this.playerRegistry.get(data.playerId)

				playerInfo = existingPlayer || {
					playerId: data.playerId,
					playerName: data.playerName,
					roomId: this.ctx.id.toString(),
					joinedAt: performance.now(),
				}

				this.players.set(ws, playerInfo)
				this.playerRegistry.set(data.playerId, playerInfo)
				// Preserve seed from initial connection if present
				const attachment = ws.deserializeAttachment() as {seed?: string} | null
				const seed = attachment?.seed
				ws.serializeAttachment({...playerInfo, ...(seed && {seed})})

				if (!existingPlayer) {
					this.ctx.storage.sql.exec(
						`INSERT OR REPLACE INTO player_registry (player_id, player_name, joined_at) VALUES (?, ?, ?)`,
						playerInfo.playerId,
						playerInfo.playerName,
						playerInfo.joinedAt,
					)

					if (this.currentActor) {
						const currentPhase = getPhaseFromState(
							this.currentActor.getSnapshot().value,
						)
						if (currentPhase === 'lobby') {
							const joinEvent: GameEvent = {
								type: 'PLAYER_JOINED',
								playerId: playerInfo.playerId,
								playerName: playerInfo.playerName,
							}
							this.broadcastEvent(joinEvent)
							this.currentActor.send(joinEvent)

							// Send seed if present
							if (seed) {
								const seedEvent: GameEvent = {
									type: 'SEED',
									seed,
								}
								this.broadcastEvent(seedEvent)
								this.currentActor.send(seedEvent)
							}
						}
					}
				}

				ws.send(
					JSON.stringify({
						type: 'CONNECTED',
						playerId: playerInfo.playerId,
					} satisfies ServerMessage),
				)

				if (this.currentActor) {
					const snapshot = this.currentActor.getSnapshot()
					ws.send(
						JSON.stringify({
							type: 'STATE_SNAPSHOT',
							state: snapshot,
							sequenceId: this.eventCounter,
						} satisfies ServerMessage),
					)
				}

				return
			}

			if (!playerInfo) {
				ws.send(
					JSON.stringify({
						type: 'ERROR',
						message: 'Not authenticated. Send JOIN_GAME first.',
					} satisfies ServerMessage),
				)
				return
			}

			await this.handleEvent(data, playerInfo)
		} catch (error) {
			console.error('Error handling WebSocket message:', error)
			ws.send(
				JSON.stringify({
					type: 'ERROR',
					message: 'Failed to process message',
				} satisfies ServerMessage),
			)
		}
	}

	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean,
	) {
		const playerInfo = this.players.get(ws)
		if (playerInfo) {
			this.players.delete(ws)

			await this.storeTelemetryEvent({
				type: 'PLAYER_DISCONNECTED',
				playerId: playerInfo.playerId,
				data: JSON.stringify({code, reason, wasClean}),
				timestamp: performance.now(),
			})

			this.broadcast({
				type: 'PLAYER_LEFT',
				playerId: playerInfo.playerId,
			})
		}
	}

	async webSocketError(_ws: WebSocket, error: unknown) {
		console.error('WebSocket error:', error)
	}

	private async initializeTables() {
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS game_state (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at REAL NOT NULL
			)
		`)

		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS player_registry (
				player_id TEXT PRIMARY KEY,
				player_name TEXT NOT NULL,
				joined_at REAL NOT NULL
			)
		`)

		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS telemetry_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				type TEXT NOT NULL,
				playerId TEXT,
				data TEXT NOT NULL,
				timestamp REAL NOT NULL
			)
		`)
	}

	private async restoreState() {
		const playersResults = this.ctx.storage.sql
			.exec<{
				player_id: string
				player_name: string
				joined_at: number
			}>(`SELECT * FROM player_registry`)
			.toArray()

		for (const player of playersResults) {
			this.playerRegistry.set(player.player_id, {
				playerId: player.player_id,
				playerName: player.player_name,
				roomId: this.ctx.id.toString(),
				joinedAt: player.joined_at,
			})
		}

		this.currentActor = createActor(minOrMaxMachine)
		this.currentActor.subscribe((state) => {
			this.onStateChange(state)
		})
		this.currentActor.start()

		await this.saveState()
	}

	private onStateChange(snapshot: MinOrMaxSnapshot) {
		if (!this.currentActor) return

		// Check for turn change to broadcast snapshot
		const context = snapshot.context
		const newPlayerIndex = context.currentPlayerIndex ?? -1

		if (this.lastPlayerIndex !== newPlayerIndex && newPlayerIndex >= 0) {
			// Turn changed! Broadcast snapshot
			this.broadcast({
				type: 'STATE_SNAPSHOT',
				state: snapshot,
				sequenceId: this.eventCounter,
			})
			this.lastPlayerIndex = newPlayerIndex
		}
	}

	private broadcastEvent(event: GameEvent) {
		this.broadcast({
			type: 'GAME_EVENT',
			event,
			sequenceId: this.eventCounter++,
		})
	}

	private async handleEvent(event: ClientMessage, playerInfo: PlayerInfo) {
		if (!this.currentActor) return

		let gameEvent: GameEvent

		if (event.type === 'READY') {
			gameEvent = {
				type: 'PLAYER_READY',
				playerId: playerInfo.playerId,
			}
		} else if (event.type === 'START_GAME') {
			gameEvent = {type: 'START_GAME'}
		} else if (event.type === 'REQUEST_AUTO_PLAY') {
			const snapshot = this.currentActor.getSnapshot()
			const context = snapshot.context as {
				currentPlayerIndex: number
				players: Array<{id: string; hand: Array<{id: string}>}>
				hasSpunThisTurn: boolean
			}

			const currentPlayer = context.players[context.currentPlayerIndex]

			if (!currentPlayer || currentPlayer.id !== playerInfo.playerId) {
				return
			}

			const validCard = currentPlayer.hand[0]

			if (validCard) {
				gameEvent = {
					type: 'CHOOSE_CARD',
					cardId: validCard.id,
				}

				this.broadcast({
					type: 'AUTO_PLAY',
					cardId: validCard.id,
				})

				await this.storeTelemetryEvent({
					type: 'AUTO_PLAY',
					playerId: playerInfo.playerId,
					data: JSON.stringify({cardId: validCard.id}),
					timestamp: performance.now(),
				})
			} else if (!context.hasSpunThisTurn) {
				const autoSnapshot = this.currentActor.getSnapshot()
				const autoContext = autoSnapshot.context as {
					wheelAngle: number
					rng: Rng
				}
				const spinDegrees = calculateSpin(0.5, autoContext.rng)
				const newAngle = autoContext.wheelAngle + spinDegrees

				gameEvent = {type: 'WHEEL_SPUN', angle: newAngle}

				this.broadcast({
					type: 'AUTO_WHEEL_SPUN',
					angle: newAngle,
				})

				await this.storeTelemetryEvent({
					type: 'AUTO_WHEEL_SPUN',
					playerId: playerInfo.playerId,
					data: JSON.stringify({angle: newAngle}),
					timestamp: performance.now(),
				})
			} else {
				gameEvent = {type: 'SURRENDER'}

				this.broadcast({
					type: 'PLAYER_SURRENDERED',
					playerId: playerInfo.playerId,
				})

				await this.storeTelemetryEvent({
					type: 'PLAYER_SURRENDERED',
					playerId: playerInfo.playerId,
					data: JSON.stringify({}),
					timestamp: performance.now(),
				})
			}
		} else if (event.type === 'REQUEST_WHEEL_SPIN') {
			const spinSnapshot = this.currentActor.getSnapshot()
			const spinContext = spinSnapshot.context as {
				wheelAngle: number
				rng: Rng
			}
			const spinDegrees = calculateSpin(event.force, spinContext.rng)
			const wheelSpunAngle = spinContext.wheelAngle + spinDegrees

			gameEvent = {type: 'WHEEL_SPUN', angle: wheelSpunAngle}
		} else {
			gameEvent = event as GameEvent
		}

		const snapshot = this.currentActor.getSnapshot()
		const validation = canPlayerSendEvent(
			snapshot,
			gameEvent,
			playerInfo.playerId,
		)

		if (!validation.allowed) {
			await this.storeTelemetryEvent({
				type: 'EVENT_REJECTED',
				playerId: playerInfo.playerId,
				data: JSON.stringify({event: gameEvent, reason: validation.reason}),
				timestamp: performance.now(),
			})
			return
		}

		// Broadcast the event to all clients
		this.broadcastEvent(gameEvent)
		this.currentActor.send(gameEvent)

		await this.checkAndHandleTransition(playerInfo)
		await this.saveState()
	}

	private async checkAndHandleTransition(playerInfo: PlayerInfo) {
		if (!this.currentActor) return

		const snapshot = this.currentActor.getSnapshot()
		const currentPhase = getPhaseFromState(snapshot.value)

		if (currentPhase === 'setup') {
			const stateValue = snapshot.value
			if (
				typeof stateValue === 'object' &&
				stateValue !== null &&
				'setup' in stateValue &&
				stateValue.setup === 'shufflingPile'
			) {
				await this.storeTelemetryEvent({
					type: 'PHASE_TRANSITION',
					playerId: playerInfo.playerId,
					data: JSON.stringify({from: 'lobby', to: 'setup'}),
					timestamp: performance.now(),
				})

				const setupSnapshot = this.currentActor.getSnapshot()
				const setupContext = setupSnapshot.context as {
					wheelAngle: number
					rng: Rng
				}
				const spinDegrees = calculateSpin(0.8, setupContext.rng)
				const setupAngle = setupContext.wheelAngle + spinDegrees
				const events: GameEvent[] = [
					{type: 'PILE_SHUFFLED'},
					{type: 'CARDS_DEALT'},
					{type: 'THRESHOLDS_SET'},
					{type: 'WHEEL_SPUN', angle: setupAngle},
					{type: 'FIRST_CARD_PLAYED'},
				]

				for (const event of events) {
					this.broadcastEvent(event)
					this.currentActor.send(event)
				}

				// Broadcast snapshot after setup completion
				const finalSnapshot = this.currentActor.getSnapshot()
				this.broadcast({
					type: 'STATE_SNAPSHOT',
					state: finalSnapshot,
					sequenceId: this.eventCounter,
				})
			}
		}

		await this.saveState()
	}

	private async saveState() {
		if (!this.currentActor) return

		const snapshot = this.currentActor.getSnapshot()
		const currentPhase = getPhaseFromState(snapshot.value)
		const snapshotJson = JSON.stringify(snapshot.context)
		const timestamp = performance.now()

		this.ctx.storage.sql.exec(
			`INSERT OR REPLACE INTO game_state (key, value, updated_at) VALUES (?, ?, ?)`,
			'phase',
			currentPhase,
			timestamp,
		)

		this.ctx.storage.sql.exec(
			`INSERT OR REPLACE INTO game_state (key, value, updated_at) VALUES (?, ?, ?)`,
			'snapshot',
			snapshotJson,
			timestamp,
		)
	}

	private broadcast(message: ServerMessage, exclude?: WebSocket) {
		const messageStr = JSON.stringify(message)

		for (const ws of this.ctx.getWebSockets()) {
			if (ws !== exclude) {
				ws.send(messageStr)
			}
		}
	}

	private async storeTelemetryEvent(event: Omit<StoredEvent, 'id'>) {
		this.ctx.storage.sql.exec(
			`INSERT INTO telemetry_events (type, playerId, data, timestamp) VALUES (?, ?, ?, ?)`,
			event.type,
			event.playerId,
			event.data,
			event.timestamp,
		)
	}

	private async resetToLobby() {
		if (!this.currentActor) return

		const playAgainEvent: GameEvent = {type: 'PLAY_AGAIN'}
		this.broadcastEvent(playAgainEvent)
		this.currentActor.send(playAgainEvent)

		const registeredPlayers = Array.from(this.playerRegistry.values())
		for (const player of registeredPlayers) {
			const joinEvent: GameEvent = {
				type: 'PLAYER_JOINED',
				playerId: player.playerId,
				playerName: player.playerName,
			}
			this.broadcastEvent(joinEvent)
			this.currentActor.send(joinEvent)

			const readyEvent: GameEvent = {
				type: 'PLAYER_READY',
				playerId: player.playerId,
			}
			this.broadcastEvent(readyEvent)
			this.currentActor.send(readyEvent)
		}

		await this.saveState()

		await this.storeTelemetryEvent({
			type: 'GAME_RESET',
			playerId: null,
			data: JSON.stringify({playerCount: registeredPlayers.length}),
			timestamp: performance.now(),
		})
	}
}
