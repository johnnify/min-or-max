import {and, assign, enqueueActions, setup} from 'xstate'
import {Rng} from '@repo/rng'
import {createStandardDeck} from './utils'

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

export type Card = {
	id: string
	suit: CardSuit
	rank: CardRank
}

export type Player = {
	id: string
	name: string
	isReady: boolean
	hand: Card[]
}

type LobbyContext = {
	players: Player[]
	minPlayers: number
	maxPlayers: number
	rng: Rng | null
	deck: Card[]
}

type LobbyEvents =
	| {type: 'PLAYER_JOINED'; playerId: string; playerName: string}
	| {type: 'PLAYER_DROPPED'; playerId: string}
	| {type: 'PLAYER_READY'; playerId: string}
	| {type: 'PLAYER_UNREADY'; playerId: string}
	| {type: 'SEED'; seed: string}
	| {type: 'START_GAME'}

export const lobbyMachine = setup({
	types: {
		context: {} as LobbyContext,
		events: {} as LobbyEvents,
	},
	actions: {
		addPlayer: assign({
			players: ({context, event}) => {
				if (event.type !== 'PLAYER_JOINED') return context.players

				return [
					...context.players,
					{
						id: event.playerId,
						name: event.playerName,
						isReady: false,
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
			rng: ({event}) => {
				if (event.type !== 'SEED') return null
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
		ensureRngAndStart: enqueueActions(({context, enqueue}) => {
			if (context.rng === null) {
				const seed = Date.now().toString()
				enqueue.assign({
					rng: new Rng(seed),
				})
			}
		}),
	},
	guards: {
		hasMinimumPlayers: ({context}) =>
			context.players.length >= context.minPlayers,
		allPlayersReady: ({context}) =>
			context.players.every((player) => player.isReady),
		canAddPlayer: ({context}) => context.players.length < context.maxPlayers,
	},
}).createMachine({
	id: 'lobby',
	initial: 'waiting',
	context: {
		players: [],
		minPlayers: 2,
		maxPlayers: 4,
		rng: null,
		deck: createStandardDeck(),
	},
	states: {
		waiting: {
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
					target: 'ready',
					guard: and(['hasMinimumPlayers', 'allPlayersReady']),
					actions: 'ensureRngAndStart',
				},
			},
		},
		ready: {
			type: 'final',
		},
	},
})

type SetupContext = {
	players: Player[]
	drawPile: Card[]
	discardPile: Card[]
	currentScore: number
	minThreshold: number
	maxThreshold: number
	wheelAngle: number
	rng: Rng | null
}

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

const shuffleArray = <T>(array: T[], rng: Rng): T[] => {
	const shuffled = [...array]
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = rng.nextInt(0, i)
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}
	return shuffled
}

const getCardValue = (rank: CardRank): number => {
	if (rank === 'A') return 11
	if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
	return parseInt(rank, 10)
}

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
				return shuffleArray(context.drawPile, context.rng)
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
		playFirstCard: assign({
			drawPile: ({context}) => {
				const newDrawPile = [...context.drawPile]
				newDrawPile.shift()
				return newDrawPile
			},
			discardPile: ({context}) => {
				const card = context.drawPile[0]
				return card ? [card] : []
			},
			currentScore: ({context}) => {
				const card = context.drawPile[0]
				if (!card) return 0
				const cardValue = getCardValue(card.rank)
				const wheelMode = context.wheelAngle >= 180 ? 'min' : 'max'
				return wheelMode === 'max' ? cardValue : -cardValue
			},
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

type PlayingInput = {
	rng: Rng
	players: Player[]
	drawPile: Card[]
	discardPile: Card[]
	minThreshold: number
	maxThreshold: number
	wheelAngle: number
	currentScore: number
	currentPlayerIndex: number
	hasSpunThisTurn: boolean
}

type PlayingContext = PlayingInput & {
	chosenCard: Card | null
	chosenCardEffect: {aceValue?: 1 | 11} | null
}

type PlayingEvents =
	| {type: 'TURN_STARTED'}
	| {type: 'SPIN_WHEEL'; force: number}
	| {type: 'CHOOSE_CARD'; cardId: string}
	| {type: 'PLAY_CARD'}
	| {type: 'END_TURN'}

export const playingMachine = setup({
	types: {
		input: {} as PlayingInput,
		context: {} as PlayingContext,
		events: {} as PlayingEvents,
	},
	actions: {
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

			const newDiscardPile = [context.chosenCard, ...context.discardPile]

			const cardValue = getCardValue(context.chosenCard.rank)
			const wheelMode = context.wheelAngle >= 180 ? 'min' : 'max'
			const newScore =
				wheelMode === 'max'
					? context.currentScore + cardValue
					: context.currentScore - cardValue

			return {
				players: updatedPlayers,
				discardPile: newDiscardPile,
				currentScore: newScore,
			}
		}),
		advanceToNextPlayer: assign({
			currentPlayerIndex: ({context}) => {
				return (context.currentPlayerIndex + 1) % context.players.length
			},
			hasSpunThisTurn: false,
			chosenCard: null,
			chosenCardEffect: null,
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

			const topCard = context.discardPile[0]
			if (!topCard) return true

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
	},
}).createMachine({
	id: 'playing',
	initial: 'turnStart',
	context: ({input}) => ({
		...input,
		chosenCard: null,
		chosenCardEffect: null,
	}),
	states: {
		turnStart: {
			on: {
				TURN_STARTED: {
					target: 'playerTurn',
					actions: 'drawCardForCurrentPlayer',
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
					on: {
						PLAY_CARD: {
							target: 'postCardPlay',
							actions: 'playCard',
						},
					},
				},
				postCardPlay: {
					on: {
						END_TURN: {
							target: '#playing.turnStart',
							actions: 'advanceToNextPlayer',
						},
					},
				},
			},
		},
	},
})
