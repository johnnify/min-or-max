import {and, assign, setup} from 'xstate'
import {Rng} from '@repo/rng'

export type Player = {
	id: string
	name: string
	isReady: boolean
}

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

type LobbyContext = {
	players: Player[]
	minPlayers: number
	maxPlayers: number
	rng: Rng | null
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
	},
	guards: {
		hasMinimumPlayers: ({context}) => context.players.length >= context.minPlayers,
		allPlayersReady: ({context}) => context.players.every((player) => player.isReady),
		canAddPlayer: ({context}) => context.players.length < context.maxPlayers,
		hasRng: ({context}) => context.rng !== null,
	},
}).createMachine({
	id: 'lobby',
	initial: 'waiting',
	context: {
		players: [],
		minPlayers: 2,
		maxPlayers: 4,
		rng: null,
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
					guard: and(['hasMinimumPlayers', 'allPlayersReady', 'hasRng']),
				},
			},
		},
		ready: {
			type: 'final',
		},
	},
})

export const setupMachine = setup({
	types: {
		context: {} as {players: Player[]},
	},
}).createMachine({
	id: 'setup',
	initial: 'shufflingPile',
	context: {
		players: [],
	},
	states: {
		shufflingPile: {
			type: 'final',
		},
	},
})
