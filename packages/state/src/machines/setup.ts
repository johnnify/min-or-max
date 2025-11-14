import {assign, setup} from 'xstate'
import {Rng, shuffle} from '@repo/rng'
import type {Card, CardRank, PlayedCard, Player} from '../types'

const calculateSpin = (force: number, rng: Rng | null): number => {
	if (!rng) return 0

	if (force >= 0 && force <= 0.1) {
		return rng.nextInt(15, 90)
	} else if (force >= 0.26 && force <= 0.5) {
		return rng.nextInt(45, 180)
	} else if (force >= 0.51 && force <= 0.999) {
		return rng.nextInt(90, 360)
	} else if (force === 1) {
		return rng.nextInt(360, 2880)
	}

	return 0
}

const getCardValue = (rank: CardRank): number => {
	if (rank === 'A') return 1
	if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
	return parseInt(rank, 10)
}

type SetupContext = {
	players: Player[]
	drawPile: Card[]
	discardPile: PlayedCard[]
	currentScore: number
	minThreshold: number
	maxThreshold: number
	wheelAngle: number
	rng: Rng | null
}

type SetupInput = {
	rng: Rng
	players: Player[]
	deck: Card[]
}

type SetupEvents =
	| {type: 'SHUFFLE_PILE'; pile: 'draw' | 'discard'}
	| {type: 'PILE_SHUFFLED'}
	| {type: 'CARDS_DEALT'}
	| {type: 'THRESHOLDS_SET'}
	| {type: 'WHEEL_SPUN'; force: number}
	| {type: 'FIRST_CARD_PLAYED'}
	| {type: 'SETUP_COMPLETE'}

export const setupMachine = setup({
	types: {
		input: {} as SetupInput,
		context: {} as SetupContext,
		events: {} as SetupEvents,
	},
	actions: {
		shuffleDeck: assign({
			drawPile: ({context}) => {
				if (!context.rng) return context.drawPile
				return shuffle(context.drawPile, context.rng)
			},
		}),
		dealCards: assign(({context}) => {
			const newDrawPile = [...context.drawPile]
			const updatedPlayers = context.players.map((player) => {
				const hand: Card[] = []
				for (let i = 0; i < 3; i++) {
					const card = newDrawPile.shift()
					if (card) {
						hand.push(card)
					}
				}
				return {
					...player,
					hand,
				}
			})

			return {
				players: updatedPlayers,
				drawPile: newDrawPile,
			}
		}),
		generateThresholds: assign({
			minThreshold: ({context}) => {
				if (!context.rng) return 0
				return context.rng.nextInt(-20, -10)
			},
			maxThreshold: ({context}) => {
				if (!context.rng) return 0
				return context.rng.nextInt(30, 50)
			},
		}),
		playFirstCard: assign(({context}) => {
			const card = context.drawPile[0]
			if (!card) return {}

			const newDrawPile = [...context.drawPile]
			newDrawPile.shift()

			const cardValue = getCardValue(card.rank)
			const wheelMode = context.wheelAngle >= 180 ? 'min' : 'max'
			const playedValue = wheelMode === 'max' ? cardValue : -cardValue

			const playedCard: PlayedCard = {
				card,
				playedValue,
				playedBy: null,
			}

			return {
				drawPile: newDrawPile,
				discardPile: [playedCard],
				currentScore: context.currentScore + playedValue,
			}
		}),
		updateWheelAngle: assign({
			wheelAngle: ({context, event}) => {
				if (event.type !== 'WHEEL_SPUN') return context.wheelAngle
				const spinDegrees = calculateSpin(event.force, context.rng)
				return context.wheelAngle + spinDegrees
			},
		}),
	},
}).createMachine({
	id: 'setup',
	initial: 'shufflingPile',
	context: ({input}) => ({
		players: input.players,
		drawPile: input.deck,
		discardPile: [],
		currentScore: 0,
		minThreshold: 0,
		maxThreshold: 0,
		wheelAngle: 90,
		rng: input.rng,
	}),
	states: {
		shufflingPile: {
			on: {
				PILE_SHUFFLED: {
					target: 'dealingCards',
					actions: 'shuffleDeck',
				},
			},
		},
		dealingCards: {
			on: {
				CARDS_DEALT: {
					target: 'generatingThresholds',
					actions: 'dealCards',
				},
			},
		},
		generatingThresholds: {
			on: {
				THRESHOLDS_SET: {
					target: 'spinningInitialWheel',
					actions: 'generateThresholds',
				},
			},
		},
		spinningInitialWheel: {
			on: {
				WHEEL_SPUN: {
					target: 'playingFirstCard',
					actions: 'updateWheelAngle',
				},
			},
		},
		playingFirstCard: {
			on: {
				FIRST_CARD_PLAYED: {
					target: 'complete',
					actions: 'playFirstCard',
				},
			},
		},
		complete: {
			type: 'final',
		},
	},
})
