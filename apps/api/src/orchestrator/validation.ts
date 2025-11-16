import type {Snapshot} from 'xstate'
import type {GameEvent, MinOrMaxContext} from '@repo/state'

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
	'SPIN_WHEEL',
])

const EVENTS_ALLOWED_FOR_ANY_PLAYER = new Set([
	'PLAYER_JOINED',
	'PLAYER_READY',
	'START_GAME',
	'SURRENDER',
])

export const canPlayerSendEvent = (
	snapshot: Snapshot<unknown> & {context?: unknown},
	event: GameEvent,
	playerId: string,
): ValidationResult => {
	if (EVENTS_ALLOWED_FOR_ANY_PLAYER.has(event.type)) {
		return {allowed: true}
	}

	if (EVENTS_REQUIRING_CURRENT_PLAYER.has(event.type)) {
		if (!snapshot.context) {
			return {allowed: false, reason: 'No context available'}
		}

		const context = snapshot.context as MinOrMaxContext
		const currentPlayer = context.players[context.currentPlayerIndex]

		if (currentPlayer.id !== playerId) {
			return {allowed: false, reason: 'Not your turn'}
		}

		if (event.type === 'SPIN_WHEEL' && context.hasSpunThisTurn) {
			return {allowed: false, reason: 'Already spun this turn'}
		}

		return {allowed: true}
	}

	return {allowed: true}
}
