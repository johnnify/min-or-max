import {assign, setup} from 'xstate'

export type Player = {
	id: string
	name: string
	isReady: boolean
}

export type LobbyContext = {
	players: Player[]
	minPlayers: number
	maxPlayers: number
}

export type LobbyEvent =
	| {type: 'PLAYER_JOINED'; playerId: string; playerName: string}
	| {type: 'PLAYER_READY'; playerId: string}
	| {type: 'START_GAME'}

export const lobbyMachine = setup({
	types: {
		context: {} as LobbyContext,
		events: {} as LobbyEvent,
	},
	guards: {
		hasMinimumPlayers: ({context}) =>
			context.players.length >= context.minPlayers,
		allPlayersReady: ({context}) =>
			context.players.length >= context.minPlayers &&
			context.players.every((player) => player.isReady),
		canAddPlayer: ({context}) => context.players.length < context.maxPlayers,
	},
	actions: {
		addPlayer: assign({
			players: ({context, event}) => {
				if (event.type !== 'PLAYER_JOINED') return context.players

				const newPlayer: Player = {
					id: event.playerId,
					name: event.playerName,
					isReady: false,
				}

				return [...context.players, newPlayer]
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
	},
}).createMachine({
	id: 'lobby',
	initial: 'waiting',
	context: {
		players: [],
		minPlayers: 2,
		maxPlayers: 4,
	},
	states: {
		waiting: {
			on: {
				PLAYER_JOINED: {
					guard: 'canAddPlayer',
					actions: 'addPlayer',
				},
				PLAYER_READY: {
					actions: 'markPlayerReady',
				},
				START_GAME: {
					target: 'ready',
					guard: 'allPlayersReady',
				},
			},
		},
		ready: {
			type: 'final',
		},
	},
})
