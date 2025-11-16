import {describe, it, expect} from 'vitest'
import {createActor, type Actor} from 'xstate'
import {minOrMaxMachine} from '@repo/state'
import {canPlayerSendEvent} from './validation'

describe('canPlayerSendEvent', () => {
	const createPlayingActor = (): Actor<typeof minOrMaxMachine> => {
		const actor = createActor(minOrMaxMachine)
		actor.start()

		// Transition through lobby phase
		actor.send({
			type: 'PLAYER_JOINED',
			playerId: 'player-1',
			playerName: 'Alice',
		})
		actor.send({type: 'PLAYER_JOINED', playerId: 'player-2', playerName: 'Bob'})
		actor.send({type: 'PLAYER_READY', playerId: 'player-1'})
		actor.send({type: 'PLAYER_READY', playerId: 'player-2'})
		actor.send({type: 'SEED', seed: 'test-seed'})
		actor.send({type: 'START_GAME'})

		// Transition through setup phase (automated events)
		actor.send({type: 'PILE_SHUFFLED'})
		actor.send({type: 'CARDS_DEALT'})
		actor.send({type: 'THRESHOLDS_SET'})
		actor.send({type: 'WHEEL_SPUN', force: 0.5})
		actor.send({type: 'FIRST_CARD_PLAYED'})

		// Now in playing phase
		return actor
	}

	it('should allow current player to choose a card during their turn', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		const currentPlayer =
			snapshot.context.players[snapshot.context.currentPlayerIndex]
		const cardId = currentPlayer.hand[0].id

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'CHOOSE_CARD', cardId},
			currentPlayer.id,
		)

		expect(result.allowed).toBe(true)
		expect(result.reason).toBeUndefined()
	})

	it('should prevent non-current player from choosing a card', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		const currentPlayerIndex = snapshot.context.currentPlayerIndex
		const nonCurrentPlayerIndex = currentPlayerIndex === 0 ? 1 : 0
		const nonCurrentPlayer = snapshot.context.players[nonCurrentPlayerIndex]
		const cardId = nonCurrentPlayer.hand[0].id

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'CHOOSE_CARD', cardId},
			nonCurrentPlayer.id,
		)

		expect(result.allowed).toBe(false)
		expect(result.reason).toBe('Not your turn')
	})

	it('should allow any player to join during lobby phase', () => {
		const actor = createActor(minOrMaxMachine)
		actor.start()
		const snapshot = actor.getSnapshot()

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'PLAYER_JOINED', playerId: 'new-player', playerName: 'Charlie'},
			'new-player',
		)

		expect(result.allowed).toBe(true)
	})

	it('should allow any player to surrender during playing phase', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		const currentPlayer =
			snapshot.context.players[snapshot.context.currentPlayerIndex]
		const otherPlayerIndex = snapshot.context.currentPlayerIndex === 0 ? 1 : 0
		const otherPlayer = snapshot.context.players[otherPlayerIndex]

		const resultCurrentPlayer = canPlayerSendEvent(
			snapshot,
			{type: 'SURRENDER'},
			currentPlayer.id,
		)
		expect(resultCurrentPlayer.allowed).toBe(true)

		const resultOtherPlayer = canPlayerSendEvent(
			snapshot,
			{type: 'SURRENDER'},
			otherPlayer.id,
		)
		expect(resultOtherPlayer.allowed).toBe(true)
	})

	it('should prevent player from spinning wheel during their turn if already spun', () => {
		const actor = createPlayingActor()
		const currentPlayer =
			actor.getSnapshot().context.players[
				actor.getSnapshot().context.currentPlayerIndex
			]

		actor.send({type: 'SPIN_WHEEL', force: 0.5})
		const snapshot = actor.getSnapshot()

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'SPIN_WHEEL', force: 0.5},
			currentPlayer.id,
		)

		expect(result.allowed).toBe(false)
		expect(result.reason).toBe('Already spun this turn')
	})

	it('should allow player to spin wheel if they have not spun yet', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		expect(snapshot.context.hasSpunThisTurn).toBe(false)

		const currentPlayer =
			snapshot.context.players[snapshot.context.currentPlayerIndex]

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'SPIN_WHEEL', force: 0.5},
			currentPlayer.id,
		)

		expect(result.allowed).toBe(true)
		expect(result.reason).toBeUndefined()
	})

	it('should prevent non-current player from playing a card', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		const currentPlayerIndex = snapshot.context.currentPlayerIndex
		const nonCurrentPlayerIndex = currentPlayerIndex === 0 ? 1 : 0
		const nonCurrentPlayer = snapshot.context.players[nonCurrentPlayerIndex]

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'PLAY_CARD'},
			nonCurrentPlayer.id,
		)

		expect(result.allowed).toBe(false)
		expect(result.reason).toBe('Not your turn')
	})

	it('should prevent non-current player from ending turn', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		const currentPlayerIndex = snapshot.context.currentPlayerIndex
		const nonCurrentPlayerIndex = currentPlayerIndex === 0 ? 1 : 0
		const nonCurrentPlayer = snapshot.context.players[nonCurrentPlayerIndex]

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'END_TURN'},
			nonCurrentPlayer.id,
		)

		expect(result.allowed).toBe(false)
		expect(result.reason).toBe('Not your turn')
	})
})
