import {describe, it, expect} from 'vitest'
import {createActor} from 'xstate'
import {lobbyMachine, setupMachine, playingMachine} from '@repo/state'
import type {SetupInput, PlayingInput} from '@repo/state'
import {getNextPhase, createTransitionInput} from './transitions'

describe('getNextPhase', () => {
	it('should return "setup" when lobby machine is in ready state', () => {
		const actor = createActor(lobbyMachine)
		actor.start()
		actor.send({type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice'})
		actor.send({type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob'})
		actor.send({type: 'PLAYER_READY', playerId: 'p1'})
		actor.send({type: 'PLAYER_READY', playerId: 'p2'})
		actor.send({type: 'SEED', seed: 'test-seed'})
		actor.send({type: 'START_GAME'})

		const snapshot = actor.getSnapshot()
		const nextPhase = getNextPhase(snapshot)

		expect(nextPhase).toBe('setup')
	})

	it('should return "playing" when setup machine is in complete state', () => {
		const actor = createActor(lobbyMachine)
		actor.start()
		actor.send({type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice'})
		actor.send({type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob'})
		actor.send({type: 'PLAYER_READY', playerId: 'p1'})
		actor.send({type: 'PLAYER_READY', playerId: 'p2'})
		actor.send({type: 'SEED', seed: 'test-seed'})
		actor.send({type: 'START_GAME'})

		const lobbySnapshot = actor.getSnapshot()
		const setupActor = createActor(setupMachine, {
			input: {
				rng: lobbySnapshot.context.rng!,
				players: lobbySnapshot.context.players,
				deck: lobbySnapshot.context.deck,
			},
		})
		setupActor.start()
		setupActor.send({type: 'PILE_SHUFFLED'})
		setupActor.send({type: 'CARDS_DEALT'})
		setupActor.send({type: 'THRESHOLDS_SET'})
		setupActor.send({type: 'WHEEL_SPUN', force: 0.5})
		setupActor.send({type: 'FIRST_CARD_PLAYED'})

		const snapshot = setupActor.getSnapshot()
		const nextPhase = getNextPhase(snapshot)

		expect(nextPhase).toBe('playing')
	})

	it('should return "gameOver" when playing machine is in gameOver state', () => {
		const actor = createActor(lobbyMachine)
		actor.start()
		actor.send({type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice'})
		actor.send({type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob'})
		actor.send({type: 'PLAYER_READY', playerId: 'p1'})
		actor.send({type: 'PLAYER_READY', playerId: 'p2'})
		actor.send({type: 'SEED', seed: 'test-seed'})
		actor.send({type: 'START_GAME'})

		const lobbySnapshot = actor.getSnapshot()
		const setupActor = createActor(setupMachine, {
			input: {
				rng: lobbySnapshot.context.rng!,
				players: lobbySnapshot.context.players,
				deck: lobbySnapshot.context.deck,
			},
		})
		setupActor.start()
		setupActor.send({type: 'PILE_SHUFFLED'})
		setupActor.send({type: 'CARDS_DEALT'})
		setupActor.send({type: 'THRESHOLDS_SET'})
		setupActor.send({type: 'WHEEL_SPUN', force: 0.5})
		setupActor.send({type: 'FIRST_CARD_PLAYED'})

		const setupSnapshot = setupActor.getSnapshot()
		const playingActor = createActor(playingMachine, {
			input: {
				rng: setupSnapshot.context.rng!,
				players: setupSnapshot.context.players,
				drawPile: setupSnapshot.context.drawPile,
				discardPile: setupSnapshot.context.discardPile,
				minThreshold: setupSnapshot.context.minThreshold,
				maxThreshold: setupSnapshot.context.maxThreshold,
				wheelAngle: setupSnapshot.context.wheelAngle,
				currentScore: setupSnapshot.context.currentScore,
				currentPlayerIndex: 0,
				hasSpunThisTurn: false,
			},
		})
		playingActor.start()
		playingActor.send({type: 'SURRENDER'})

		const snapshot = playingActor.getSnapshot()
		const nextPhase = getNextPhase(snapshot)

		expect(nextPhase).toBe('gameOver')
	})

	it('should return null when lobby machine is still in waiting state', () => {
		const actor = createActor(lobbyMachine)
		actor.start()
		actor.send({type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice'})

		const snapshot = actor.getSnapshot()
		const nextPhase = getNextPhase(snapshot)

		expect(nextPhase).toBe(null)
	})

	it('should return null when setup machine is not yet complete', () => {
		const actor = createActor(lobbyMachine)
		actor.start()
		actor.send({type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice'})
		actor.send({type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob'})
		actor.send({type: 'PLAYER_READY', playerId: 'p1'})
		actor.send({type: 'PLAYER_READY', playerId: 'p2'})
		actor.send({type: 'SEED', seed: 'test-seed'})
		actor.send({type: 'START_GAME'})

		const lobbySnapshot = actor.getSnapshot()
		const setupActor = createActor(setupMachine, {
			input: {
				rng: lobbySnapshot.context.rng!,
				players: lobbySnapshot.context.players,
				deck: lobbySnapshot.context.deck,
			},
		})
		setupActor.start()
		setupActor.send({type: 'PILE_SHUFFLED'})

		const snapshot = setupActor.getSnapshot()
		const nextPhase = getNextPhase(snapshot)

		expect(nextPhase).toBe(null)
	})
})

describe('createTransitionInput', () => {
	it('should create setup input from lobby snapshot', () => {
		const actor = createActor(lobbyMachine)
		actor.start()
		actor.send({type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice'})
		actor.send({type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob'})
		actor.send({type: 'PLAYER_READY', playerId: 'p1'})
		actor.send({type: 'PLAYER_READY', playerId: 'p2'})
		actor.send({type: 'SEED', seed: 'test-seed'})
		actor.send({type: 'START_GAME'})

		const snapshot = actor.getSnapshot()
		const input = createTransitionInput('setup', snapshot) as SetupInput

		expect(input).toMatchObject({
			rng: expect.any(Object),
			players: expect.arrayContaining([
				expect.objectContaining({id: 'p1', name: 'Alice'}),
				expect.objectContaining({id: 'p2', name: 'Bob'}),
			]),
			deck: expect.any(Array),
		})
		expect(input.players).toHaveLength(2)
		expect(input.deck.length).toBeGreaterThan(0)
	})

	it('should create playing input from setup snapshot', () => {
		const actor = createActor(lobbyMachine)
		actor.start()
		actor.send({type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice'})
		actor.send({type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob'})
		actor.send({type: 'PLAYER_READY', playerId: 'p1'})
		actor.send({type: 'PLAYER_READY', playerId: 'p2'})
		actor.send({type: 'SEED', seed: 'test-seed'})
		actor.send({type: 'START_GAME'})

		const lobbySnapshot = actor.getSnapshot()
		const setupActor = createActor(setupMachine, {
			input: {
				rng: lobbySnapshot.context.rng!,
				players: lobbySnapshot.context.players,
				deck: lobbySnapshot.context.deck,
			},
		})
		setupActor.start()
		setupActor.send({type: 'PILE_SHUFFLED'})
		setupActor.send({type: 'CARDS_DEALT'})
		setupActor.send({type: 'THRESHOLDS_SET'})
		setupActor.send({type: 'WHEEL_SPUN', force: 0.5})
		setupActor.send({type: 'FIRST_CARD_PLAYED'})

		const snapshot = setupActor.getSnapshot()
		const input = createTransitionInput('playing', snapshot) as PlayingInput

		expect(input).toMatchObject({
			rng: expect.any(Object),
			players: expect.arrayContaining([
				expect.objectContaining({id: 'p1'}),
				expect.objectContaining({id: 'p2'}),
			]),
			drawPile: expect.any(Array),
			discardPile: expect.any(Array),
			minThreshold: expect.any(Number),
			maxThreshold: expect.any(Number),
			wheelAngle: expect.any(Number),
			currentScore: expect.any(Number),
			currentPlayerIndex: 0,
			hasSpunThisTurn: false,
		})
		expect(input.players[0].hand).toHaveLength(3)
		expect(input.players[1].hand).toHaveLength(3)
		expect(input.discardPile).toHaveLength(1)
	})

	it('should return null for unsupported transitions', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		const snapshot = actor.getSnapshot()
		const input = createTransitionInput('gameOver', snapshot)

		expect(input).toBe(null)
	})

	it('should return null when trying to create playing input from lobby', () => {
		const actor = createActor(lobbyMachine)
		actor.start()
		actor.send({type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice'})
		actor.send({type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob'})
		actor.send({type: 'PLAYER_READY', playerId: 'p1'})
		actor.send({type: 'PLAYER_READY', playerId: 'p2'})
		actor.send({type: 'START_GAME'})

		const snapshot = actor.getSnapshot()
		const input = createTransitionInput('playing', snapshot)

		expect(input).toBe(null)
	})
})
