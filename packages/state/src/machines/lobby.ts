import {and, assign, enqueueActions, setup} from 'xstate'
import {Rng} from '@repo/rng'
import {createStandardDeck} from '../utils'
import type {Card, Player, LobbyEvent} from '../types'

export type LobbyContext = {
	players: Player[]
	minPlayers: number
	maxPlayers: number
	rng: Rng | null
	deck: Card[]
}

export const lobbyMachine = setup({
	types: {
		context: {} as LobbyContext,
		events: {} as LobbyEvent,
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
