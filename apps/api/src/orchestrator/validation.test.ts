import {describe, it, expect} from 'vitest'
import {createActor, type Actor} from 'xstate'
import {playingMachine, lobbyMachine} from '@repo/state'
import type {Player} from '@repo/state'
import {createCard, createPlayedCard} from '@repo/state'
import {Rng} from '@repo/rng'
import {canPlayerSendEvent} from './validation'

describe('canPlayerSendEvent', () => {
	const createPlayingActor = (): Actor<typeof playingMachine> => {
		const rng = new Rng('test-seed')
		const players: Player[] = [
			{
				id: 'player-1',
				name: 'Alice',
				isReady: true,
				hand: [createCard('hearts', '5'), createCard('hearts', '7')],
			},
			{
				id: 'player-2',
				name: 'Bob',
				isReady: true,
				hand: [createCard('diamonds', '4'), createCard('diamonds', '6')],
			},
		]

		const actor = createActor(playingMachine, {
			input: {
				rng,
				players,
				drawPile: [createCard('clubs', '2'), createCard('clubs', '3')],
				discardPile: [createPlayedCard(createCard('spades', '3'), 3)],
				minThreshold: -15,
				maxThreshold: 40,
				wheelAngle: 90,
				currentScore: 3,
				currentPlayerIndex: 0,
				hasSpunThisTurn: false,
			},
		})
		actor.start()
		return actor
	}

	it('should allow current player to choose a card during their turn', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'CHOOSE_CARD', cardId: 'hearts-5'},
			'player-1',
		)

		expect(result.allowed).toBe(true)
		expect(result.reason).toBeUndefined()
	})

	it('should prevent non-current player from choosing a card', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'CHOOSE_CARD', cardId: 'diamonds-4'},
			'player-2',
		)

		expect(result.allowed).toBe(false)
		expect(result.reason).toBe('Not your turn')
	})

	it('should allow any player to join during lobby phase', () => {
		const actor = createActor(lobbyMachine)
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

		const resultCurrentPlayer = canPlayerSendEvent(
			snapshot,
			{type: 'SURRENDER'},
			'player-1',
		)
		expect(resultCurrentPlayer.allowed).toBe(true)

		const resultOtherPlayer = canPlayerSendEvent(
			snapshot,
			{type: 'SURRENDER'},
			'player-2',
		)
		expect(resultOtherPlayer.allowed).toBe(true)
	})

	it('should prevent player from spinning wheel during their turn if already spun', () => {
		const actor = createPlayingActor()
		actor.send({type: 'SPIN_WHEEL', force: 0.5})
		const snapshot = actor.getSnapshot()

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'SPIN_WHEEL', force: 0.5},
			'player-1',
		)

		expect(result.allowed).toBe(false)
		expect(result.reason).toBe('Already spun this turn')
	})

	it('should allow player to spin wheel if they have not spun yet', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		expect(snapshot.context.hasSpunThisTurn).toBe(false)

		const result = canPlayerSendEvent(
			snapshot,
			{type: 'SPIN_WHEEL', force: 0.5},
			'player-1',
		)

		expect(result.allowed).toBe(true)
		expect(result.reason).toBeUndefined()
	})

	it('should prevent non-current player from playing a card', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		const result = canPlayerSendEvent(snapshot, {type: 'PLAY_CARD'}, 'player-2')

		expect(result.allowed).toBe(false)
		expect(result.reason).toBe('Not your turn')
	})

	it('should prevent non-current player from ending turn', () => {
		const actor = createPlayingActor()
		const snapshot = actor.getSnapshot()

		const result = canPlayerSendEvent(snapshot, {type: 'END_TURN'}, 'player-2')

		expect(result.allowed).toBe(false)
		expect(result.reason).toBe('Not your turn')
	})
})
