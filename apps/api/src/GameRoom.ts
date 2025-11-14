import {createActor, type AnyActorRef} from 'xstate'
import type {GamePhase} from '@repo/state'
import {
	lobbyMachine,
	setupMachine,
	playingMachine,
	type SetupInput,
	type PlayingInput,
} from '@repo/state'
import type {
	ClientMessage,
	ServerMessage,
	PlayerInfo,
	StoredEvent,
} from './types'

type GameEvent = {type: string; [key: string]: unknown}

// TODO: Hard to test without Vitest v4 support:
// https://github.com/cloudflare/workers-sdk/issues/11064
export class GameRoom implements DurableObject {
	private currentPhase: GamePhase = 'lobby'
	private currentActor: AnyActorRef | null = null
	private players: Map<WebSocket, PlayerInfo> = new Map()

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

			if (data.type === 'JOIN_GAME') {
				playerInfo = {
					playerId: data.playerId,
					playerName: data.playerName,
					roomId: this.ctx.id.toString(),
					joinedAt: performance.now(),
				}

				this.players.set(ws, playerInfo)
				ws.serializeAttachment({...playerInfo})

				await this.storeEvent({
					type: data.type,
					playerId: playerInfo.playerId,
					data: JSON.stringify(data),
					timestamp: performance.now(),
				})

				this.broadcast({
					type: 'PLAYER_JOINED',
					playerId: playerInfo.playerId,
					playerName: playerInfo.playerName,
				})

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

			await this.storeEvent({
				type: data.type,
				playerId: playerInfo.playerId,
				data: JSON.stringify(data),
				timestamp: performance.now(),
			})

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

			await this.storeEvent({
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
			CREATE TABLE IF NOT EXISTS game_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				type TEXT NOT NULL,
				playerId TEXT,
				data TEXT NOT NULL,
				timestamp REAL NOT NULL
			)
		`)

		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS game_metadata (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
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
		const phaseResult = this.ctx.storage.sql
			.exec<{
				value: string
			}>(`SELECT value FROM game_metadata WHERE key = 'phase'`)
			.one()

		if (!phaseResult) {
			this.currentPhase = 'lobby'
			this.currentActor = createActor(lobbyMachine)
			this.currentActor.start()

			this.ctx.storage.sql.exec(
				`INSERT INTO game_metadata (key, value) VALUES ('phase', 'lobby')`,
			)

			this.subscribeToStateChanges()
		} else {
			this.currentPhase = phaseResult.value as GamePhase
			await this.replayEvents()
		}
	}

	private async replayEvents() {
		const events = this.ctx.storage.sql
			.exec<StoredEvent>(
				`
			SELECT * FROM game_events ORDER BY id ASC
		`,
			)
			.toArray()

		if (events.length === 0) {
			this.currentActor = createActor(lobbyMachine)
			this.currentActor.start()
			this.subscribeToStateChanges()
			return
		}

		let lobbyContext: SetupInput | null = null
		let setupContext: PlayingInput | null = null

		for (const event of events) {
			const parsedData = JSON.parse(event.data) as ClientMessage

			if (this.currentPhase === 'lobby') {
				if (!this.currentActor) {
					this.currentActor = createActor(lobbyMachine)
					this.currentActor.start()
				}

				if (parsedData.type === 'START_GAME') {
					lobbyContext = this.currentActor.getSnapshot().context as SetupInput
					this.currentPhase = 'setup'
				} else {
					this.currentActor.send(parsedData as GameEvent)
				}
			} else if (this.currentPhase === 'setup') {
				if (!this.currentActor && lobbyContext) {
					this.currentActor = createActor(setupMachine, {
						input: lobbyContext,
					})
					this.currentActor.start()
				}

				if (parsedData.type === 'TURN_STARTED') {
					if (this.currentActor) {
						setupContext = this.currentActor.getSnapshot()
							.context as PlayingInput
					}
					this.currentPhase = 'playing'
				} else if (this.currentActor) {
					this.currentActor.send(parsedData as GameEvent)
				}
			} else if (this.currentPhase === 'playing') {
				if (!this.currentActor && setupContext) {
					this.currentActor = createActor(playingMachine, {
						input: setupContext,
					})
					this.currentActor.start()
				}

				if (this.currentActor) {
					this.currentActor.send(parsedData as GameEvent)
				}
			}
		}

		this.subscribeToStateChanges()
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

		if (event.type === 'START_GAME' && this.currentPhase === 'lobby') {
			const lobbyContext = this.currentActor.getSnapshot().context as SetupInput

			this.currentActor.send({type: 'START_GAME'} as GameEvent)

			await new Promise((resolve) => setTimeout(resolve, 0))

			this.currentActor = createActor(setupMachine, {
				input: lobbyContext,
			})
			this.currentActor.start()
			this.currentPhase = 'setup'

			this.ctx.storage.sql.exec(
				`UPDATE game_metadata SET value = 'setup' WHERE key = 'phase'`,
			)

			this.subscribeToStateChanges()

			await this.storeTelemetryEvent({
				type: 'PHASE_TRANSITION',
				playerId: playerInfo.playerId,
				data: JSON.stringify({from: 'lobby', to: 'setup'}),
				timestamp: performance.now(),
			})
		} else if (event.type === 'TURN_STARTED' && this.currentPhase === 'setup') {
			const setupContext = this.currentActor.getSnapshot()
				.context as PlayingInput

			this.currentActor.send({type: 'TURN_STARTED'} as GameEvent)

			await new Promise((resolve) => setTimeout(resolve, 0))

			this.currentActor = createActor(playingMachine, {
				input: setupContext,
			})
			this.currentActor.start()
			this.currentPhase = 'playing'

			this.ctx.storage.sql.exec(
				`UPDATE game_metadata SET value = 'playing' WHERE key = 'phase'`,
			)

			this.subscribeToStateChanges()

			await this.storeTelemetryEvent({
				type: 'PHASE_TRANSITION',
				playerId: playerInfo.playerId,
				data: JSON.stringify({from: 'setup', to: 'playing'}),
				timestamp: performance.now(),
			})
		} else if (
			event.type === 'REQUEST_AUTO_PLAY' &&
			this.currentPhase === 'playing'
		) {
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
				this.currentActor.send({
					type: 'CHOOSE_CARD',
					cardId: validCard.id,
				} as GameEvent)

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
				this.currentActor.send({type: 'SPIN_WHEEL', force} as GameEvent)

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
				this.currentActor.send({type: 'SURRENDER'} as GameEvent)

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
			this.currentActor.send(event as GameEvent)
		}
	}

	private broadcast(message: ServerMessage, exclude?: WebSocket) {
		const messageStr = JSON.stringify(message)

		for (const ws of this.ctx.getWebSockets()) {
			if (ws !== exclude) {
				ws.send(messageStr)
			}
		}
	}

	private async storeEvent(event: Omit<StoredEvent, 'id'>) {
		this.ctx.storage.sql.exec(
			`INSERT INTO game_events (type, playerId, data, timestamp) VALUES (?, ?, ?, ?)`,
			event.type,
			event.playerId,
			event.data,
			event.timestamp,
		)
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
}
