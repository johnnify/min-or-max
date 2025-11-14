import {createActor} from 'xstate'
import {describe, it, expect} from 'vitest'
import {Rng} from '@repo/rng'
import {setupMachine} from './setup'
import {createCard} from '../utils'

describe('setupMachine', () => {
	const createTestPlayers = () => [
		{id: 'player-1', name: 'Alice', isReady: true, hand: []},
		{id: 'player-2', name: 'Bob', isReady: true, hand: []},
	]

	const createTestDeck = () => [
		createCard('hearts', '2'),
		createCard('hearts', '3'),
		createCard('hearts', '4'),
		createCard('hearts', '5'),
		createCard('hearts', '6'),
		createCard('hearts', '7'),
		createCard('hearts', '8'),
		createCard('hearts', '9'),
		createCard('hearts', '10'),
		createCard('hearts', 'J'),
	]

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
		expect(context.discardPile[0].card).toEqual(topCard)
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
