import type {GameEvent, MinOrMaxSnapshot} from '@repo/state'

type ValidationResult = {
	allowed: boolean
	reason?: string
}

const EVENTS_REQUIRING_CURRENT_PLAYER = new Set([
	'CHOOSE_CARD',
	'ADD_EFFECT',
	'SEARCH_AND_DRAW',
	'PLAY_CARD',
	'END_TURN',
	'REQUEST_WHEEL_SPIN',
])

const EVENTS_ALLOWED_FOR_ANY_PLAYER = new Set([
	'PLAYER_JOINED',
	'PLAYER_READY',
	'START_GAME',
	'SURRENDER',
])

export const canPlayerSendEvent = (
	snapshot: MinOrMaxSnapshot,
	event: GameEvent,
	playerId: string,
): ValidationResult => {
	if (EVENTS_ALLOWED_FOR_ANY_PLAYER.has(event.type)) {
		return {allowed: true}
	}

	if (EVENTS_REQUIRING_CURRENT_PLAYER.has(event.type)) {
		const context = snapshot.context
		const currentPlayer = context.players[context.currentPlayerIndex]

		if (currentPlayer.id !== playerId) {
			return {allowed: false, reason: 'Not your turn'}
		}

		if (event.type === 'REQUEST_WHEEL_SPIN' && context.hasSpunThisTurn) {
			return {allowed: false, reason: 'Already spun this turn'}
		}

		return {allowed: true}
	}

	return {allowed: true}
}
