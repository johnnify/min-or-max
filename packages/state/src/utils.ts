import type {Rng} from '@repo/rng'
import {
	cardSuits,
	cardRanks,
	type Card,
	type CardSuit,
	type CardRank,
	type CardEffect,
	type PlayedCard,
	type Player,
	type GamePhase,
} from './types'
import type {MinOrMaxSnapshot} from './minOrMax'

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
	cardSuits.flatMap((suit) => cardRanks.map((rank) => createCard(suit, rank)))

export const getCardValue = (rank: CardRank): number => {
	if (rank === 'A') return 1
	if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
	return parseInt(rank, 10)
}

export const getCardOrder = (rank: CardRank): number => {
	if (rank === 'A') return 1
	if (rank === 'J') return 11
	if (rank === 'Q') return 12
	if (rank === 'K') return 13
	return parseInt(rank, 10)
}

export const getModeFromWheelAngle = (wheelAngle: number): 'min' | 'max' => {
	const normalizedAngle = ((wheelAngle % 360) + 360) % 360
	return normalizedAngle >= 180 ? 'min' : 'max'
}

export const canCardBeatTopCard = (
	chosenCard: Card,
	topCard: Card | null,
	wheelAngle: number,
): boolean => {
	if (!topCard) return true

	if (chosenCard.rank === 'A' || topCard.rank === 'A') return true

	const chosenOrder = getCardOrder(chosenCard.rank)
	const topOrder = getCardOrder(topCard.rank)
	const wheelMode = getModeFromWheelAngle(wheelAngle)

	if (wheelMode === 'max') {
		return chosenOrder >= topOrder
	} else {
		return chosenOrder <= topOrder
	}
}

export const calculateSpin = (force: number, rng: Rng): number => {
	if (force >= 0 && force <= 0.1) {
		return rng.nextInt(15, 90)
	} else if (force <= 0.5) {
		return rng.nextInt(45, 180)
	} else if (force <= 0.999) {
		return rng.nextInt(90, 360)
	} else {
		return rng.nextInt(360, 2880)
	}
}

export const calculateCurrentPlayerWins = (
	players: Player[],
	currentPlayerIndex: number,
) => {
	const winner = players[currentPlayerIndex]
	const losers = players.filter((p) => p.id !== winner.id)
	return {winner, losers}
}

export const calculatePreviousPlayerWins = (
	players: Player[],
	currentPlayerIndex: number,
) => {
	const previousPlayerIndex =
		(currentPlayerIndex - 1 + players.length) % players.length
	const winner = players[previousPlayerIndex]
	const losers = players.filter((p) => p.id !== winner.id)
	return {winner, losers}
}

export const getPhaseFromState = (
	stateValue: MinOrMaxSnapshot['value'],
): GamePhase => {
	if (stateValue === 'lobby') return 'lobby'
	if (stateValue === 'gameOver') return 'gameOver'
	if (typeof stateValue === 'object' && stateValue !== null) {
		if ('setup' in stateValue) return 'setup'
		if ('playing' in stateValue) return 'playing'
	}
	return 'lobby'
}

export type AutoPlayAction =
	| {type: 'play_card'; cardId: string}
	| {type: 'spin'}
	| {type: 'end_turn'}

export const determineAutoPlayAction = (
	context: {
		players: Player[]
		currentPlayerIndex: number
		discardPile: PlayedCard[]
		wheelAngle: number
		hasSpunThisTurn: boolean
	},
	playerId: string,
): AutoPlayAction | null => {
	const currentPlayer = context.players[context.currentPlayerIndex]

	if (!currentPlayer || currentPlayer.id !== playerId) {
		return null
	}

	const topPlayedCard = context.discardPile.at(-1)
	const topCard = topPlayedCard?.card ?? null

	const validCard = currentPlayer.hand.find((card) =>
		canCardBeatTopCard(card, topCard, context.wheelAngle),
	)

	if (validCard) {
		return {type: 'play_card', cardId: validCard.id}
	}

	if (!context.hasSpunThisTurn) {
		return {type: 'spin'}
	}

	return {type: 'end_turn'}
}
