import type {Card, CardSuit, CardRank} from './machine'

export const CARD_SUITS: readonly CardSuit[] = [
	'hearts',
	'diamonds',
	'clubs',
	'spades',
]
export const CARD_RANKS: readonly CardRank[] = [
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'10',
	'J',
	'Q',
	'K',
	'A',
]

export const createCard = (suit: CardSuit, rank: CardRank): Card => ({
	id: `${suit}-${rank}`,
	suit,
	rank,
})

export const createStandardDeck = (): Card[] =>
	CARD_SUITS.flatMap((suit) => CARD_RANKS.map((rank) => createCard(suit, rank)))
