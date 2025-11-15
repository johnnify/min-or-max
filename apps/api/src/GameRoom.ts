import {createActor, type AnyActorRef} from 'xstate'
import type {GamePhase, GameEvent} from '@repo/state'
import {lobbyMachine, setupMachine, playingMachine} from '@repo/state'
import type {
	ClientMessage,
	ServerMessage,
	PlayerInfo,
	StoredEvent,
} from './types'
import {canPlayerSendEvent} from './orchestrator/validation'
import {getNextPhase, createTransitionInput} from './orchestrator/transitions'

// TODO: Hard to test without Vitest v4 support:
// https://github.com/cloudflare/workers-sdk/issues/11064
export class GameRoom implements DurableObject {
	private currentPhase: GamePhase = 'lobby'
	private currentActor: AnyActorRef | null = null
	private players: Map<WebSocket, PlayerInfo> = new Map()
	private playerRegistry: Map<string, PlayerInfo> = new Map()

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

		this.ctx.acceptWebSocket(server)

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
				ws.serializeAttachment({...playerInfo})

				if (!existingPlayer) {
					this.ctx.storage.sql.exec(
						`INSERT OR REPLACE INTO player_registry (player_id, player_name, joined_at) VALUES (?, ?, ?)`,
						playerInfo.playerId,
						playerInfo.playerName,
						playerInfo.joinedAt,
					)

					if (this.currentActor && this.currentPhase === 'lobby') {
						this.currentActor.send({
							type: 'PLAYER_JOINED',
							playerId: playerInfo.playerId,
							playerName: playerInfo.playerName,
						} as GameEvent)
					}

					this.broadcast({
						type: 'PLAYER_JOINED',
						playerId: playerInfo.playerId,
						playerName: playerInfo.playerName,
					})
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
							type: 'STATE_UPDATE',
							phase: this.currentPhase,
							state: snapshot,
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

	async webSocketError(ws: WebSocket, error: unknown) {
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
		const phaseResults = this.ctx.storage.sql
			.exec<{
				value: string
			}>(`SELECT value FROM game_state WHERE key = 'phase'`)
			.toArray()

		const snapshotResults = this.ctx.storage.sql
			.exec<{
				value: string
			}>(`SELECT value FROM game_state WHERE key = 'snapshot'`)
			.toArray()

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

		if (phaseResults.length === 0) {
			this.currentPhase = 'lobby'
			this.currentActor = createActor(lobbyMachine)
			this.subscribeToStateChanges()
			this.currentActor.start()

			await this.saveState()
		} else {
			this.currentPhase = phaseResults[0].value as GamePhase
			const snapshot =
				snapshotResults.length > 0 ? JSON.parse(snapshotResults[0].value) : null

			if (this.currentPhase === 'lobby') {
				this.currentActor = createActor(lobbyMachine)
			} else if (this.currentPhase === 'setup') {
				this.currentActor = createActor(setupMachine, {input: snapshot})
			} else if (this.currentPhase === 'playing') {
				this.currentActor = createActor(playingMachine, {input: snapshot})
			}

			this.subscribeToStateChanges()
			this.currentActor?.start()
		}
	}

	private subscribeToStateChanges() {
		if (!this.currentActor) return

		this.currentActor.subscribe((state) => {
			this.onStateChange(state)
		})
	}

	private onStateChange(state: unknown) {
		this.broadcast({
			type: 'STATE_UPDATE',
			phase: this.currentPhase,
			state,
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

			if (currentPlayer.id !== playerInfo.playerId) {
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
				const force = 0.5
				gameEvent = {type: 'SPIN_WHEEL', force}

				this.broadcast({
					type: 'AUTO_SPIN',
					force,
				})

				await this.storeTelemetryEvent({
					type: 'AUTO_SPIN',
					playerId: playerInfo.playerId,
					data: JSON.stringify({force}),
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
		} else {
			gameEvent = event as GameEvent
		}

		const snapshot = this.currentActor.getSnapshot()
		const validation = canPlayerSendEvent(
			snapshot,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			gameEvent as any,
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

		this.currentActor.send(gameEvent)

		await this.checkAndHandleTransition(playerInfo)
		await this.saveState()
	}

	private async checkAndHandleTransition(playerInfo: PlayerInfo) {
		if (!this.currentActor) return

		const snapshot = this.currentActor.getSnapshot()
		const nextPhase = getNextPhase(snapshot)

		if (!nextPhase || nextPhase === this.currentPhase) return

		if (nextPhase === 'setup') {
			const input = createTransitionInput('setup', snapshot)
			if (!input) return

			if ('deck' in input) {
				this.currentPhase = 'setup'
				this.currentActor = createActor(setupMachine, {input})
				this.subscribeToStateChanges()
				this.currentActor.start()

				await this.storeTelemetryEvent({
					type: 'PHASE_TRANSITION',
					playerId: playerInfo.playerId,
					data: JSON.stringify({from: 'lobby', to: 'setup'}),
					timestamp: performance.now(),
				})

				this.currentActor.send({type: 'PILE_SHUFFLED'})
				this.currentActor.send({type: 'CARDS_DEALT'})
				this.currentActor.send({type: 'THRESHOLDS_SET'})
				this.currentActor.send({type: 'WHEEL_SPUN', force: 0.8})
				this.currentActor.send({type: 'FIRST_CARD_PLAYED'})

				await this.checkAndHandleTransition(playerInfo)
			}
		} else if (nextPhase === 'playing') {
			const input = createTransitionInput('playing', snapshot)
			if (!input) return

			if ('drawPile' in input) {
				this.currentPhase = 'playing'
				this.currentActor = createActor(playingMachine, {input})
				this.subscribeToStateChanges()
				this.currentActor.start()

				await this.storeTelemetryEvent({
					type: 'PHASE_TRANSITION',
					playerId: playerInfo.playerId,
					data: JSON.stringify({from: 'setup', to: 'playing'}),
					timestamp: performance.now(),
				})
			}
		} else if (nextPhase === 'gameOver') {
			this.currentPhase = 'gameOver'

			await this.storeTelemetryEvent({
				type: 'PHASE_TRANSITION',
				playerId: playerInfo.playerId,
				data: JSON.stringify({from: 'playing', to: 'gameOver'}),
				timestamp: performance.now(),
			})
		}

		await this.saveState()
	}

	private async saveState() {
		if (!this.currentActor) return

		const snapshot = this.currentActor.getSnapshot()
		const snapshotJson = JSON.stringify(snapshot.context)
		const timestamp = performance.now()

		this.ctx.storage.sql.exec(
			`INSERT OR REPLACE INTO game_state (key, value, updated_at) VALUES (?, ?, ?)`,
			'phase',
			this.currentPhase,
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
		this.currentPhase = 'lobby'
		this.currentActor = createActor(lobbyMachine)
		this.subscribeToStateChanges()
		this.currentActor.start()

		const registeredPlayers = Array.from(this.playerRegistry.values())
		for (const player of registeredPlayers) {
			this.currentActor.send({
				type: 'PLAYER_JOINED',
				playerId: player.playerId,
				playerName: player.playerName,
			})
			this.currentActor.send({
				type: 'PLAYER_READY',
				playerId: player.playerId,
			})
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
