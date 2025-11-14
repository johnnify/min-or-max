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
