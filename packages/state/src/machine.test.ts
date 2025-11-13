import {createActor} from 'xstate'
import {describe, it, expect} from 'vitest'
import {lobbyMachine} from './machine'

describe('lobbyMachine', () => {
	it('should start in waiting state with empty players and no rng', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		expect(actor.getSnapshot().value).toBe('waiting')
		expect(actor.getSnapshot().context.players).toEqual([])
		expect(actor.getSnapshot().context.rng).toBe(null)
	})

	it('should add a player when PLAYER_JOINED is sent', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-1',
			playerName: 'Alice',
		})

		expect(actor.getSnapshot().context.players).toHaveLength(1)
		expect(actor.getSnapshot().context.players[0]).toEqual({
			id: 'player-1',
			name: 'Alice',
			isReady: false,
		})
	})

	it('should mark the correct player as ready when PLAYER_READY is sent', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-1',
			playerName: 'Alice',
		})

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-2',
			playerName: 'Bob',
		})

		actor.send({
			type: 'PLAYER_READY',
			playerId: 'player-1',
		})

		expect(actor.getSnapshot().context.players[0].isReady).toBe(true)
		expect(actor.getSnapshot().context.players[1].isReady).toBe(false)
	})

	it('should not transition to ready when START_GAME is sent without minimum players', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-1',
			playerName: 'Alice',
		})

		actor.send({
			type: 'PLAYER_READY',
			playerId: 'player-1',
		})

		actor.send({type: 'START_GAME'})

		expect(actor.getSnapshot().value).toBe('waiting')
	})

	it('should not transition to ready when START_GAME is sent without RNG being seeded', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-1',
			playerName: 'Alice',
		})

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-2',
			playerName: 'Bob',
		})

		actor.send({
			type: 'PLAYER_READY',
			playerId: 'player-1',
		})

		actor.send({
			type: 'PLAYER_READY',
			playerId: 'player-2',
		})

		actor.send({type: 'START_GAME'})

		expect(actor.getSnapshot().value).toBe('waiting')
	})

	it('should transition to ready when START_GAME is sent with enough ready players and RNG seeded', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-1',
			playerName: 'Alice',
		})

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-2',
			playerName: 'Bob',
		})

		actor.send({
			type: 'PLAYER_READY',
			playerId: 'player-1',
		})

		actor.send({
			type: 'PLAYER_READY',
			playerId: 'player-2',
		})

		actor.send({
			type: 'SEED',
			seed: 'game-seed-456',
		})

		actor.send({type: 'START_GAME'})

		expect(actor.getSnapshot().value).toBe('ready')
	})

	it('should not add more than 4 players', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		for (let i = 1; i <= 4; i++) {
			actor.send({
				type: 'PLAYER_JOINED',
				playerId: `player-${i}`,
				playerName: `Player ${i}`,
			})
		}

		expect(actor.getSnapshot().context.players).toHaveLength(4)

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-5',
			playerName: 'Player 5',
		})

		expect(actor.getSnapshot().context.players).toHaveLength(4)
	})

	it('should initialize RNG when SEED is sent', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		expect(actor.getSnapshot().context.rng).toBe(null)

		actor.send({
			type: 'SEED',
			seed: 'test-seed-123',
		})

		expect(actor.getSnapshot().context.rng).not.toBe(null)
		expect(actor.getSnapshot().context.rng?.seed).toBe('test-seed-123')
	})

	it('should mark a player as unready when PLAYER_UNREADY is sent', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-1',
			playerName: 'Alice',
		})

		actor.send({
			type: 'PLAYER_READY',
			playerId: 'player-1',
		})

		expect(actor.getSnapshot().context.players[0].isReady).toBe(true)

		actor.send({
			type: 'PLAYER_UNREADY',
			playerId: 'player-1',
		})

		expect(actor.getSnapshot().context.players[0].isReady).toBe(false)
	})

	it('should remove a player when PLAYER_DROPPED is sent', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-1',
			playerName: 'Alice',
		})

		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-2',
			playerName: 'Bob',
		})

		expect(actor.getSnapshot().context.players).toHaveLength(2)

		actor.send({
			type: 'PLAYER_DROPPED',
			playerId: 'player-1',
		})

		expect(actor.getSnapshot().context.players).toHaveLength(1)
		expect(actor.getSnapshot().context.players[0].id).toBe('player-2')
	})
})
