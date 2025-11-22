import {Server, type Connection, type ConnectionContext} from 'partyserver'
import {createActor} from 'xstate'
import type {
	GameEvent,
	MinOrMaxActor,
	MinOrMaxSnapshot,
	ClientMessage,
	ServerMessage,
} from '@repo/state'
import {
	getPhaseFromState,
	minOrMaxMachine,
	calculateSpin,
	determineAutoPlayAction,
} from '@repo/state'
import {Rng} from '@repo/rng'
import type {PlayerInfo, StoredEvent} from './types'
import {canPlayerSendEvent} from './orchestrator/validation'
import {getServerByName} from 'partyserver'
import type {Matchmaker} from './Matchmaker'

type ConnectionState = PlayerInfo & {seed?: string}

export class GameRoom extends Server<Env> {
	static options = {hibernate: true}

	private currentActor: MinOrMaxActor | null = null
	private playerRegistry: Map<string, PlayerInfo> | null = null
	private eventCounter: number | null = null
	private lastPlayerIndex: number | null = null
	private tablesInitialized = false

	async onStart() {
		this.ensureTables()
	}

	async onConnect(connection: Connection, ctx: ConnectionContext) {
		const url = new URL(ctx.request.url)
		const seed = url.searchParams.get('seed')

		if (seed) {
			connection.setState({seed})
		}
	}

	async onMessage(connection: Connection, message: string | ArrayBuffer) {
		try {
			await this.ensureState()
			const data = JSON.parse(message as string) as ClientMessage
			await this.handleClientMessage(data, connection)
		} catch (error) {
			console.error('Error handling message:', error)
			connection.send(
				JSON.stringify({
					type: 'ERROR',
					message: 'Failed to process message',
				} satisfies ServerMessage),
			)
		}
	}

	async onClose(connection: Connection) {
		const connectionState = connection.state as ConnectionState | null
		if (connectionState?.playerId) {
			this.storeTelemetryEvent({
				type: 'PLAYER_DISCONNECTED',
				playerId: connectionState.playerId,
				data: JSON.stringify({}),
				timestamp: performance.now(),
			})

			this.broadcast(
				JSON.stringify({
					type: 'PLAYER_LEFT',
					playerId: connectionState.playerId,
				} satisfies ServerMessage),
				[connection.id],
			)

			await this.handlePlayerDisconnect(connectionState.playerId)
		}
	}

	private async handlePlayerDisconnect(playerId: string) {
		await this.ensureState()
		if (!this.currentActor || !this.playerRegistry) return

		const currentPhase = getPhaseFromState(
			this.currentActor.getSnapshot().value,
		)
		if (currentPhase !== 'lobby') return

		this.playerRegistry.delete(playerId)
		this.ctx.storage.sql.exec(
			`DELETE FROM player_registry WHERE player_id = ?`,
			playerId,
		)

		const leaveEvent: GameEvent = {
			type: 'PLAYER_DROPPED',
			playerId,
		}
		this.broadcastEvent(leaveEvent)
		this.currentActor.send(leaveEvent)
		await this.saveState()

		const playerCount = this.currentActor.getSnapshot().context.players.length
		if (playerCount > 0) {
			await this.notifyMatchmaker('register', playerCount)
		} else {
			await this.notifyMatchmaker('unregister')
		}
	}

	onError(_connection: Connection, error: Error) {
		console.error('WebSocket error:', error)
	}

	private ensureTables() {
		if (this.tablesInitialized) return

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

		this.tablesInitialized = true
	}

