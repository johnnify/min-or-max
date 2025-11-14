import {assign, setup} from 'xstate'
import {Rng, shuffle} from '@repo/rng'
import type {ActiveEffect, Card, CardRank, PlayedCard, Player} from '../types'

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

type PlayingInput = {
	rng: Rng
	players: Player[]
	drawPile: Card[]
	discardPile: PlayedCard[]
	minThreshold: number
	maxThreshold: number
	wheelAngle: number
	currentScore: number
	currentPlayerIndex: number
	hasSpunThisTurn: boolean
}

type PlayingContext = PlayingInput & {
	chosenCard: Card | null
	activeEffects: ActiveEffect[]
	winner: Player | null
	losers: Player[]
	reason: 'exact_threshold' | 'exceeded_threshold' | null
}

type PlayingEvents =
	| {type: 'TURN_STARTED'}
	| {type: 'SPIN_WHEEL'; force: number}
	| {type: 'CHOOSE_CARD'; cardId: string}
	| {type: 'ADD_EFFECT'; effect: ActiveEffect}
	| {type: 'SEARCH_AND_DRAW'; rank: 'J' | 'Q' | 'K'}
	| {type: 'PLAY_CARD'}
	| {type: 'END_TURN'}

export const playingMachine = setup({
	types: {
		input: {} as PlayingInput,
		context: {} as PlayingContext,
		events: {} as PlayingEvents,
	},
	actions: {
		reshuffleDiscardIntoDraw: assign(({context}) => {
			if (context.drawPile.length > 0 || context.discardPile.length <= 1) {
				return {}
			}

			const [topCard, ...cardsToReshuffle] = context.discardPile
			const cards = cardsToReshuffle.map((playedCard) => playedCard.card)
			const shuffled = shuffle(cards, context.rng!)

			return {
				drawPile: shuffled,
				discardPile: [topCard],
			}
		}),
		drawCardForCurrentPlayer: assign(({context}) => {
			const newDrawPile = [...context.drawPile]
			const drawnCard = newDrawPile.shift()

			if (!drawnCard) return {}

			const updatedPlayers = context.players.map((player, index) => {
				if (index === context.currentPlayerIndex) {
					return {
						...player,
						hand: [...player.hand, drawnCard],
					}
				}
				return player
			})

			return {
				players: updatedPlayers,
				drawPile: newDrawPile,
			}
		}),
		setChosenCard: assign({
			chosenCard: ({context, event}) => {
				if (event.type !== 'CHOOSE_CARD') return context.chosenCard

				const currentPlayer = context.players[context.currentPlayerIndex]
				return (
					currentPlayer.hand.find((card) => card.id === event.cardId) || null
				)
			},
		}),
		addEffect: assign({
			activeEffects: ({context, event}) => {
				if (event.type !== 'ADD_EFFECT') return context.activeEffects
				return [...context.activeEffects, event.effect]
			},
		}),
		searchAndDraw: assign(({context, event}) => {
			if (event.type !== 'SEARCH_AND_DRAW') return {}

			const targetRank = event.rank
			const foundIndex = context.drawPile.findIndex(
				(card) => card.rank === targetRank,
			)

			if (foundIndex === -1) {
				return {}
			}

			const newDrawPile = [...context.drawPile]
			const foundCard = newDrawPile.splice(foundIndex, 1)[0]

			const updatedPlayers = context.players.map((player, index) => {
				if (index === context.currentPlayerIndex) {
					return {
						...player,
						hand: [...player.hand, foundCard],
					}
				}
				return player
			})

			return {
				players: updatedPlayers,
				drawPile: newDrawPile,
			}
		}),
		spinWheel: assign({
			wheelAngle: ({context, event}) => {
				if (event.type !== 'SPIN_WHEEL') return context.wheelAngle
				const spinDegrees = calculateSpin(event.force, context.rng)
				return context.wheelAngle + spinDegrees
			},
			hasSpunThisTurn: true,
		}),
		playCard: assign(({context}) => {
			if (!context.chosenCard) return {}

			const updatedPlayers = context.players.map((player, index) => {
				if (index === context.currentPlayerIndex) {
					return {
						...player,
						hand: player.hand.filter(
							(card) => card.id !== context.chosenCard!.id,
						),
					}
				}
				return player
			})

			let cardValue = getCardValue(context.chosenCard.rank)

			const newActiveEffects: ActiveEffect[] = []
			for (const effect of context.activeEffects) {
				if (effect.type === 'value-adder') {
					cardValue += effect.value
				} else if (effect.type === 'value-multiplier') {
					cardValue *= effect.value
				}

				const remainingStacks = effect.stacksRemaining - 1
				if (remainingStacks > 0) {
					newActiveEffects.push({...effect, stacksRemaining: remainingStacks})
				}
			}

			const wheelMode = context.wheelAngle >= 180 ? 'min' : 'max'
			const playedValue = wheelMode === 'max' ? cardValue : -cardValue

			const playedCard: PlayedCard = {
				card: context.chosenCard,
				playedValue,
				playedBy: context.players[context.currentPlayerIndex].id,
			}

			const newDiscardPile = [playedCard, ...context.discardPile]

			return {
				players: updatedPlayers,
				discardPile: newDiscardPile,
				currentScore: context.currentScore + playedValue,
				activeEffects: newActiveEffects,
			}
		}),
		advanceToNextPlayer: assign({
			currentPlayerIndex: ({context}) => {
				return (context.currentPlayerIndex + 1) % context.players.length
			},
			hasSpunThisTurn: false,
			chosenCard: null,
		}),
		setWinnerAndLosers: assign(({context}) => {
			const isExact =
				context.currentScore === context.minThreshold ||
				context.currentScore === context.maxThreshold
			const isOver =
				context.currentScore < context.minThreshold ||
				context.currentScore > context.maxThreshold

			if (isExact) {
				const winner = context.players[context.currentPlayerIndex]
				const losers = context.players.filter((p) => p.id !== winner.id)
				return {
					winner,
					losers,
					reason: 'exact_threshold' as const,
				}
			} else if (isOver) {
				const previousPlayerIndex =
					(context.currentPlayerIndex - 1 + context.players.length) %
					context.players.length
				const winner = context.players[previousPlayerIndex]
				const losers = context.players.filter((p) => p.id !== winner.id)
				return {
					winner,
					losers,
					reason: 'exceeded_threshold' as const,
				}
			}

			return {}
		}),
	},
	guards: {
		canBeatTopCard: ({context, event}) => {
			if (event.type !== 'CHOOSE_CARD') return false

			const currentPlayer = context.players[context.currentPlayerIndex]
			const chosenCard = currentPlayer.hand.find(
				(card) => card.id === event.cardId,
			)
			if (!chosenCard) return false

			const topPlayedCard = context.discardPile[0]
			if (!topPlayedCard) return true

			const topCard = topPlayedCard.card

			// Aces beat everything, but can be beaten by anything!
			if (chosenCard.rank === 'A' || topCard.rank === 'A') return true

			const chosenValue = getCardValue(chosenCard.rank)
			const topValue = getCardValue(topCard.rank)
			const wheelMode = context.wheelAngle >= 180 ? 'min' : 'max'

			if (wheelMode === 'max') {
				return chosenValue >= topValue
			} else {
				return chosenValue <= topValue
			}
		},
		chosenCardHasEffect: ({context}) => {
			return context.chosenCard?.effect !== undefined
		},
		hasNotSpunThisTurn: ({context}) => {
			return !context.hasSpunThisTurn
		},
		isExactThreshold: ({context}) => {
			return (
				context.currentScore === context.minThreshold ||
				context.currentScore === context.maxThreshold
			)
		},
		isOverThreshold: ({context}) => {
			return (
				context.currentScore < context.minThreshold ||
				context.currentScore > context.maxThreshold
			)
		},
	},
}).createMachine({
	id: 'playing',
	initial: 'turnStart',
	context: ({input}) => ({
		...input,
		chosenCard: null,
		activeEffects: [],
		winner: null,
		losers: [],
		reason: null,
	}),
	states: {
		turnStart: {
			on: {
				TURN_STARTED: {
					target: 'playerTurn',
					actions: ['reshuffleDiscardIntoDraw', 'drawCardForCurrentPlayer'],
				},
			},
		},
		playerTurn: {
			initial: 'awaitingAction',
			states: {
				awaitingAction: {
					on: {
						SPIN_WHEEL: {
							actions: 'spinWheel',
						},
						CHOOSE_CARD: {
							target: 'processingCard',
							guard: 'canBeatTopCard',
							actions: 'setChosenCard',
						},
					},
				},
				processingCard: {
					always: [
						{
							target: 'configuringEffect',
							guard: 'chosenCardHasEffect',
						},
						{
							target: 'readyToPlay',
						},
					],
				},
				configuringEffect: {
					on: {
						ADD_EFFECT: {
							actions: 'addEffect',
						},
						SEARCH_AND_DRAW: {
							actions: 'searchAndDraw',
						},
						PLAY_CARD: {
							target: 'postCardPlay',
							actions: 'playCard',
						},
					},
				},
				readyToPlay: {
					on: {
						PLAY_CARD: {
							target: 'postCardPlay',
							actions: 'playCard',
						},
					},
				},
				postCardPlay: {
					always: [
						{
							target: '#playing.gameOver',
							guard: 'isExactThreshold',
							actions: 'setWinnerAndLosers',
						},
						{
							target: '#playing.gameOver',
							guard: 'isOverThreshold',
							actions: 'setWinnerAndLosers',
						},
					],
					on: {
						SPIN_WHEEL: {
							guard: 'hasNotSpunThisTurn',
							actions: 'spinWheel',
						},
						END_TURN: {
							target: '#playing.turnStart',
							actions: 'advanceToNextPlayer',
						},
					},
				},
			},
		},
		gameOver: {
			type: 'final',
		},
	},
})
