import {assign, and, setup, type ActorRefFrom, type SnapshotFrom} from 'xstate'
import {Rng, shuffle} from '@repo/rng'
import type {ActiveEffect, Card, PlayedCard, Player, GameEvent} from './types'
import {
	createStandardDeck,
	getCardValue,
	calculateCurrentPlayerWins,
	calculatePreviousPlayerWins,
	canCardBeatTopCard,
} from './utils'

export type MinOrMaxContext = {
	// Lobby data
	players: Player[]
	minPlayers: number
	maxPlayers: number
	deck: Card[]
	rng: Rng

	// Setup & Playing data
	drawPile: Card[]
	discardPile: PlayedCard[]
	tally: number
	maxThreshold: number
	wheelAngle: number
	currentPlayerIndex: number
	hasSpunThisTurn: boolean

	// Playing-specific data
	chosenCard: Card | null
	activeEffects: ActiveEffect[]
	winner: Player | null
	losers: Player[]
	reason: 'exact_threshold' | 'exceeded_threshold' | 'surrendered' | null
}

export const minOrMaxMachine = setup({
	types: {
		context: {} as MinOrMaxContext,
		events: {} as GameEvent | {type: 'PLAY_AGAIN'},
	},
	actions: {
		// Lobby actions
		addPlayer: assign({
			players: ({context, event}) => {
				if (event.type !== 'PLAYER_JOINED') return context.players

				return [
					...context.players,
					{
						id: event.playerId,
						name: event.playerName,
						isReady: true,
						hand: [],
					},
				]
			},
		}),
		markPlayerReady: assign({
			players: ({context, event}) => {
				if (event.type !== 'PLAYER_READY') return context.players

				return context.players.map((player) =>
					player.id === event.playerId ? {...player, isReady: true} : player,
				)
			},
		}),
		initializeRng: assign({
			rng: ({context, event}) => {
				if (event.type !== 'SEED') return context.rng
				return new Rng(event.seed)
			},
		}),
		markPlayerUnready: assign({
			players: ({context, event}) => {
				if (event.type !== 'PLAYER_UNREADY') return context.players

				return context.players.map((player) =>
					player.id === event.playerId ? {...player, isReady: false} : player,
				)
			},
		}),
		removePlayer: assign({
			players: ({context, event}) => {
				if (event.type !== 'PLAYER_DROPPED') return context.players

				return context.players.filter((player) => player.id !== event.playerId)
			},
		}),

		// Setup actions
		shuffleDeck: assign({
			drawPile: ({context}) => shuffle(context.deck, context.rng),
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
			maxThreshold: ({context}) => context.rng.nextInt(40, 60),
		}),
		playFirstCard: assign(({context}) => {
			const card = context.drawPile[0]
			if (!card) return {}

			const newDrawPile = [...context.drawPile]
			newDrawPile.shift()

			const cardValue = getCardValue(card.rank)
			const playedValue = cardValue

			const playedCard: PlayedCard = {
				card,
				playedValue,
				playedBy: null,
			}

			return {
				drawPile: newDrawPile,
				discardPile: [playedCard],
				tally: context.tally + playedValue,
				hasSpunThisTurn: false,
			}
		}),

		// Playing actions
		reshuffleDiscardIntoDraw: assign(({context}) => {
			if (context.drawPile.length > 0 || context.discardPile.length <= 1) {
				return {}
			}

			const [topCard, ...cardsToReshuffle] = context.discardPile
			const cards = cardsToReshuffle.map((playedCard) => playedCard.card)
			const shuffled = shuffle(cards, context.rng)

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
		applyWheelSpin: assign({
			wheelAngle: ({event}) => {
				if (event.type !== 'WHEEL_SPUN') throw new Error('Invalid event type')
				return event.angle
			},
			hasSpunThisTurn: true,
		}),
		playCard: assign(({context}) => {
			if (!context.chosenCard) return {}

			const chosenCard = context.chosenCard

			const updatedPlayers = context.players.map((player, index) => {
				if (index === context.currentPlayerIndex) {
					return {
						...player,
						hand: player.hand.filter((card) => card.id !== chosenCard.id),
					}
				}
				return player
			})

			let cardValue = getCardValue(chosenCard.rank)

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

			const playedValue = cardValue

			const playedCard: PlayedCard = {
				card: chosenCard,
				playedValue,
				playedBy: context.players[context.currentPlayerIndex].id,
			}

			const newDiscardPile = [playedCard, ...context.discardPile]

			return {
				players: updatedPlayers,
				discardPile: newDiscardPile,
				tally: context.tally + playedValue,
				activeEffects: newActiveEffects,
			}
		}),
		advanceToNextPlayer: assign({
			currentPlayerIndex: ({context}) =>
				(context.currentPlayerIndex + 1) % context.players.length,
			hasSpunThisTurn: false,
			chosenCard: null,
		}),
		setWinnerAndLosers: assign(({context}) => {
			const isExact = context.tally === context.maxThreshold
			const isOver = context.tally > context.maxThreshold

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
		resetToLobby: assign({
			drawPile: [],
			discardPile: [],
			tally: 0,
			maxThreshold: 0,
			wheelAngle: 90,
			currentPlayerIndex: 0,
			hasSpunThisTurn: false,
			chosenCard: null,
			activeEffects: [],
			winner: null,
			losers: [],
			reason: null,
			players: ({context}) =>
				context.players.map((p) => ({...p, isReady: true, hand: []})),
		}),
	},
	guards: {
		hasMinimumPlayers: ({context}) =>
			context.players.length >= context.minPlayers,
		allPlayersReady: ({context}) =>
			context.players.every((player) => player.isReady),
		canAddPlayer: ({context}) => context.players.length < context.maxPlayers,
		canBeatTopCard: ({context, event}) => {
			if (event.type !== 'CHOOSE_CARD') return false

			const currentPlayer = context.players[context.currentPlayerIndex]
			const chosenCard = currentPlayer.hand.find(
				(card) => card.id === event.cardId,
			)
			if (!chosenCard) return false

			const topCard = context.discardPile[0]?.card || null

			return canCardBeatTopCard(chosenCard, topCard, context.wheelAngle)
		},
		chosenCardHasEffect: ({context}) => {
			return context.chosenCard?.effect !== undefined
		},
		hasNotSpunThisTurn: ({context}) => !context.hasSpunThisTurn,
		isExactThreshold: ({context}) => {
			return context.tally === context.maxThreshold
		},
		isOverThreshold: ({context}) => {
			return context.tally > context.maxThreshold
		},
	},
}).createMachine({
	id: 'minOrMax',
	initial: 'lobby',
	context: {
		players: [],
		minPlayers: 2,
		maxPlayers: 4,
		deck: createStandardDeck(),
		rng: new Rng(Date.now().toString()),
		drawPile: [],
		discardPile: [],
		tally: 0,
		maxThreshold: 0,
		wheelAngle: 90,
		currentPlayerIndex: 0,
		hasSpunThisTurn: false,
		chosenCard: null,
		activeEffects: [],
		winner: null,
		losers: [],
		reason: null,
	},
	states: {
		lobby: {
			on: {
				PLAYER_JOINED: {
					guard: 'canAddPlayer',
					actions: 'addPlayer',
				},
				PLAYER_DROPPED: {
					actions: 'removePlayer',
				},
				PLAYER_READY: {
					actions: 'markPlayerReady',
				},
				PLAYER_UNREADY: {
					actions: 'markPlayerUnready',
				},
				SEED: {
					actions: 'initializeRng',
				},
				START_GAME: {
					target: 'setup',
					guard: and(['hasMinimumPlayers', 'allPlayersReady']),
				},
			},
		},
		setup: {
			initial: 'shufflingPile',
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
							actions: 'applyWheelSpin',
						},
					},
				},
				playingFirstCard: {
					on: {
						FIRST_CARD_PLAYED: {
							target: '#minOrMax.playing',
							actions: 'playFirstCard',
						},
					},
				},
			},
		},
		playing: {
			initial: 'turnStart',
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
								WHEEL_SPUN: {
									actions: 'applyWheelSpin',
								},
								CHOOSE_CARD: {
									target: 'processingCard',
									guard: 'canBeatTopCard',
									actions: 'setChosenCard',
								},
								END_TURN: {
									target: '#minOrMax.playing.turnStart',
									actions: 'advanceToNextPlayer',
								},
								SURRENDER: {
									target: '#minOrMax.gameOver',
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
							always: {
								target: 'postCardPlay',
								actions: 'playCard',
							},
						},
						postCardPlay: {
							always: [
								{
									target: '#minOrMax.gameOver',
									guard: 'isExactThreshold',
									actions: 'setWinnerAndLosers',
								},
								{
									target: '#minOrMax.gameOver',
									guard: 'isOverThreshold',
									actions: 'setWinnerAndLosers',
								},
							],
							on: {
								WHEEL_SPUN: {
									guard: 'hasNotSpunThisTurn',
									actions: 'applyWheelSpin',
								},
								END_TURN: {
									target: '#minOrMax.playing.turnStart',
									actions: 'advanceToNextPlayer',
								},
							},
						},
					},
				},
			},
		},
		gameOver: {
			on: {
				PLAY_AGAIN: {
					target: 'lobby',
					actions: 'resetToLobby',
				},
			},
		},
	},
})

// Convenience types for working with the minOrMaxMachine
export type MinOrMaxActor = ActorRefFrom<typeof minOrMaxMachine>
export type MinOrMaxSnapshot = SnapshotFrom<typeof minOrMaxMachine>
