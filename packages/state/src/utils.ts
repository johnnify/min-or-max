import type {Card, CardSuit, CardRank, CardEffect, PlayedCard} from './types'

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

export const lowOrHighAceEffect: CardEffect = {
	type: 'choice',
	name: 'Biggy Smalls',
	description: 'Choose whether the value of this Ace is 1 or 11!',
}

export const findFaceCardEffect: CardEffect = {
	type: 'choice',
	name: 'Courtship',
	description: 'Try to draw your choice of a date!',
}

export const createCard = (
	suit: CardSuit,
	rank: CardRank,
	effect?: CardEffect,
): Card => {
	const id = `${suit}-${rank}`

	if (effect !== undefined) {
		return {id, suit, rank, effect}
	}

	if (rank === 'A') {
		return {id, suit, rank, effect: lowOrHighAceEffect}
	}

	if (rank === 'J') {
		return {id, suit, rank, effect: findFaceCardEffect}
	}

	return {id, suit, rank}
}

export const createPlayedCard = (
	card: Card,
	playedValue: number,
	playedBy: string | null = 'player-1',
): PlayedCard => ({
	card,
	playedValue,
	playedBy,
})

export const createStandardDeck = (): Card[] =>
	CARD_SUITS.flatMap((suit) => CARD_RANKS.map((rank) => createCard(suit, rank)))

export const getCardValue = (rank: CardRank): number => {
	if (rank === 'A') return 1
	if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
	return parseInt(rank, 10)
}
