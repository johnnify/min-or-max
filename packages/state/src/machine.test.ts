import {createActor} from 'xstate'
import {describe, it, expect} from 'vitest'
import {lobbyMachine} from './machine'

describe('lobbyMachine', () => {
	it('should allow players to join, mark ready, and start game when all ready', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		// Initial state
		expect(actor.getSnapshot().value).toBe('waiting')
		expect(actor.getSnapshot().context.players).toHaveLength(0)

		// Player 1 joins
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

		// Player 2 joins
		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-2',
			playerName: 'Bob',
		})

		expect(actor.getSnapshot().context.players).toHaveLength(2)

		// Try to start game - should fail (players not ready)
		actor.send({type: 'START_GAME'})
		expect(actor.getSnapshot().value).toBe('waiting')

		// Player 1 marks ready
		actor.send({
			type: 'PLAYER_READY',
			playerId: 'player-1',
		})

		expect(actor.getSnapshot().context.players[0].isReady).toBe(true)
		expect(actor.getSnapshot().context.players[1].isReady).toBe(false)

		// Try to start game - should still fail (not all ready)
		actor.send({type: 'START_GAME'})
		expect(actor.getSnapshot().value).toBe('waiting')

		// Player 2 marks ready
		actor.send({
			type: 'PLAYER_READY',
			playerId: 'player-2',
		})

		expect(actor.getSnapshot().context.players[1].isReady).toBe(true)

		// Now game should start successfully
		actor.send({type: 'START_GAME'})
		expect(actor.getSnapshot().value).toBe('ready')
		expect(actor.getSnapshot().status).toBe('done')
	})

	it('should prevent adding more players than max allowed', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		// Add 4 players (max)
		for (let i = 1; i <= 4; i++) {
			actor.send({
				type: 'PLAYER_JOINED',
				playerId: `player-${i}`,
				playerName: `Player ${i}`,
			})
		}

		expect(actor.getSnapshot().context.players).toHaveLength(4)

		// Try to add 5th player - should be rejected by guard
		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-5',
			playerName: 'Player 5',
		})

		// Should still have only 4 players
		expect(actor.getSnapshot().context.players).toHaveLength(4)
	})

	it('should require minimum 2 players to start game', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		// Add only 1 player
		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-1',
			playerName: 'Alice',
		})

		// Mark ready
		actor.send({
			type: 'PLAYER_READY',
			playerId: 'player-1',
		})

		// Try to start game - should fail (need minimum 2 players)
		actor.send({type: 'START_GAME'})
		expect(actor.getSnapshot().value).toBe('waiting')
	})
})