	private async ensureState() {
		if (this.currentActor) return

		this.ensureTables()

		this.playerRegistry = new Map()
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
				roomId: this.name,
				joinedAt: player.joined_at,
			})
		}

		const counterRow = this.ctx.storage.sql
			.exec<{
				value: string
			}>(`SELECT value FROM game_state WHERE key = 'eventCounter'`)
			.toArray()[0]
		this.eventCounter = counterRow ? parseInt(counterRow.value, 10) : 0

		const playerIndexRow = this.ctx.storage.sql
			.exec<{
				value: string
			}>(`SELECT value FROM game_state WHERE key = 'lastPlayerIndex'`)
			.toArray()[0]
		this.lastPlayerIndex = playerIndexRow
			? parseInt(playerIndexRow.value, 10)
			: -1

		const snapshotRow = this.ctx.storage.sql
			.exec<{
				value: string
			}>(`SELECT value FROM game_state WHERE key = 'snapshot'`)
			.toArray()[0]

		if (snapshotRow) {
			const savedSnapshot = JSON.parse(snapshotRow.value) as MinOrMaxSnapshot

			if (savedSnapshot.context?.rng) {
				savedSnapshot.context.rng = Rng.fromJSON(savedSnapshot.context.rng)
				this.currentActor = createActor(minOrMaxMachine, {
					snapshot: savedSnapshot,
				})
			} else {
				this.currentActor = createActor(minOrMaxMachine)
			}
		} else {
			this.currentActor = createActor(minOrMaxMachine)
		}

		this.currentActor.start()
	}

	private getEventCounter(): number {
		return this.eventCounter ?? 0
	}

	private incrementEventCounter(): number {
		if (this.eventCounter === null) this.eventCounter = 0
		return this.eventCounter++
	}

	private getLastPlayerIndex(): number {
		return this.lastPlayerIndex ?? -1
	}

	private setLastPlayerIndex(index: number) {
		this.lastPlayerIndex = index
	}

	private async handleClientMessage(
		data: ClientMessage,
		connection: Connection,
	) {
		if (!this.currentActor || !this.playerRegistry) return

		let connectionState = connection.state as ConnectionState | null

		if (data.type === 'PLAY_AGAIN') {
			await this.resetToLobby()
			return
		}

		if (data.type === 'JOIN_GAME') {
			await this.clearRoomIfStale()

			const existingPlayer = this.playerRegistry.get(data.playerId)

			const currentPlayerInfo: PlayerInfo = existingPlayer ?? {
				playerId: data.playerId,
				playerName: data.playerName,
				roomId: this.name,
				joinedAt: performance.now(),
			}

			const seed = connectionState?.seed
			connection.setState({...currentPlayerInfo, ...(seed && {seed})})
			connectionState = connection.state as ConnectionState
			this.playerRegistry.set(data.playerId, currentPlayerInfo)

			const isInActorState = this.currentActor
				.getSnapshot()
				.context.players.some((p) => p.id === currentPlayerInfo.playerId)

			if (!existingPlayer) {
				this.ctx.storage.sql.exec(
					`INSERT OR REPLACE INTO player_registry (player_id, player_name, joined_at) VALUES (?, ?, ?)`,
					currentPlayerInfo.playerId,
					currentPlayerInfo.playerName,
					currentPlayerInfo.joinedAt,
				)
			}

			if (!isInActorState) {
				const currentPhase = getPhaseFromState(
					this.currentActor.getSnapshot().value,
				)
				if (currentPhase === 'lobby') {
					const joinEvent: GameEvent = {
						type: 'PLAYER_JOINED',
						playerId: currentPlayerInfo.playerId,
						playerName: currentPlayerInfo.playerName,
					}
					this.broadcastEvent(joinEvent)
					this.currentActor.send(joinEvent)

					if (seed) {
						const seedEvent: GameEvent = {
							type: 'SEED',
							seed,
						}
						this.broadcastEvent(seedEvent)
						this.currentActor.send(seedEvent)
					}

					await this.saveState()

					const playerCount =
						this.currentActor.getSnapshot().context.players.length
					await this.notifyMatchmaker('register', playerCount)
				}
			}

			connection.send(
				JSON.stringify({
					type: 'CONNECTED',
					playerId: currentPlayerInfo.playerId,
				} satisfies ServerMessage),
			)

			const snapshot = this.currentActor.getSnapshot()
			connection.send(
				JSON.stringify({
					type: 'STATE_SNAPSHOT',
					state: snapshot,
					sequenceId: this.getEventCounter(),
				} satisfies ServerMessage),
			)

			return
		}

		if (!connectionState?.playerId) {
			connection.send(
				JSON.stringify({
					type: 'ERROR',
					message: 'Not authenticated. Send JOIN_GAME first.',
				} satisfies ServerMessage),
			)
			return
		}

		await this.handleEvent(data, connectionState)
	}

	private broadcastEvent(event: GameEvent) {
		this.broadcast(
			JSON.stringify({
				type: 'GAME_EVENT',
				event,
				sequenceId: this.incrementEventCounter(),
			} satisfies ServerMessage),
		)
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
			const context = this.currentActor.getSnapshot().context
			const action = determineAutoPlayAction(context, playerInfo.playerId)

			if (!action) {
				return
			}

			if (action.type === 'play_card') {
				gameEvent = {type: 'CHOOSE_CARD', cardId: action.cardId}
			} else if (action.type === 'spin') {
				const spinDegrees = calculateSpin(0.5, context.rng)
				const newAngle = context.wheelAngle + spinDegrees
				gameEvent = {type: 'WHEEL_SPUN', angle: newAngle}
			} else {
				gameEvent = {type: 'END_TURN'}
			}

			this.storeTelemetryEvent({
				type: 'AUTO_PLAY',
				playerId: playerInfo.playerId,
				data: JSON.stringify({action}),
				timestamp: performance.now(),
			})
		} else if (event.type === 'REQUEST_WHEEL_SPIN') {
			const spinContext = this.currentActor.getSnapshot().context
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
			this.storeTelemetryEvent({
				type: 'EVENT_REJECTED',
				playerId: playerInfo.playerId,
				data: JSON.stringify({event: gameEvent, reason: validation.reason}),
				timestamp: performance.now(),
			})
			return
		}

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
				await this.notifyMatchmaker('unregister')

				this.storeTelemetryEvent({
					type: 'PHASE_TRANSITION',
					playerId: playerInfo.playerId,
					data: JSON.stringify({from: 'lobby', to: 'setup'}),
					timestamp: performance.now(),
				})

				const setupContext = this.currentActor.getSnapshot().context
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

				const finalSnapshot = this.currentActor.getSnapshot()
				this.broadcast(
					JSON.stringify({
						type: 'STATE_SNAPSHOT',
						state: finalSnapshot,
						sequenceId: this.getEventCounter(),
					} satisfies ServerMessage),
				)
			}
		}

		const newPlayerIndex = snapshot.context.currentPlayerIndex ?? -1
		if (this.getLastPlayerIndex() !== newPlayerIndex && newPlayerIndex >= 0) {
			this.broadcast(
				JSON.stringify({
					type: 'STATE_SNAPSHOT',
					state: this.currentActor.getSnapshot(),
					sequenceId: this.getEventCounter(),
				} satisfies ServerMessage),
			)
			this.setLastPlayerIndex(newPlayerIndex)
		}
	}

	private async saveState() {
		if (!this.currentActor) return

		const snapshot = this.currentActor.getSnapshot()
		const snapshotJson = JSON.stringify(snapshot)
		const timestamp = performance.now()

		this.ctx.storage.sql.exec(
			`INSERT OR REPLACE INTO game_state (key, value, updated_at) VALUES (?, ?, ?)`,
			'snapshot',
			snapshotJson,
			timestamp,
		)

		this.ctx.storage.sql.exec(
			`INSERT OR REPLACE INTO game_state (key, value, updated_at) VALUES (?, ?, ?)`,
			'eventCounter',
			String(this.getEventCounter()),
			timestamp,
		)

		this.ctx.storage.sql.exec(
			`INSERT OR REPLACE INTO game_state (key, value, updated_at) VALUES (?, ?, ?)`,
			'lastPlayerIndex',
			String(this.getLastPlayerIndex()),
			timestamp,
		)
	}

	private storeTelemetryEvent(event: Omit<StoredEvent, 'id'>) {
		this.ctx.storage.sql.exec(
			`INSERT INTO telemetry_events (type, playerId, data, timestamp) VALUES (?, ?, ?, ?)`,
			event.type,
			event.playerId,
			event.data,
			event.timestamp,
		)
	}

	private async notifyMatchmaker(
		action: 'register' | 'unregister',
		playerCount?: number,
	) {
		try {
			const matchmaker = await getServerByName(
				this.env.MATCHMAKER as unknown as DurableObjectNamespace<Matchmaker>,
				'singleton',
			)
			await matchmaker.fetch('https://matchmaker/register', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					action,
					roomId: this.name,
					playerCount,
					maxPlayers: 4,
				}),
			})
		} catch (error) {
			console.error('Failed to notify matchmaker:', error)
		}
	}

	private async resetToLobby() {
		if (!this.currentActor || !this.playerRegistry) return

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

		await this.notifyMatchmaker('register', registeredPlayers.length)

		this.storeTelemetryEvent({
			type: 'GAME_RESET',
			playerId: null,
			data: JSON.stringify({playerCount: registeredPlayers.length}),
			timestamp: performance.now(),
		})
	}

	private async clearRoomIfStale() {
		const activeConnections = [...this.getConnections()]
		const isOnlyConnection = activeConnections.length <= 1

		if (isOnlyConnection && this.currentActor) {
			const currentPhase = getPhaseFromState(
				this.currentActor.getSnapshot().value,
			)
			if (currentPhase !== 'lobby') {
				await this.clearRoom()
			}
		}
	}

	private async clearRoom() {
		this.ctx.storage.sql.exec(`DELETE FROM player_registry`)
		this.ctx.storage.sql.exec(`DELETE FROM game_state`)

		if (this.playerRegistry) {
			this.playerRegistry.clear()
		}
		this.eventCounter = 0
		this.lastPlayerIndex = -1

		if (this.currentActor) {
			this.currentActor.stop()
		}
		this.currentActor = createActor(minOrMaxMachine)
		this.currentActor.start()

		await this.notifyMatchmaker('unregister')

		this.storeTelemetryEvent({
			type: 'ROOM_CLEARED',
			playerId: null,
			data: JSON.stringify({reason: 'stale_room'}),
			timestamp: performance.now(),
		})
	}
}
