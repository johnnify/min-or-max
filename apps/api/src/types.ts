export type PlayerInfo = {
	playerId: string
	playerName: string
	roomId: string
	joinedAt: number
}

export type StoredEvent = {
	id?: number
	type: string
	playerId: string | null
	data: string
	timestamp: number
}
