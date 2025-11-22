import type {MinOrMaxSnapshot} from './minOrMax'

export type GamePhase = 'lobby' | 'setup' | 'playing' | 'gameOver'

export const cardSuits = ['hearts', 'diamonds', 'clubs', 'spades'] as const
export type CardSuit = (typeof cardSuits)[number]

export const faceCardRanks = ['J', 'Q', 'K'] as const
export type FaceCardRank = (typeof faceCardRanks)[number]

export const cardRanks = [
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'10',
	...faceCardRanks,
	'A',
] as const
export type CardRank = (typeof cardRanks)[number]

export type CardEffect = {
	type: 'choice'
	name: string
	description: string
}

export type ActiveEffect =
	| {type: 'value-adder'; value: number; stacksRemaining: number}
	| {type: 'value-multiplier'; value: number; stacksRemaining: number}

export type Card = {
	id: string
	suit: CardSuit
	rank: CardRank
	effect?: CardEffect
}

export type PlayedCard = {
	card: Card
	playedValue: number
	playedBy: string | null
}

export type Player = {
	id: string
	name: string
	isReady: boolean
	hand: Card[]
}

// Game Events - used for state machine transitions
export type LobbyEvent =
	| {type: 'PLAYER_JOINED'; playerId: string; playerName: string}
	| {type: 'PLAYER_DROPPED'; playerId: string}
	| {type: 'PLAYER_READY'; playerId: string}
	| {type: 'PLAYER_UNREADY'; playerId: string}
	| {type: 'SEED'; seed: string}
	| {type: 'START_GAME'}

export type SetupEvent =
	| {type: 'SHUFFLE_PILE'; pile: 'draw' | 'discard'}
	| {type: 'PILE_SHUFFLED'}
	| {type: 'CARDS_DEALT'}
	| {type: 'THRESHOLDS_SET'}
	| {type: 'WHEEL_SPUN'; angle: number}
	| {type: 'FIRST_CARD_PLAYED'}
	| {type: 'SETUP_COMPLETE'}

export type PlayingEvent =
	| {type: 'REQUEST_WHEEL_SPIN'; force: number}
	| {type: 'WHEEL_SPUN'; angle: number}
	| {type: 'CHOOSE_CARD'; cardId: string}
	| {type: 'ADD_EFFECT'; effect: ActiveEffect}
	| {type: 'SEARCH_AND_DRAW'; rank: FaceCardRank}
	| {type: 'PLAY_CARD'}
	| {type: 'END_TURN'}
	| {type: 'SURRENDER'}

export type GameOverEvent = {type: 'PLAY_AGAIN'}

export type GameEvent = LobbyEvent | SetupEvent | PlayingEvent | GameOverEvent

// WebSocket Messages
export type ClientMessage =
	| {type: 'JOIN_GAME'; playerId: string; playerName: string}
	| {type: 'READY'}
	| {type: 'START_GAME'}
	| {type: 'CHOOSE_THRESHOLD'; threshold: number}
	| {type: 'TURN_STARTED'}
	| {type: 'REQUEST_WHEEL_SPIN'; force: number}
	| {type: 'CHOOSE_CARD'; cardId: string}
	| {type: 'ADD_EFFECT'; effect: ActiveEffect}
	| {type: 'SEARCH_AND_DRAW'; rank: FaceCardRank}
	| {type: 'PLAY_CARD'}
	| {type: 'END_TURN'}
	| {type: 'SURRENDER'}
	| {type: 'REQUEST_AUTO_PLAY'}
	| {type: 'PLAY_AGAIN'}

export type ServerMessage =
	| {type: 'CONNECTED'; playerId: string}
	| {type: 'GAME_EVENT'; event: GameEvent; sequenceId: number}
	| {type: 'STATE_SNAPSHOT'; state: unknown; sequenceId: number}
	| {type: 'ERROR'; message: string}
	| {type: 'PLAYER_JOINED'; playerId: string; playerName: string}
	| {type: 'PLAYER_LEFT'; playerId: string}

// Type Guards
export const isServerMessage = (data: unknown): data is ServerMessage => {
	if (typeof data !== 'object' || data === null) {
		return false
	}

	const message = data as Record<string, unknown>

	if (typeof message.type !== 'string') {
		return false
	}

	switch (message.type) {
		case 'CONNECTED':
			return typeof message.playerId === 'string'
		case 'GAME_EVENT':
			return (
				typeof message.event === 'object' &&
				message.event !== null &&
				typeof message.sequenceId === 'number'
			)
		case 'STATE_SNAPSHOT':
			return (
				message.state !== undefined && typeof message.sequenceId === 'number'
			)
		case 'ERROR':
			return typeof message.message === 'string'
		case 'PLAYER_JOINED':
			return (
				typeof message.playerId === 'string' &&
				typeof message.playerName === 'string'
			)
		case 'PLAYER_LEFT':
			return typeof message.playerId === 'string'
		default:
			return false
	}
}

export const isStateSnapshot = (
	message: ServerMessage,
): message is {type: 'STATE_SNAPSHOT'; state: unknown; sequenceId: number} =>
	message.type === 'STATE_SNAPSHOT'

export const isGameEvent = (
	message: ServerMessage,
): message is {type: 'GAME_EVENT'; event: GameEvent; sequenceId: number} =>
	message.type === 'GAME_EVENT'

export const isMinOrMaxSnapshot = (data: unknown): data is MinOrMaxSnapshot => {
	if (typeof data !== 'object' || data === null) {
		return false
	}

	const snapshot = data as Record<string, unknown>

	return (
		snapshot.value !== undefined &&
		typeof snapshot.context === 'object' &&
		snapshot.context !== null
	)
}
