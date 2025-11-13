import {createActor} from 'xstate'
import {describe, it, expect} from 'vitest'
import {Rng} from '@repo/rng'
import {lobbyMachine, setupMachine} from './machine'

describe('lobbyMachine', () => {
	it('should start in waiting state with empty players, no rng, and standard deck', () => {
		const actor = createActor(lobbyMachine)
		actor.start()

		expect(actor.getSnapshot().value).toBe('waiting')
		expect(actor.getSnapshot().context.players).toEqual([])
		expect(actor.getSnapshot().context.rng).toBe(null)
		expect(actor.getSnapshot().context.deck).toHaveLength(52)
		expect(actor.getSnapshot().context.deck[0]).toEqual({
			id: 'hearts-2',
			suit: 'hearts',
			rank: '2',
		})
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
			hand: [],
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

	it('should automatically initialize RNG with timestamp seed when START_GAME is sent without manual SEED', () => {
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

		expect(actor.getSnapshot().context.rng).toBe(null)

		const beforeTime = Date.now()
		actor.send({type: 'START_GAME'})
		const afterTime = Date.now()

		expect(actor.getSnapshot().value).toBe('ready')
		expect(actor.getSnapshot().context.rng).not.toBe(null)

		const seed = actor.getSnapshot().context.rng!.seed
		const seedNumber = parseInt(seed, 10)
		expect(seedNumber).toBeGreaterThanOrEqual(beforeTime)
		expect(seedNumber).toBeLessThanOrEqual(afterTime)
	})
})

describe('setupMachine', () => {
	const createTestPlayers = () => [
		{id: 'player-1', name: 'Alice', isReady: true, hand: []},
		{id: 'player-2', name: 'Bob', isReady: true, hand: []},
	]

	const createTestDeck = () => {
		return [
			{id: 'hearts-2', suit: 'hearts' as const, rank: '2' as const},
			{id: 'hearts-3', suit: 'hearts' as const, rank: '3' as const},
			{id: 'hearts-4', suit: 'hearts' as const, rank: '4' as const},
			{id: 'hearts-5', suit: 'hearts' as const, rank: '5' as const},
			{id: 'hearts-6', suit: 'hearts' as const, rank: '6' as const},
			{id: 'hearts-7', suit: 'hearts' as const, rank: '7' as const},
			{id: 'hearts-8', suit: 'hearts' as const, rank: '8' as const},
			{id: 'hearts-9', suit: 'hearts' as const, rank: '9' as const},
			{id: 'hearts-10', suit: 'hearts' as const, rank: '10' as const},
			{id: 'hearts-J', suit: 'hearts' as const, rank: 'J' as const},
		]
	}

	it('should shuffle the deck into draw pile with seeded RNG determinism', () => {
		const testRng = new Rng('shuffle-test-seed')
		const deck = createTestDeck()
		const originalOrder = [...deck]

		const actor = createActor(setupMachine, {
			input: {
				rng: testRng,
				players: createTestPlayers(),
				deck,
			},
		})
		actor.start()

		expect(actor.getSnapshot().value).toBe('shufflingPile')
		expect(actor.getSnapshot().context.drawPile).toEqual(originalOrder)

		actor.send({type: 'PILE_SHUFFLED'})

		const shuffled = actor.getSnapshot().context.drawPile
		expect(shuffled).toHaveLength(10)
		expect(shuffled).not.toEqual(originalOrder)

		const testRng2 = new Rng('shuffle-test-seed')
		const actor2 = createActor(setupMachine, {
			input: {
				rng: testRng2,
				players: createTestPlayers(),
				deck: createTestDeck(),
			},
		})
		actor2.start()
		actor2.send({type: 'PILE_SHUFFLED'})

		expect(actor2.getSnapshot().context.drawPile).toEqual(shuffled)
	})

	it('should deal 3 cards to each player from the draw pile', () => {
		const actor = createActor(setupMachine, {
			input: {
				rng: new Rng('deal-test-seed'),
				players: createTestPlayers(),
				deck: createTestDeck(),
			},
		})
		actor.start()

		actor.send({type: 'PILE_SHUFFLED'})
		expect(actor.getSnapshot().context.drawPile).toHaveLength(10)

		actor.send({type: 'CARDS_DEALT'})

		const context = actor.getSnapshot().context
		expect(context.players[0].hand).toHaveLength(3)
		expect(context.players[1].hand).toHaveLength(3)
		expect(context.drawPile).toHaveLength(4)

		const allCards = [
			...context.players[0].hand,
			...context.players[1].hand,
			...context.drawPile,
		]
		expect(allCards).toHaveLength(10)
	})

	it('should generate min and max thresholds using RNG', () => {
		const testRng = new Rng('threshold-test-seed')
		const actor = createActor(setupMachine, {
			input: {
				rng: testRng,
				players: createTestPlayers(),
				deck: createTestDeck(),
			},
		})
		actor.start()

		actor.send({type: 'PILE_SHUFFLED'})
		actor.send({type: 'CARDS_DEALT'})

		expect(actor.getSnapshot().context.minThreshold).toBe(0)
		expect(actor.getSnapshot().context.maxThreshold).toBe(0)

		actor.send({type: 'THRESHOLDS_SET'})

		const {minThreshold, maxThreshold} = actor.getSnapshot().context
		expect(minThreshold).toBeGreaterThanOrEqual(-20)
		expect(minThreshold).toBeLessThanOrEqual(-10)
		expect(maxThreshold).toBeGreaterThanOrEqual(30)
		expect(maxThreshold).toBeLessThanOrEqual(50)

		const testRng2 = new Rng('threshold-test-seed')
		const actor2 = createActor(setupMachine, {
			input: {
				rng: testRng2,
				players: createTestPlayers(),
				deck: createTestDeck(),
			},
		})
		actor2.start()
		actor2.send({type: 'PILE_SHUFFLED'})
		actor2.send({type: 'CARDS_DEALT'})
		actor2.send({type: 'THRESHOLDS_SET'})

		expect(actor2.getSnapshot().context.minThreshold).toBe(minThreshold)
		expect(actor2.getSnapshot().context.maxThreshold).toBe(maxThreshold)
	})

	it('should spin wheel based on force and add degrees to current angle', () => {
		const testRng = new Rng('wheel-spin-seed')
		const actor = createActor(setupMachine, {
			input: {
				rng: testRng,
				players: createTestPlayers(),
				deck: createTestDeck(),
			},
		})
		actor.start()

		actor.send({type: 'PILE_SHUFFLED'})
		actor.send({type: 'CARDS_DEALT'})
		actor.send({type: 'THRESHOLDS_SET'})

		expect(actor.getSnapshot().context.wheelAngle).toBe(90)

		actor.send({type: 'WHEEL_SPUN', force: 0.75})

		const newAngle = actor.getSnapshot().context.wheelAngle
		expect(newAngle).toBeGreaterThan(90)
		expect(newAngle).toBeLessThanOrEqual(450)

		const testRng2 = new Rng('wheel-spin-seed')
		const actor2 = createActor(setupMachine, {
			input: {
				rng: testRng2,
				players: createTestPlayers(),
				deck: createTestDeck(),
			},
		})
		actor2.start()
		actor2.send({type: 'PILE_SHUFFLED'})
		actor2.send({type: 'CARDS_DEALT'})
		actor2.send({type: 'THRESHOLDS_SET'})
		actor2.send({type: 'WHEEL_SPUN', force: 0.75})

		expect(actor2.getSnapshot().context.wheelAngle).toBe(newAngle)
	})

	it('should play first card from draw pile to discard pile and update score', () => {
		const actor = createActor(setupMachine, {
			input: {
				rng: new Rng('first-card-seed'),
				players: createTestPlayers(),
				deck: createTestDeck(),
			},
		})
		actor.start()

		actor.send({type: 'PILE_SHUFFLED'})
		actor.send({type: 'CARDS_DEALT'})
		actor.send({type: 'THRESHOLDS_SET'})
		actor.send({type: 'WHEEL_SPUN', force: 0.5})

		const beforeDrawPile = actor.getSnapshot().context.drawPile
		const topCard = beforeDrawPile[0]
		const drawPileLength = beforeDrawPile.length

		expect(actor.getSnapshot().context.discardPile).toHaveLength(0)
		expect(actor.getSnapshot().context.currentScore).toBe(0)

		actor.send({type: 'FIRST_CARD_PLAYED'})

		const context = actor.getSnapshot().context
		expect(context.drawPile).toHaveLength(drawPileLength - 1)
		expect(context.discardPile).toHaveLength(1)
		expect(context.discardPile[0]).toEqual(topCard)
		expect(context.currentScore).not.toBe(0)
		expect(actor.getSnapshot().value).toBe('complete')
	})

	it('should complete full setup flow with realistic game state', () => {
		const testRng = new Rng('full-setup-seed')
		const players = createTestPlayers()
		const deck = createTestDeck()

		const actor = createActor(setupMachine, {
			input: {
				rng: testRng,
				players,
				deck,
			},
		})
		actor.start()

		expect(actor.getSnapshot().value).toBe('shufflingPile')

		actor.send({type: 'PILE_SHUFFLED'})
		expect(actor.getSnapshot().value).toBe('dealingCards')

		actor.send({type: 'CARDS_DEALT'})
		expect(actor.getSnapshot().value).toBe('generatingThresholds')

		actor.send({type: 'THRESHOLDS_SET'})
		expect(actor.getSnapshot().value).toBe('spinningInitialWheel')

		actor.send({type: 'WHEEL_SPUN', force: 0.8})
		expect(actor.getSnapshot().value).toBe('playingFirstCard')

		actor.send({type: 'FIRST_CARD_PLAYED'})
		expect(actor.getSnapshot().value).toBe('complete')

		const finalContext = actor.getSnapshot().context
		expect(finalContext.players[0].hand).toHaveLength(3)
		expect(finalContext.players[1].hand).toHaveLength(3)
		expect(finalContext.drawPile.length).toBeGreaterThan(0)
		expect(finalContext.discardPile).toHaveLength(1)
		expect(finalContext.minThreshold).toBeLessThan(0)
		expect(finalContext.maxThreshold).toBeGreaterThan(0)
		expect(finalContext.wheelAngle).toBeGreaterThan(90)
		expect(finalContext.currentScore).not.toBe(0)
	})
})
