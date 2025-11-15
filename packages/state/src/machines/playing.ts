import {assign, setup} from 'xstate'
import {Rng, shuffle} from '@repo/rng'
import type {
	ActiveEffect,
	Card,
	PlayedCard,
	Player,
	PlayingEvent,
} from '../types'
import {
	calculateSpin,
	getCardValue,
	calculateCurrentPlayerWins,
	calculatePreviousPlayerWins,
} from '../utils'

export type PlayingInput = {
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

export type PlayingContext = PlayingInput & {
	chosenCard: Card | null
	activeEffects: ActiveEffect[]
	winner: Player | null
	losers: Player[]
	reason: 'exact_threshold' | 'exceeded_threshold' | 'surrendered' | null
}

export const playingMachine = setup({
	types: {
		input: {} as PlayingInput,
		context: {} as PlayingContext,
		events: {} as PlayingEvent,
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
				return {
					...calculateCurrentPlayerWins(
						context.players,
						context.currentPlayerIndex,
					),
					reason: 'exact_threshold' as const,
				}
			} else if (isOver) {
				return {
					...calculatePreviousPlayerWins(
						context.players,
						context.currentPlayerIndex,
					),
					reason: 'exceeded_threshold' as const,
				}
			}

			return {}
		}),
		setWinnerForSurrender: assign(({context}) => ({
			...calculatePreviousPlayerWins(
				context.players,
				context.currentPlayerIndex,
			),
			reason: 'surrendered' as const,
		})),
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
			always: {
				target: 'playerTurn',
				actions: ['reshuffleDiscardIntoDraw', 'drawCardForCurrentPlayer'],
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
						SURRENDER: {
							target: '#playing.gameOver',
							actions: 'setWinnerForSurrender',
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
