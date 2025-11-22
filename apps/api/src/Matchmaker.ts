import {Server} from 'partyserver'

type RoomInfo = {
	playerCount: number
	maxPlayers: number
	registeredAt: number
}

type RegisterRequest = {
	action: 'register' | 'unregister'
	roomId: string
	playerCount?: number
	maxPlayers?: number
}

export const ROOM_CODE_CHARS = '23456789JQKA'
export const ROOM_CODE_LENGTH = 6

export const generateRoomCode = (): string => {
	let code = ''
	for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
		code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
	}
	return code
}

export const isLegitRoomCode = (roomId: string): boolean => {
	if (roomId.length !== ROOM_CODE_LENGTH) return false
	for (const char of roomId) {
		if (!ROOM_CODE_CHARS.includes(char)) return false
	}
	return true
}

export class Matchmaker extends Server<Env> {
	private availableRooms: Map<string, RoomInfo> | null = null
	private tablesInitialized = false

	async onStart() {
		this.ensureTables()
	}

	private ensureTables() {
		if (this.tablesInitialized) return

		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS available_rooms (
				room_id TEXT PRIMARY KEY,
				player_count INTEGER NOT NULL,
				max_players INTEGER NOT NULL,
				registered_at REAL NOT NULL
			)
		`)

		this.tablesInitialized = true
	}

	private async ensureState() {
		if (this.availableRooms) return

		this.ensureTables()

		this.availableRooms = new Map()
		const rows = this.ctx.storage.sql
			.exec<{
				room_id: string
				player_count: number
				max_players: number
				registered_at: number
			}>(`SELECT * FROM available_rooms`)
			.toArray()

		for (const row of rows) {
			this.availableRooms.set(row.room_id, {
				playerCount: row.player_count,
				maxPlayers: row.max_players,
				registeredAt: row.registered_at,
			})
		}
	}

	async onRequest(request: Request): Promise<Response> {
		await this.ensureState()

		const url = new URL(request.url)

		if (url.pathname.endsWith('/register') && request.method === 'POST') {
			return this.handleRegister(request)
		}

		if (request.method === 'POST') {
			return this.handleQuickPlay()
		}

		return new Response('Method not allowed', {status: 405})
	}

	private async handleRegister(request: Request): Promise<Response> {
		const body = (await request.json()) as RegisterRequest

		if (body.action === 'register') {
			this.registerRoom(
				body.roomId,
				body.playerCount ?? 0,
				body.maxPlayers ?? 4,
			)
		} else if (body.action === 'unregister') {
			this.unregisterRoom(body.roomId)
		}

		return new Response('OK', {status: 200})
	}

	private handleQuickPlay(): Response {
		const roomId = this.findOrCreateRoom()
		return Response.json({roomId})
	}

	private findOrCreateRoom(): string {
		if (!this.availableRooms) {
			return generateRoomCode()
		}

		for (const [roomId, info] of this.availableRooms) {
			if (info.playerCount < info.maxPlayers) {
				return roomId
			}
		}

		return generateRoomCode()
	}

	private registerRoom(
		roomId: string,
		playerCount: number,
		maxPlayers: number,
	) {
		if (!this.availableRooms || !isLegitRoomCode(roomId)) return

		const now = performance.now()

		this.availableRooms.set(roomId, {
			playerCount,
			maxPlayers,
			registeredAt: now,
		})

		this.ctx.storage.sql.exec(
			`INSERT OR REPLACE INTO available_rooms (room_id, player_count, max_players, registered_at) VALUES (?, ?, ?, ?)`,
			roomId,
			playerCount,
			maxPlayers,
			now,
		)
	}

	private unregisterRoom(roomId: string) {
		if (!this.availableRooms) return

		this.availableRooms.delete(roomId)

		this.ctx.storage.sql.exec(
			`DELETE FROM available_rooms WHERE room_id = ?`,
			roomId,
		)
	}
}
