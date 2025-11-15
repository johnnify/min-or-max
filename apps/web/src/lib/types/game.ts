import type {GamePhase} from '@repo/state'

export type ClientMessage =
	| {type: 'JOIN_GAME'; playerId: string; playerName: string}
	| {type: 'READY'}
	| {type: 'START_GAME'}
	| {type: 'CHOOSE_THRESHOLD'; threshold: number}
	| {type: 'TURN_STARTED'}
	| {type: 'SPIN_WHEEL'; force: number}
	| {type: 'CHOOSE_CARD'; cardId: string}
	| {
			type: 'ADD_EFFECT'
			effect: {type: string; value: number; stacksRemaining: number}
	  }
	| {type: 'SEARCH_AND_DRAW'; rank: 'J' | 'Q' | 'K'}
	| {type: 'PLAY_CARD'}
	| {type: 'END_TURN'}
	| {type: 'SURRENDER'}
	| {type: 'REQUEST_AUTO_PLAY'}
	| {type: 'PLAY_AGAIN'}

export type ServerMessage =
	| {type: 'CONNECTED'; playerId: string}
	| {type: 'STATE_UPDATE'; phase: GamePhase; state: unknown}
	| {type: 'ERROR'; message: string}
	| {type: 'PLAYER_JOINED'; playerId: string; playerName: string}
	| {type: 'PLAYER_LEFT'; playerId: string}
	| {type: 'AUTO_SPIN'; force: number}
	| {type: 'AUTO_PLAY'; cardId: string}
	| {type: 'PLAYER_SURRENDERED'; playerId: string}
