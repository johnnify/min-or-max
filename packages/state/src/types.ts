export type GamePhase = 'lobby' | 'setup' | 'playing' | 'gameOver'

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type CardRank =
	| '2'
	| '3'
	| '4'
	| '5'
	| '6'
	| '7'
	| '8'
	| '9'
	| '10'
	| 'J'
	| 'Q'
	| 'K'
	| 'A'

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
	| {type: 'WHEEL_SPUN'; force: number}
	| {type: 'FIRST_CARD_PLAYED'}
	| {type: 'SETUP_COMPLETE'}

export type PlayingEvent =
	| {type: 'SPIN_WHEEL'; force: number}
	| {type: 'CHOOSE_CARD'; cardId: string}
	| {type: 'ADD_EFFECT'; effect: ActiveEffect}
	| {type: 'SEARCH_AND_DRAW'; rank: 'J' | 'Q' | 'K'}
	| {type: 'PLAY_CARD'}
	| {type: 'END_TURN'}
	| {type: 'SURRENDER'}

export type GameEvent = LobbyEvent | SetupEvent | PlayingEvent
