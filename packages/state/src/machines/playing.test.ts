import {createActor} from 'xstate'
import {describe, it, expect} from 'vitest'
import {Rng} from '@repo/rng'
import {playingMachine} from './playing'
import {createCard, createPlayedCard} from '../utils'

describe('playingMachine', () => {
	const createGameState = () => {
		const rng = new Rng('playing-test-seed')
		const players = [
			{
				id: 'player-1',
				name: 'Alice',
				isReady: true,
				hand: [
					createCard('hearts', '5'),
					createCard('hearts', '7'),
					createCard('hearts', '9'),
				],
			},
			{
				id: 'player-2',
				name: 'Bob',
				isReady: true,
				hand: [
					createCard('diamonds', '4'),
					createCard('diamonds', '6'),
					createCard('diamonds', '8'),
				],
			},
		]
		const drawPile = [
			createCard('clubs', '2'),
			createCard('clubs', '3'),
			createCard('clubs', '4'),
		]
		const discardPile = [createPlayedCard(createCard('spades', '3'), 3)]

		return {
			rng,
			players,
			drawPile,
			discardPile,
			minThreshold: -15,
			maxThreshold: 40,
			wheelAngle: 90,
			currentScore: 3,
			currentPlayerIndex: 0,
			hasSpunThisTurn: false,
		}
	}

	it('should draw a card for the current player at turn start', () => {
		const gameState = createGameState()
		const actor = createActor(playingMachine, {
			input: gameState,
		})
		actor.start()

		expect(actor.getSnapshot().value).toBe('turnStart')

		const drawPileBefore = actor.getSnapshot().context.drawPile.length
		const handBefore = actor.getSnapshot().context.players[0].hand.length

		actor.send({type: 'TURN_STARTED'})

		const context = actor.getSnapshot().context
		expect(context.drawPile).toHaveLength(drawPileBefore - 1)
		expect(context.players[0].hand).toHaveLength(handBefore + 1)
		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'awaitingAction',
		})
	})

	it('should allow player to choose and play a valid card', () => {
		const gameState = createGameState()
		const actor = createActor(playingMachine, {
			input: gameState,
		})
		actor.start()

		actor.send({type: 'TURN_STARTED'})
		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'awaitingAction',
		})

		const cardToPlay = gameState.players[0].hand[0]
		actor.send({type: 'CHOOSE_CARD', cardId: cardToPlay.id})

		const context = actor.getSnapshot().context
		expect(context.chosenCard).toEqual(cardToPlay)
		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'readyToPlay',
		})
	})

	it('should play chosen card to discard pile, remove from hand, and update score', () => {
		const gameState = createGameState()
		const actor = createActor(playingMachine, {
			input: gameState,
		})
		actor.start()

		actor.send({type: 'TURN_STARTED'})

		const handBefore = actor.getSnapshot().context.players[0].hand.length
		const discardBefore = actor.getSnapshot().context.discardPile.length
		const scoreBefore = actor.getSnapshot().context.currentScore

		const cardToPlay = actor.getSnapshot().context.players[0].hand[1]
		actor.send({type: 'CHOOSE_CARD', cardId: cardToPlay.id})

		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'readyToPlay',
		})

		actor.send({type: 'PLAY_CARD'})

		const context = actor.getSnapshot().context
		expect(context.players[0].hand).toHaveLength(handBefore - 1)
		expect(
			context.players[0].hand.find((c) => c.id === cardToPlay.id),
		).toBeUndefined()
		expect(context.discardPile).toHaveLength(discardBefore + 1)
		expect(context.discardPile[0].card).toEqual(cardToPlay)
		expect(context.currentScore).not.toBe(scoreBefore)
		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'postCardPlay',
		})
	})

	it('should complete full turn and advance to next player', () => {
		const gameState = createGameState()
		const actor = createActor(playingMachine, {
			input: gameState,
		})
		actor.start()

		expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0)

		actor.send({type: 'TURN_STARTED'})
		actor.send({type: 'CHOOSE_CARD', cardId: gameState.players[0].hand[0].id})
		actor.send({type: 'PLAY_CARD'})

		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'postCardPlay',
		})

		actor.send({type: 'END_TURN'})

		expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1)
		expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(false)
		expect(actor.getSnapshot().context.chosenCard).toBe(null)
		expect(actor.getSnapshot().value).toBe('turnStart')
	})

	it('should handle complete multi-player game flow across multiple turns', () => {
		const gameState = createGameState()
		const actor = createActor(playingMachine, {
			input: gameState,
		})
		actor.start()

		expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0)
		expect(actor.getSnapshot().context.players[0].name).toBe('Alice')
		expect(actor.getSnapshot().context.players[1].name).toBe('Bob')

		actor.send({type: 'TURN_STARTED'})
		const aliceCardToPlay = actor.getSnapshot().context.players[0].hand[0]
		actor.send({type: 'CHOOSE_CARD', cardId: aliceCardToPlay.id})
		actor.send({type: 'PLAY_CARD'})
		const scoreAfterAlice = actor.getSnapshot().context.currentScore

		actor.send({type: 'END_TURN'})

		expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1)
		expect(actor.getSnapshot().value).toBe('turnStart')

		actor.send({type: 'TURN_STARTED'})
		expect(actor.getSnapshot().context.players[1].hand).toHaveLength(4)

		const bobValidCard = actor
			.getSnapshot()
			.context.players[1].hand.find((card) => card.id === 'diamonds-6')
		expect(bobValidCard).toBeDefined()
		actor.send({type: 'CHOOSE_CARD', cardId: bobValidCard!.id})
		actor.send({type: 'PLAY_CARD'})

		const scoreAfterBob = actor.getSnapshot().context.currentScore
		expect(scoreAfterBob).not.toBe(scoreAfterAlice)
		expect(actor.getSnapshot().context.discardPile[0].card).toEqual(
			bobValidCard,
		)
		expect(actor.getSnapshot().context.discardPile[1].card).toEqual(
			aliceCardToPlay,
		)

		actor.send({type: 'END_TURN'})

		expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0)
		expect(actor.getSnapshot().value).toBe('turnStart')
	})

	it('should allow player to spin the wheel during their turn', () => {
		const gameState = createGameState()
		const actor = createActor(playingMachine, {input: gameState}).start()

		actor.send({type: 'TURN_STARTED'})

		const initialWheelAngle = actor.getSnapshot().context.wheelAngle
		expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(false)

		actor.send({type: 'SPIN_WHEEL', force: 0.5})

		expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(true)
		expect(actor.getSnapshot().context.wheelAngle).not.toBe(initialWheelAngle)
		expect(actor.getSnapshot().context.wheelAngle).toBeGreaterThan(
			initialWheelAngle,
		)
	})

	it('should prevent playing a card that is too low when wheel is on max mode', () => {
		const gameState = createGameState()
		gameState.wheelAngle = 90
		gameState.discardPile = [createPlayedCard(createCard('spades', '9'), 9)]
		gameState.players[0].hand = [
			createCard('hearts', '8'),
			createCard('hearts', '10'),
		]

		const actor = createActor(playingMachine, {input: gameState}).start()
		actor.send({type: 'TURN_STARTED'})

		actor.send({type: 'CHOOSE_CARD', cardId: 'hearts-8'})

		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'awaitingAction',
		})
		expect(actor.getSnapshot().context.chosenCard).toBe(null)
	})

	it('should allow playing a card that is equal or higher when wheel is on max mode', () => {
		const gameState = createGameState()
		gameState.wheelAngle = 90
		gameState.discardPile = [createPlayedCard(createCard('spades', '9'), 9)]
		gameState.players[0].hand = [
			createCard('hearts', '9'),
			createCard('hearts', '10'),
		]

		const actor = createActor(playingMachine, {input: gameState}).start()
		actor.send({type: 'TURN_STARTED'})

		actor.send({type: 'CHOOSE_CARD', cardId: 'hearts-9'})

		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'readyToPlay',
		})
		expect(actor.getSnapshot().context.chosenCard).toEqual(
			createCard('hearts', '9'),
		)
	})

	it('should prevent playing a card that is too high when wheel is on min mode', () => {
		const gameState = createGameState()
		gameState.wheelAngle = 270
		gameState.discardPile = [createPlayedCard(createCard('spades', '5'), 5)]
		gameState.players[0].hand = [
			createCard('hearts', '6'),
			createCard('hearts', '4'),
		]

		const actor = createActor(playingMachine, {input: gameState}).start()
		actor.send({type: 'TURN_STARTED'})

		actor.send({type: 'CHOOSE_CARD', cardId: 'hearts-6'})

		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'awaitingAction',
		})
		expect(actor.getSnapshot().context.chosenCard).toBe(null)
	})

	it('should allow playing a card that is equal or lower when wheel is on min mode', () => {
		const gameState = createGameState()
		gameState.wheelAngle = 270
		gameState.discardPile = [createPlayedCard(createCard('spades', '5'), 5)]
		gameState.players[0].hand = [
			createCard('hearts', '5'),
			createCard('hearts', '4'),
		]

		const actor = createActor(playingMachine, {input: gameState}).start()
		actor.send({type: 'TURN_STARTED'})

		actor.send({type: 'CHOOSE_CARD', cardId: 'hearts-4'})

		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'readyToPlay',
		})
		expect(actor.getSnapshot().context.chosenCard).toEqual(
			createCard('hearts', '4'),
		)
	})

	it('should allow playing an Ace on any card', () => {
		const gameState = createGameState()
		gameState.wheelAngle = 90
		gameState.discardPile = [createPlayedCard(createCard('spades', 'K'), 10)]
		gameState.players[0].hand = [
			createCard('hearts', 'A'),
			createCard('hearts', '2'),
		]

		const actor = createActor(playingMachine, {input: gameState}).start()
		actor.send({type: 'TURN_STARTED'})

		actor.send({type: 'CHOOSE_CARD', cardId: 'hearts-A'})

		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'configuringEffect',
		})
		expect(actor.getSnapshot().context.chosenCard?.rank).toBe('A')
	})

	it('should allow playing any card on top of an Ace', () => {
		const gameState = createGameState()
		gameState.wheelAngle = 90
		gameState.discardPile = [createPlayedCard(createCard('spades', 'A'), 11)]
		gameState.players[0].hand = [
			createCard('hearts', '2'),
			createCard('hearts', 'K'),
		]

		const actor = createActor(playingMachine, {input: gameState}).start()
		actor.send({type: 'TURN_STARTED'})

		actor.send({type: 'CHOOSE_CARD', cardId: 'hearts-2'})

		expect(actor.getSnapshot().value).toMatchObject({
			playerTurn: 'readyToPlay',
		})
		expect(actor.getSnapshot().context.chosenCard).toEqual(
			createCard('hearts', '2'),
		)
	})

	describe('draw pile reshuffling', () => {
		it('should reshuffle discard pile into draw pile when draw pile is empty at turn start', () => {
			const gameState = createGameState()
			gameState.drawPile = []
			gameState.discardPile = [
				createPlayedCard(createCard('hearts', '5'), 5),
				createPlayedCard(createCard('spades', '7'), 7),
				createPlayedCard(createCard('clubs', '9'), 9),
				createPlayedCard(createCard('diamonds', '3'), 3),
			]

			const actor = createActor(playingMachine, {input: gameState}).start()

			expect(actor.getSnapshot().context.drawPile).toHaveLength(0)
			expect(actor.getSnapshot().context.discardPile).toHaveLength(4)

			actor.send({type: 'TURN_STARTED'})

			const context = actor.getSnapshot().context
			expect(context.drawPile).toHaveLength(2)
			expect(context.discardPile).toHaveLength(1)
			expect(context.discardPile[0].card.rank).toBe('5')
			expect(context.players[0].hand).toHaveLength(4)
		})

		it('should not reshuffle when draw pile has cards', () => {
			const gameState = createGameState()
			gameState.drawPile = [createCard('hearts', 'K')]
			gameState.discardPile = [
				createPlayedCard(createCard('spades', '5'), 5),
				createPlayedCard(createCard('clubs', '7'), 7),
			]

			const actor = createActor(playingMachine, {input: gameState}).start()

			actor.send({type: 'TURN_STARTED'})

			const context = actor.getSnapshot().context
			expect(context.drawPile).toHaveLength(0)
			expect(context.discardPile).toHaveLength(2)
			expect(context.players[0].hand).toHaveLength(4)
		})
	})

	describe('post-card-play wheel spinning', () => {
		it('should allow spinning wheel after playing card if not spun this turn', () => {
			const gameState = createGameState()
			gameState.wheelAngle = 90
			gameState.hasSpunThisTurn = false

			const actor = createActor(playingMachine, {input: gameState}).start()
			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'CHOOSE_CARD', cardId: gameState.players[0].hand[0].id})
			actor.send({type: 'PLAY_CARD'})

			expect(actor.getSnapshot().value).toMatchObject({
				playerTurn: 'postCardPlay',
			})

			const wheelAngleBefore = actor.getSnapshot().context.wheelAngle
			expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(false)

			actor.send({type: 'SPIN_WHEEL', force: 0.5})

			expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(true)
			expect(actor.getSnapshot().context.wheelAngle).toBeGreaterThan(
				wheelAngleBefore,
			)
			expect(actor.getSnapshot().value).toMatchObject({
				playerTurn: 'postCardPlay',
			})

			actor.send({type: 'END_TURN'})
			expect(actor.getSnapshot().value).toBe('turnStart')
		})

		it('should not allow spinning wheel after playing card if already spun this turn', () => {
			const gameState = createGameState()
			gameState.wheelAngle = 90
			gameState.hasSpunThisTurn = false

			const actor = createActor(playingMachine, {input: gameState}).start()
			actor.send({type: 'TURN_STARTED'})

			actor.send({type: 'SPIN_WHEEL', force: 0.05})
			expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(true)

			const currentWheelAngle = actor.getSnapshot().context.wheelAngle
			const wheelMode = currentWheelAngle >= 180 ? 'min' : 'max'
			const topCard = actor.getSnapshot().context.discardPile[0].card
			const hand = actor.getSnapshot().context.players[0].hand

			const validCard = hand.find((c) => {
				if (c.rank === 'A') return true
				const cardValue =
					c.rank === 'J' || c.rank === 'Q' || c.rank === 'K'
						? 10
						: parseInt(c.rank, 10)
				const topValue =
					topCard.rank === 'J' || topCard.rank === 'Q' || topCard.rank === 'K'
						? 10
						: parseInt(topCard.rank, 10)
				return wheelMode === 'max'
					? cardValue >= topValue
					: cardValue <= topValue
			})

			actor.send({type: 'CHOOSE_CARD', cardId: validCard!.id})
			actor.send({type: 'PLAY_CARD'})

			expect(actor.getSnapshot().value).toMatchObject({
				playerTurn: 'postCardPlay',
			})

			const wheelAngleBefore = actor.getSnapshot().context.wheelAngle

			actor.send({type: 'SPIN_WHEEL', force: 0.8})

			expect(actor.getSnapshot().context.wheelAngle).toBe(wheelAngleBefore)
			expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(true)
		})
	})

	describe('win conditions', () => {
		it('should transition to gameOver when score exactly matches maxThreshold', () => {
			const gameState = createGameState()
			gameState.maxThreshold = 15
			gameState.currentScore = 10
			gameState.wheelAngle = 90
			gameState.discardPile = [createPlayedCard(createCard('hearts', '3'), 3)]
			gameState.players[0].hand = [createCard('spades', '5')]

			const actor = createActor(playingMachine, {input: gameState}).start()
			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'CHOOSE_CARD', cardId: 'spades-5'})
			actor.send({type: 'PLAY_CARD'})

			expect(actor.getSnapshot().context.currentScore).toBe(15)
			expect(actor.getSnapshot().value).toBe('gameOver')
			expect(actor.getSnapshot().context.winner?.id).toBe('player-1')
			expect(actor.getSnapshot().context.losers).toHaveLength(1)
			expect(actor.getSnapshot().context.losers[0].id).toBe('player-2')
			expect(actor.getSnapshot().context.reason).toBe('exact_threshold')
		})

		it('should transition to gameOver when score exactly matches minThreshold', () => {
			const gameState = createGameState()
			gameState.minThreshold = -15
			gameState.currentScore = -10
			gameState.wheelAngle = 270
			gameState.discardPile = [createPlayedCard(createCard('hearts', '7'), -7)]
			gameState.players[0].hand = [createCard('spades', '5')]

			const actor = createActor(playingMachine, {input: gameState}).start()
			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'CHOOSE_CARD', cardId: 'spades-5'})
			actor.send({type: 'PLAY_CARD'})

			expect(actor.getSnapshot().context.currentScore).toBe(-15)
			expect(actor.getSnapshot().value).toBe('gameOver')
			expect(actor.getSnapshot().context.winner?.id).toBe('player-1')
			expect(actor.getSnapshot().context.losers).toHaveLength(1)
			expect(actor.getSnapshot().context.losers[0].id).toBe('player-2')
			expect(actor.getSnapshot().context.reason).toBe('exact_threshold')
		})
	})

	describe('loss conditions', () => {
		it('should transition to gameOver when score exceeds maxThreshold', () => {
			const gameState = createGameState()
			gameState.maxThreshold = 15
			gameState.currentScore = 10
			gameState.wheelAngle = 90
			gameState.discardPile = [createPlayedCard(createCard('hearts', '3'), 3)]
			gameState.players[0].hand = [createCard('spades', '7')]

			const actor = createActor(playingMachine, {input: gameState}).start()
			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'CHOOSE_CARD', cardId: 'spades-7'})
			actor.send({type: 'PLAY_CARD'})

			expect(actor.getSnapshot().context.currentScore).toBe(17)
			expect(actor.getSnapshot().value).toBe('gameOver')
			expect(actor.getSnapshot().context.winner?.id).toBe('player-2')
			expect(actor.getSnapshot().context.losers).toHaveLength(1)
			expect(actor.getSnapshot().context.losers[0].id).toBe('player-1')
			expect(actor.getSnapshot().context.reason).toBe('exceeded_threshold')
		})

		it('should transition to gameOver when score exceeds minThreshold', () => {
			const gameState = createGameState()
			gameState.minThreshold = -15
			gameState.currentScore = -10
			gameState.wheelAngle = 270
			gameState.discardPile = [createPlayedCard(createCard('hearts', '9'), -9)]
			gameState.players[0].hand = [createCard('spades', '7')]

			const actor = createActor(playingMachine, {input: gameState}).start()
			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'CHOOSE_CARD', cardId: 'spades-7'})
			actor.send({type: 'PLAY_CARD'})

			expect(actor.getSnapshot().context.currentScore).toBe(-17)
			expect(actor.getSnapshot().value).toBe('gameOver')
			expect(actor.getSnapshot().context.winner?.id).toBe('player-2')
			expect(actor.getSnapshot().context.losers).toHaveLength(1)
			expect(actor.getSnapshot().context.losers[0].id).toBe('player-1')
			expect(actor.getSnapshot().context.reason).toBe('exceeded_threshold')
		})
	})

	describe('story: complete game to victory', () => {
		it('should play a realistic multi-turn game ending in a win', () => {
			const gameState = createGameState()
			gameState.minThreshold = -20
			gameState.maxThreshold = 30
			gameState.currentScore = 0
			gameState.wheelAngle = 90
			gameState.discardPile = [createPlayedCard(createCard('hearts', '5'), 5)]
			gameState.players = [
				{
					id: 'player-1',
					name: 'Alice',
					isReady: true,
					hand: [
						createCard('spades', '6'),
						createCard('hearts', '8'),
						createCard('diamonds', '10'),
					],
				},
				{
					id: 'player-2',
					name: 'Bob',
					isReady: true,
					hand: [
						createCard('clubs', '7'),
						createCard('spades', '9'),
						createCard('hearts', 'K'),
					],
				},
			]
			gameState.drawPile = [
				createCard('diamonds', '4'),
				createCard('clubs', '3'),
				createCard('spades', '2'),
			]

			const actor = createActor(playingMachine, {input: gameState}).start()

			actor.send({type: 'TURN_STARTED'})
			expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0)
			expect(actor.getSnapshot().context.players[0].hand).toHaveLength(4)

			actor.send({type: 'CHOOSE_CARD', cardId: 'spades-6'})
			actor.send({type: 'PLAY_CARD'})
			expect(actor.getSnapshot().context.currentScore).toBe(6)
			expect(actor.getSnapshot().context.discardPile[0].card.rank).toBe('6')

			actor.send({type: 'END_TURN'})
			expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1)
			expect(actor.getSnapshot().value).toBe('turnStart')

			actor.send({type: 'TURN_STARTED'})
			expect(actor.getSnapshot().context.players[1].hand).toHaveLength(4)

			actor.send({type: 'CHOOSE_CARD', cardId: 'clubs-7'})
			actor.send({type: 'PLAY_CARD'})
			expect(actor.getSnapshot().context.currentScore).toBe(13)

			actor.send({type: 'END_TURN'})
			expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0)

			actor.send({type: 'TURN_STARTED'})
			expect(actor.getSnapshot().context.players[0].hand).toHaveLength(4)

			actor.send({type: 'CHOOSE_CARD', cardId: 'hearts-8'})
			actor.send({type: 'PLAY_CARD'})
			expect(actor.getSnapshot().context.currentScore).toBe(21)

			actor.send({type: 'END_TURN'})

			actor.send({type: 'TURN_STARTED'})
			expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1)

			actor.send({type: 'SPIN_WHEEL', force: 0.05})
			expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(true)

			actor.send({type: 'CHOOSE_CARD', cardId: 'spades-9'})
			actor.send({type: 'PLAY_CARD'})
			expect(actor.getSnapshot().context.currentScore).toBe(30)

			expect(actor.getSnapshot().value).toBe('gameOver')
			expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1)
		})
	})

	describe('state serialization', () => {
		it('should serialize and restore RNG state for deterministic gameplay', () => {
			const gameState = createGameState()
			const actor = createActor(playingMachine, {input: gameState}).start()

			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'SPIN_WHEEL', force: 0.5})

			const snapshot1 = actor.getSnapshot()
			const rngData = snapshot1.context.rng!.toJSON()
			const wheelAngleBeforeSerialization = snapshot1.context.wheelAngle

			const restoredRng = Rng.fromJSON(rngData)

			const nextValuesOriginal = [
				snapshot1.context.rng!.next(),
				snapshot1.context.rng!.next(),
				snapshot1.context.rng!.next(),
			]

			const nextValuesRestored = [
				restoredRng.next(),
				restoredRng.next(),
				restoredRng.next(),
			]

			expect(nextValuesRestored).toEqual(nextValuesOriginal)
			expect(restoredRng.seed).toBe(snapshot1.context.rng!.seed)
			expect(restoredRng.callCount).toBe(snapshot1.context.rng!.callCount)

			const restoredGameState = {
				...snapshot1.context,
				rng: restoredRng,
			}

			const actor2 = createActor(playingMachine, {
				input: restoredGameState,
			}).start()

			expect(actor2.getSnapshot().context.wheelAngle).toBe(
				wheelAngleBeforeSerialization,
			)
			expect(actor2.getSnapshot().context.currentScore).toBe(
				snapshot1.context.currentScore,
			)
		})
	})

	describe('surrender conditions', () => {
		it('should transition to gameOver when player surrenders', () => {
			const gameState = createGameState()
			const actor = createActor(playingMachine, {input: gameState}).start()

			actor.send({type: 'TURN_STARTED'})
			expect(actor.getSnapshot().value).toMatchObject({
				playerTurn: 'awaitingAction',
			})

			actor.send({type: 'SURRENDER'})

			expect(actor.getSnapshot().value).toBe('gameOver')
			expect(actor.getSnapshot().context.winner?.id).toBe('player-2')
			expect(actor.getSnapshot().context.losers).toHaveLength(1)
			expect(actor.getSnapshot().context.losers[0].id).toBe('player-1')
			expect(actor.getSnapshot().context.reason).toBe('surrendered')
		})

		it('should handle surrender with multiple players correctly', () => {
			const gameState = createGameState()
			gameState.players = [
				{
					id: 'player-1',
					name: 'Alice',
					isReady: true,
					hand: [createCard('hearts', '5')],
				},
				{
					id: 'player-2',
					name: 'Bob',
					isReady: true,
					hand: [createCard('diamonds', '6')],
				},
				{
					id: 'player-3',
					name: 'Charlie',
					isReady: true,
					hand: [createCard('clubs', '7')],
				},
			]
			gameState.currentPlayerIndex = 1

			const actor = createActor(playingMachine, {input: gameState}).start()

			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'SURRENDER'})

			expect(actor.getSnapshot().value).toBe('gameOver')
			expect(actor.getSnapshot().context.winner?.id).toBe('player-1')
			expect(actor.getSnapshot().context.losers).toHaveLength(2)
			expect(
				actor
					.getSnapshot()
					.context.losers.map((p) => p.id)
					.sort(),
			).toEqual(['player-2', 'player-3'])
			expect(actor.getSnapshot().context.reason).toBe('surrendered')
		})

		it('should handle surrender when first player (index 0) surrenders', () => {
			const gameState = createGameState()
			gameState.currentPlayerIndex = 0

			const actor = createActor(playingMachine, {input: gameState}).start()

			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'SURRENDER'})

			expect(actor.getSnapshot().value).toBe('gameOver')
			expect(actor.getSnapshot().context.winner?.id).toBe('player-2')
			expect(actor.getSnapshot().context.losers[0].id).toBe('player-1')
			expect(actor.getSnapshot().context.reason).toBe('surrendered')
		})
	})

	describe('card effects', () => {
		it('should play small Ace (value 1) by adding zero-value effect', () => {
			const gameState = createGameState()
			gameState.wheelAngle = 90
			gameState.currentScore = 10
			gameState.discardPile = [createPlayedCard(createCard('hearts', '5'), 5)]
			gameState.players[0].hand = [createCard('spades', 'A')]

			const actor = createActor(playingMachine, {input: gameState}).start()
			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'CHOOSE_CARD', cardId: 'spades-A'})

			expect(actor.getSnapshot().value).toMatchObject({
				playerTurn: 'configuringEffect',
			})

			actor.send({
				type: 'ADD_EFFECT',
				effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
			})

			expect(actor.getSnapshot().context.activeEffects).toEqual([
				{type: 'value-adder', value: 0, stacksRemaining: 1},
			])

			actor.send({type: 'PLAY_CARD'})

			expect(actor.getSnapshot().context.currentScore).toBe(11)
			expect(actor.getSnapshot().context.activeEffects).toEqual([])
			expect(actor.getSnapshot().context.discardPile[0].playedValue).toBe(1)
		})

		it('should play big Ace (value 11) by adding ten-value effect', () => {
			const gameState = createGameState()
			gameState.wheelAngle = 90
			gameState.currentScore = 10
			gameState.discardPile = [createPlayedCard(createCard('hearts', '5'), 5)]
			gameState.players[0].hand = [createCard('spades', 'A')]

			const actor = createActor(playingMachine, {input: gameState}).start()
			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'CHOOSE_CARD', cardId: 'spades-A'})
			actor.send({
				type: 'ADD_EFFECT',
				effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
			})

			actor.send({type: 'PLAY_CARD'})

			expect(actor.getSnapshot().context.currentScore).toBe(21)
			expect(actor.getSnapshot().context.activeEffects).toEqual([])
			expect(actor.getSnapshot().context.discardPile[0].playedValue).toBe(11)
		})

		it('should find and draw Jack target card when it exists in draw pile', () => {
			const gameState = createGameState()
			gameState.wheelAngle = 90
			gameState.currentScore = 10
			gameState.discardPile = [createPlayedCard(createCard('hearts', '5'), 5)]

			const jackCard = createCard('spades', 'J', {
				type: 'choice',
				name: 'Courtship',
				description: 'Try to draw your choice of a date!',
			})
			const queenCard = createCard('diamonds', 'Q')
			gameState.players[0].hand = [jackCard]
			gameState.drawPile = [
				createCard('clubs', '2'),
				queenCard,
				createCard('hearts', '3'),
			]

			const actor = createActor(playingMachine, {input: gameState}).start()
			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'CHOOSE_CARD', cardId: 'spades-J'})

			expect(actor.getSnapshot().value).toMatchObject({
				playerTurn: 'configuringEffect',
			})

			actor.send({type: 'SEARCH_AND_DRAW', rank: 'Q'})

			const handAfterDraw = actor.getSnapshot().context.players[0].hand
			expect(handAfterDraw).toHaveLength(3)
			expect(handAfterDraw.find((c) => c.id === 'diamonds-Q')).toBeDefined()
			expect(actor.getSnapshot().context.drawPile).toHaveLength(1)

			actor.send({type: 'PLAY_CARD'})

			expect(actor.getSnapshot().context.currentScore).toBe(20)
			expect(actor.getSnapshot().context.discardPile[0].playedValue).toBe(10)
			expect(actor.getSnapshot().context.players[0].hand).toHaveLength(2)
			expect(
				actor
					.getSnapshot()
					.context.players[0].hand.find((c) => c.id === 'diamonds-Q'),
			).toBeDefined()
		})

		it('should handle Jack effect gracefully when target card not found', () => {
			const gameState = createGameState()
			gameState.wheelAngle = 90
			gameState.currentScore = 10
			gameState.discardPile = [createPlayedCard(createCard('hearts', '5'), 5)]

			const jackCard = createCard('spades', 'J', {
				type: 'choice',
				name: 'Courtship',
				description: 'Try to draw your choice of a date!',
			})
			gameState.players[0].hand = [jackCard]
			gameState.drawPile = [createCard('clubs', '2'), createCard('hearts', '3')]

			const actor = createActor(playingMachine, {input: gameState}).start()
			actor.send({type: 'TURN_STARTED'})
			actor.send({type: 'CHOOSE_CARD', cardId: 'spades-J'})
			actor.send({type: 'SEARCH_AND_DRAW', rank: 'Q'})

			const handAfterSearch = actor.getSnapshot().context.players[0].hand
			expect(handAfterSearch).toHaveLength(2)
			expect(actor.getSnapshot().context.drawPile).toHaveLength(1)

			actor.send({type: 'PLAY_CARD'})

			expect(actor.getSnapshot().context.currentScore).toBe(20)
			expect(actor.getSnapshot().context.discardPile[0].playedValue).toBe(10)
			expect(actor.getSnapshot().context.players[0].hand).toHaveLength(1)
		})
	})
})
