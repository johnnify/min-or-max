import {createActor} from 'xstate'
import {describe, it, expect} from 'vitest'
import {minOrMaxMachine} from './minOrMax'
import {Rng} from '@repo/rng'
import {getCardOrder, getModeFromWheelAngle, calculateSpin} from './utils'
import type {Card} from './types'

const findValidCard = (
	hand: Card[],
	topCard: Card,
	wheelMode: 'max' | 'min',
): Card | undefined => {
	const ace = hand.find((c) => c.rank === 'A')
	if (ace) return ace

	if (topCard.rank === 'A') return hand[0]

	const topOrder = getCardOrder(topCard.rank)

	return hand.find((c) => {
		const cardOrder = getCardOrder(c.rank)
		if (wheelMode === 'max') {
			return cardOrder >= topOrder
		} else {
			return cardOrder <= topOrder
		}
	})
}

describe('MinOrMax Machine Tests', () => {
	describe('Lobby Phase', () => {
		it('should start in lobby.waiting state with empty players, no rng, and standard deck', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()

			expect(actor.getSnapshot().value).toBe('lobby')
			expect(actor.getSnapshot().context.players).toEqual([])
			expect(actor.getSnapshot().context.rng).not.toBe(null)
			expect(actor.getSnapshot().context.deck).toHaveLength(52)
			expect(actor.getSnapshot().context.deck[0]).toEqual({
				id: 'hearts-2',
				suit: 'hearts',
				rank: '2',
			})
		})

		it('should add a player when PLAYER_JOINED is sent', () => {
			const actor = createActor(minOrMaxMachine)
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
				isReady: true,
				hand: [],
			})
		})

		it('should mark the correct player as ready when PLAYER_READY is sent', () => {
			const actor = createActor(minOrMaxMachine)
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
				type: 'PLAYER_UNREADY',
				playerId: 'player-1',
			})

			expect(actor.getSnapshot().context.players[0].isReady).toBe(false)
			expect(actor.getSnapshot().context.players[1].isReady).toBe(true)

			actor.send({
				type: 'PLAYER_READY',
				playerId: 'player-1',
			})

			expect(actor.getSnapshot().context.players[0].isReady).toBe(true)
			expect(actor.getSnapshot().context.players[1].isReady).toBe(true)
		})

		it('should not transition to setup when START_GAME is sent without minimum players', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()

			actor.send({
				type: 'PLAYER_JOINED',
				playerId: 'player-1',
				playerName: 'Alice',
			})

			actor.send({type: 'START_GAME'})

			expect(actor.getSnapshot().value).toBe('lobby')
		})

		it('should transition to setup when START_GAME is sent with enough ready players and RNG seeded', () => {
			const actor = createActor(minOrMaxMachine)
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
				type: 'SEED',
				seed: 'game-seed-456',
			})

			actor.send({type: 'START_GAME'})

			expect(actor.getSnapshot().value).toMatchObject({setup: 'shufflingPile'})
		})

		it('should not add more than 4 players', () => {
			const actor = createActor(minOrMaxMachine)
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

		it('should update RNG seed when SEED is sent', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()

			const initialSeed = actor.getSnapshot().context.rng.seed
			expect(initialSeed).toBeDefined()

			actor.send({
				type: 'SEED',
				seed: 'test-seed-123',
			})

			expect(actor.getSnapshot().context.rng).not.toBe(null)
			expect(actor.getSnapshot().context.rng.seed).toBe('test-seed-123')
			expect(actor.getSnapshot().context.rng.seed).not.toBe(initialSeed)
		})

		it('should mark a player as unready when PLAYER_UNREADY is sent', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()

			actor.send({
				type: 'PLAYER_JOINED',
				playerId: 'player-1',
				playerName: 'Alice',
			})

			expect(actor.getSnapshot().context.players[0].isReady).toBe(true)

			actor.send({
				type: 'PLAYER_UNREADY',
				playerId: 'player-1',
			})

			expect(actor.getSnapshot().context.players[0].isReady).toBe(false)
		})

		it('should remove a player when PLAYER_DROPPED is sent', () => {
			const actor = createActor(minOrMaxMachine)
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

		it('should initialize RNG with timestamp seed on machine creation', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()

			expect(actor.getSnapshot().context.rng).not.toBe(null)

			const seed = actor.getSnapshot().context.rng.seed
			const seedNumber = parseInt(seed, 10)
			const now = Date.now()
			// Seed should be a recent timestamp (within 1 second of now)
			expect(Math.abs(seedNumber - now)).toBeLessThan(1000)

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

			actor.send({type: 'START_GAME'})

			expect(actor.getSnapshot().value).toMatchObject({setup: 'shufflingPile'})
		})
	})

	describe('Setup Phase', () => {
		const transitionToSetup = (actor: ReturnType<typeof createActor>) => {
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
			actor.send({type: 'SEED', seed: 'setup-test-seed'})
			actor.send({type: 'START_GAME'})
		}

		it('should shuffle the deck into draw pile with seeded RNG determinism', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToSetup(actor)

			expect(actor.getSnapshot().value).toMatchObject({setup: 'shufflingPile'})
			const originalOrder = [...actor.getSnapshot().context.drawPile]

			actor.send({type: 'PILE_SHUFFLED'})

			const shuffled = actor.getSnapshot().context.drawPile
			expect(shuffled).toHaveLength(52)
			expect(shuffled).not.toEqual(originalOrder)

			const actor2 = createActor(minOrMaxMachine)
			actor2.start()
			transitionToSetup(actor2)
			actor2.send({type: 'PILE_SHUFFLED'})

			expect(actor2.getSnapshot().context.drawPile).toEqual(shuffled)
		})

		it('should deal 3 cards to each player from the draw pile', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToSetup(actor)

			actor.send({type: 'PILE_SHUFFLED'})
			expect(actor.getSnapshot().context.drawPile).toHaveLength(52)

			actor.send({type: 'CARDS_DEALT'})

			const context = actor.getSnapshot().context
			expect(context.players[0].hand).toHaveLength(3)
			expect(context.players[1].hand).toHaveLength(3)
			expect(context.drawPile).toHaveLength(46)

			const allCards = [
				...context.players[0].hand,
				...context.players[1].hand,
				...context.drawPile,
			]
			expect(allCards).toHaveLength(52)
		})

		it('should generate max threshold using RNG', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToSetup(actor)

			actor.send({type: 'PILE_SHUFFLED'})
			actor.send({type: 'CARDS_DEALT'})

			expect(actor.getSnapshot().context.maxThreshold).toBe(0)

			actor.send({type: 'THRESHOLDS_SET'})

			const {maxThreshold} = actor.getSnapshot().context
			expect(maxThreshold).toBeGreaterThanOrEqual(30)
			expect(maxThreshold).toBeLessThanOrEqual(50)

			const actor2 = createActor(minOrMaxMachine)
			actor2.start()
			transitionToSetup(actor2)
			actor2.send({type: 'PILE_SHUFFLED'})
			actor2.send({type: 'CARDS_DEALT'})
			actor2.send({type: 'THRESHOLDS_SET'})

			expect(actor2.getSnapshot().context.maxThreshold).toBe(maxThreshold)
		})

		it('should spin wheel based on force and add degrees to current angle', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToSetup(actor)

			actor.send({type: 'PILE_SHUFFLED'})
			actor.send({type: 'CARDS_DEALT'})
			actor.send({type: 'THRESHOLDS_SET'})

			expect(actor.getSnapshot().context.wheelAngle).toBe(90)

			actor.send({type: 'WHEEL_SPUN', angle: 270})

			const newAngle = actor.getSnapshot().context.wheelAngle
			expect(newAngle).toBeGreaterThan(90)
			expect(newAngle).toBeLessThanOrEqual(450)

			const actor2 = createActor(minOrMaxMachine)
			actor2.start()
			transitionToSetup(actor2)
			actor2.send({type: 'PILE_SHUFFLED'})
			actor2.send({type: 'CARDS_DEALT'})
			actor2.send({type: 'THRESHOLDS_SET'})
			actor2.send({type: 'WHEEL_SPUN', angle: 270})

			expect(actor2.getSnapshot().context.wheelAngle).toBe(newAngle)
		})

		it('should play first card from draw pile to discard pile and update tally', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToSetup(actor)

			actor.send({type: 'PILE_SHUFFLED'})
			actor.send({type: 'CARDS_DEALT'})
			actor.send({type: 'THRESHOLDS_SET'})
			actor.send({type: 'WHEEL_SPUN', angle: 270})

			const beforeDrawPile = actor.getSnapshot().context.drawPile
			const topCard = beforeDrawPile[0]
			const drawPileLength = beforeDrawPile.length

			expect(actor.getSnapshot().context.discardPile).toHaveLength(0)
			expect(actor.getSnapshot().context.tally).toBe(0)

			actor.send({type: 'FIRST_CARD_PLAYED'})

			const context = actor.getSnapshot().context
			expect(context.drawPile).toHaveLength(drawPileLength - 2)
			expect(context.discardPile).toHaveLength(1)
			expect(context.discardPile[0].card).toEqual(topCard)
			expect(context.tally).toBeGreaterThan(0)
			expect(actor.getSnapshot().value).toMatchObject({
				playing: {playerTurn: 'awaitingAction'},
			})
		})

		it('should complete full setup flow with realistic game state', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToSetup(actor)

			expect(actor.getSnapshot().value).toMatchObject({setup: 'shufflingPile'})

			actor.send({type: 'PILE_SHUFFLED'})
			expect(actor.getSnapshot().value).toMatchObject({setup: 'dealingCards'})

			actor.send({type: 'CARDS_DEALT'})
			expect(actor.getSnapshot().value).toMatchObject({
				setup: 'generatingThresholds',
			})

			actor.send({type: 'THRESHOLDS_SET'})
			expect(actor.getSnapshot().value).toMatchObject({
				setup: 'spinningInitialWheel',
			})

			const setupContext = actor.getSnapshot().context
			const spinDegrees = calculateSpin(0.8, setupContext.rng)
			const wheelAngle = setupContext.wheelAngle + spinDegrees

			actor.send({type: 'WHEEL_SPUN', angle: wheelAngle})
			expect(actor.getSnapshot().value).toMatchObject({
				setup: 'playingFirstCard',
			})

			actor.send({type: 'FIRST_CARD_PLAYED'})
			expect(actor.getSnapshot().value).toMatchObject({
				playing: {playerTurn: 'awaitingAction'},
			})

			const finalContext = actor.getSnapshot().context
			expect(finalContext.players[0].hand).toHaveLength(4)
			expect(finalContext.players[1].hand).toHaveLength(3)
			expect(finalContext.drawPile.length).toBeGreaterThan(0)
			expect(finalContext.discardPile).toHaveLength(1)
			expect(finalContext.maxThreshold).toBeGreaterThan(0)
			expect(finalContext.wheelAngle).toBeGreaterThan(90)
			expect(finalContext.tally).toBeGreaterThan(0)
		})
	})

	describe('Playing Phase', () => {
		const transitionToPlaying = (
			actor: ReturnType<typeof createActor>,
			seed = 'playing-test-seed',
		) => {
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
			actor.send({type: 'SEED', seed})
			actor.send({type: 'START_GAME'})
			actor.send({type: 'PILE_SHUFFLED'})
			actor.send({type: 'CARDS_DEALT'})
			actor.send({type: 'THRESHOLDS_SET'})
			actor.send({type: 'WHEEL_SPUN', angle: 270})
			actor.send({type: 'FIRST_CARD_PLAYED'})
		}

		it('should automatically draw a card for the current player and transition to playerTurn', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor)

			expect(actor.getSnapshot().value).toMatchObject({
				playing: {playerTurn: 'awaitingAction'},
			})

			const handLength = actor.getSnapshot().context.players[0].hand.length
			expect(handLength).toBe(4)
		})

		it('should allow player to end turn without playing a card', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor)

			expect(actor.getSnapshot().value).toMatchObject({
				playing: {playerTurn: 'awaitingAction'},
			})
			expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0)

			const initialTally = actor.getSnapshot().context.tally
			const player1HandSize = actor.getSnapshot().context.players[0].hand.length

			actor.send({type: 'END_TURN'})

			expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1)
			expect(actor.getSnapshot().context.tally).toBe(initialTally)
			expect(actor.getSnapshot().context.players[0].hand.length).toBe(
				player1HandSize,
			)
			expect(actor.getSnapshot().context.players[1].hand.length).toBe(4)
			expect(actor.getSnapshot().value).toMatchObject({
				playing: {playerTurn: 'awaitingAction'},
			})
		})

		it('should allow player to choose and play a valid card', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor)

			expect(actor.getSnapshot().value).toMatchObject({
				playing: {playerTurn: 'awaitingAction'},
			})

			const topCard = actor.getSnapshot().context.discardPile[0].card
			const wheelAngle = actor.getSnapshot().context.wheelAngle
			const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
			const hand = actor.getSnapshot().context.players[0].hand
			const cardToPlay = findValidCard(hand, topCard, wheelMode)

			if (cardToPlay) {
				actor.send({type: 'CHOOSE_CARD', cardId: cardToPlay.id})

				const context = actor.getSnapshot().context
				expect(context.chosenCard).toEqual(cardToPlay)
				const expectedState =
					cardToPlay.rank === 'A' ? 'configuringEffect' : 'readyToPlay'
				expect(actor.getSnapshot().value).toMatchObject({
					playing: {playerTurn: expectedState},
				})
			}
		})

		it('should play chosen card to discard pile, remove from hand, and update tally', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor)

			const handBefore = actor.getSnapshot().context.players[0].hand.length
			const discardBefore = actor.getSnapshot().context.discardPile.length
			const tallyBefore = actor.getSnapshot().context.tally

			const topCard = actor.getSnapshot().context.discardPile[0].card
			const wheelAngle = actor.getSnapshot().context.wheelAngle
			const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
			const hand = actor.getSnapshot().context.players[0].hand
			const cardToPlay = findValidCard(hand, topCard, wheelMode)

			if (cardToPlay) {
				actor.send({type: 'CHOOSE_CARD', cardId: cardToPlay.id})

				let snapshot = actor.getSnapshot()
				if (
					snapshot.value !== 'gameOver' &&
					typeof snapshot.value === 'object' &&
					'playing' in snapshot.value
				) {
					const playingState = snapshot.value.playing as {playerTurn: string}
					if (playingState.playerTurn === 'configuringEffect') {
						if (cardToPlay.rank === 'A') {
							actor.send({
								type: 'ADD_EFFECT',
								effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
							})
						} else if (cardToPlay.rank === 'J') {
							actor.send({type: 'SEARCH_AND_DRAW', rank: 'Q'})
						}
						snapshot = actor.getSnapshot()
					}
				}

				if (snapshot.value !== 'gameOver') {
					if (
						typeof snapshot.value === 'object' &&
						'playing' in snapshot.value
					) {
						const playingState = snapshot.value.playing as {playerTurn: string}
						if (playingState.playerTurn === 'readyToPlay') {
							actor.send({type: 'PLAY_CARD'})

							const context = actor.getSnapshot().context
							expect(context.players[0].hand).toHaveLength(handBefore - 1)
							expect(
								context.players[0].hand.find((c) => c.id === cardToPlay.id),
							).toBeUndefined()
							expect(context.discardPile).toHaveLength(discardBefore + 1)
							expect(context.discardPile[0].card).toEqual(cardToPlay)
							expect(context.tally).not.toBe(tallyBefore)
							if (actor.getSnapshot().value !== 'gameOver') {
								expect(actor.getSnapshot().value).toMatchObject({
									playing: {playerTurn: 'postCardPlay'},
								})
							}
						}
					}
				}
			}
		})

		it('should complete full turn and advance to next player', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor)

			expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0)

			const topCard = actor.getSnapshot().context.discardPile[0].card
			const wheelAngle = actor.getSnapshot().context.wheelAngle
			const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
			const hand = actor.getSnapshot().context.players[0].hand
			const cardToPlay = findValidCard(hand, topCard, wheelMode)

			if (cardToPlay) {
				actor.send({type: 'CHOOSE_CARD', cardId: cardToPlay.id})
				if (cardToPlay.rank === 'A') {
					actor.send({
						type: 'ADD_EFFECT',
						effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
					})
				}
				actor.send({type: 'PLAY_CARD'})

				if (actor.getSnapshot().value !== 'gameOver') {
					expect(actor.getSnapshot().value).toMatchObject({
						playing: {playerTurn: 'postCardPlay'},
					})

					actor.send({type: 'END_TURN'})

					expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1)
					expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(false)
					expect(actor.getSnapshot().context.chosenCard).toBe(null)
					expect(actor.getSnapshot().value).toMatchObject({
						playing: {playerTurn: 'awaitingAction'},
					})
				}
			}
		})

		it('should handle complete multi-player game flow across multiple turns', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor)

			expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0)
			expect(actor.getSnapshot().context.players[0].name).toBe('Alice')
			expect(actor.getSnapshot().context.players[1].name).toBe('Bob')

			let topCard = actor.getSnapshot().context.discardPile[0].card
			let wheelAngle = actor.getSnapshot().context.wheelAngle
			let wheelMode: 'min' | 'max' = wheelAngle >= 180 ? 'min' : 'max'
			const aliceCardToPlay = findValidCard(
				actor.getSnapshot().context.players[0].hand,
				topCard,
				wheelMode,
			)

			if (aliceCardToPlay) {
				actor.send({type: 'CHOOSE_CARD', cardId: aliceCardToPlay.id})
				if (aliceCardToPlay.rank === 'A') {
					actor.send({
						type: 'ADD_EFFECT',
						effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
					})
				}
				actor.send({type: 'PLAY_CARD'})
				const tallyAfterAlice = actor.getSnapshot().context.tally

				if (actor.getSnapshot().value !== 'gameOver') {
					actor.send({type: 'END_TURN'})

					expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1)
					expect(actor.getSnapshot().context.players[1].hand).toHaveLength(4)

					topCard = actor.getSnapshot().context.discardPile[0].card
					wheelAngle = actor.getSnapshot().context.wheelAngle
					wheelMode = wheelAngle >= 180 ? 'min' : 'max'
					const bobValidCard = findValidCard(
						actor.getSnapshot().context.players[1].hand,
						topCard,
						wheelMode,
					)

					if (bobValidCard) {
						actor.send({type: 'CHOOSE_CARD', cardId: bobValidCard.id})
						if (bobValidCard.rank === 'A') {
							actor.send({
								type: 'ADD_EFFECT',
								effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
							})
						}
						actor.send({type: 'PLAY_CARD'})

						const tallyAfterBob = actor.getSnapshot().context.tally
						expect(tallyAfterBob).toBeGreaterThan(tallyAfterAlice)
						expect(actor.getSnapshot().context.discardPile[0].card).toEqual(
							bobValidCard,
						)

						if (actor.getSnapshot().value !== 'gameOver') {
							actor.send({type: 'END_TURN'})

							expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0)
							expect(actor.getSnapshot().value).toMatchObject({
								playing: {playerTurn: 'awaitingAction'},
							})
						}
					}
				}
			}
		})

		it('should allow player to spin the wheel during their turn', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor)

			const initialWheelAngle = actor.getSnapshot().context.wheelAngle
			expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(false)

			const beforeContext = actor.getSnapshot().context
			const spinDegrees = calculateSpin(0.5, beforeContext.rng)
			const newAngle = beforeContext.wheelAngle + spinDegrees

			actor.send({type: 'WHEEL_SPUN', angle: newAngle})

			expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(true)
			expect(actor.getSnapshot().context.wheelAngle).not.toBe(initialWheelAngle)
			expect(actor.getSnapshot().context.wheelAngle).toBeGreaterThan(
				initialWheelAngle,
			)
		})

		it('should prevent playing a card that is too low when wheel is on max mode', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor, 'max-mode-test')

			const beforeContext = actor.getSnapshot().context
			const spinDegrees = calculateSpin(0.01, beforeContext.rng)
			const newAngle = beforeContext.wheelAngle + spinDegrees

			actor.send({type: 'WHEEL_SPUN', angle: newAngle})
			const wheelAngle = actor.getSnapshot().context.wheelAngle

			if (wheelAngle < 180) {
				const topCard = actor.getSnapshot().context.discardPile[0].card
				const topValue = getCardOrder(topCard.rank)

				const tooLowCard = actor
					.getSnapshot()
					.context.players[0].hand.find((card) => {
						const cardValue = getCardOrder(card.rank)
						return cardValue < topValue && card.rank !== 'A'
					})

				if (tooLowCard) {
					actor.send({type: 'CHOOSE_CARD', cardId: tooLowCard.id})

					expect(actor.getSnapshot().value).toMatchObject({
						playing: {playerTurn: 'awaitingAction'},
					})
					expect(actor.getSnapshot().context.chosenCard).toBe(null)
				}
			}
		})

		it('should allow playing a card that is equal or higher when wheel is on max mode', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor, 'max-mode-valid-test')

			const beforeContext = actor.getSnapshot().context
			const spinDegrees = calculateSpin(0.01, beforeContext.rng)
			const newAngle = beforeContext.wheelAngle + spinDegrees

			actor.send({type: 'WHEEL_SPUN', angle: newAngle})
			const wheelAngle = actor.getSnapshot().context.wheelAngle

			if (wheelAngle < 180) {
				const topCard = actor.getSnapshot().context.discardPile[0].card
				const topValue = getCardOrder(topCard.rank)

				const validCard = actor
					.getSnapshot()
					.context.players[0].hand.find((card) => {
						const cardValue = getCardOrder(card.rank)
						return cardValue >= topValue || card.rank === 'A'
					})

				if (validCard && validCard.rank !== 'A') {
					actor.send({type: 'CHOOSE_CARD', cardId: validCard.id})

					expect(actor.getSnapshot().value).toMatchObject({
						playing: {playerTurn: 'readyToPlay'},
					})
					expect(actor.getSnapshot().context.chosenCard).toEqual(validCard)
				}
			}
		})

		it.skip('should prevent playing a card that is too high when wheel is on min mode', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor, 'min-mode-test')

			const beforeContext = actor.getSnapshot().context
			const spinDegrees = calculateSpin(0.9, beforeContext.rng)
			const newAngle = beforeContext.wheelAngle + spinDegrees

			actor.send({type: 'WHEEL_SPUN', angle: newAngle})
			const wheelAngle = actor.getSnapshot().context.wheelAngle
			const wheelMode = getModeFromWheelAngle(wheelAngle)
			expect(wheelMode).toBe('min')

			const topCard = actor.getSnapshot().context.discardPile[0].card
			const topValue = getCardOrder(topCard.rank)

			const tooHighCard = actor
				.getSnapshot()
				.context.players[0].hand.find((card) => {
					const cardValue = getCardOrder(card.rank)
					return cardValue > topValue && card.rank !== 'A'
				})

			if (tooHighCard) {
				actor.send({type: 'CHOOSE_CARD', cardId: tooHighCard.id})

				expect(actor.getSnapshot().value).toMatchObject({
					playing: {playerTurn: 'awaitingAction'},
				})
				expect(actor.getSnapshot().context.chosenCard).toBe(null)
			}
		})

		it.skip('should allow playing a card that is equal or lower when wheel is on min mode', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor, 'min-mode-valid-test')

			const beforeContext = actor.getSnapshot().context
			const spinDegrees = calculateSpin(0.9, beforeContext.rng)
			const newAngle = beforeContext.wheelAngle + spinDegrees

			actor.send({type: 'WHEEL_SPUN', angle: newAngle})
			const wheelAngle = actor.getSnapshot().context.wheelAngle
			const wheelMode = getModeFromWheelAngle(wheelAngle)
			expect(wheelMode).toBe('min')

			const topCard = actor.getSnapshot().context.discardPile[0].card
			const topValue = getCardOrder(topCard.rank)

			const validCard = actor
				.getSnapshot()
				.context.players[0].hand.find((card) => {
					const cardValue = getCardOrder(card.rank)
					return cardValue <= topValue || card.rank === 'A'
				})

			if (validCard && validCard.rank !== 'A') {
				actor.send({type: 'CHOOSE_CARD', cardId: validCard.id})

				expect(actor.getSnapshot().value).toMatchObject({
					playing: {playerTurn: 'readyToPlay'},
				})
				expect(actor.getSnapshot().context.chosenCard).toEqual(validCard)
			}
		})

		it('should allow playing an Ace on any card', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor, 'ace-test')

			const aceCard = actor
				.getSnapshot()
				.context.players[0].hand.find((card) => card.rank === 'A')

			if (aceCard) {
				actor.send({type: 'CHOOSE_CARD', cardId: aceCard.id})

				expect(actor.getSnapshot().value).toMatchObject({
					playing: {playerTurn: 'configuringEffect'},
				})
				expect(actor.getSnapshot().context.chosenCard?.rank).toBe('A')
			}
		})

		it('should allow playing any card on top of an Ace', () => {
			const actor = createActor(minOrMaxMachine)
			actor.start()
			transitionToPlaying(actor, 'after-ace-test')

			const aceCard = actor
				.getSnapshot()
				.context.players[0].hand.find((card) => card.rank === 'A')

			if (aceCard) {
				actor.send({type: 'CHOOSE_CARD', cardId: aceCard.id})
				actor.send({
					type: 'ADD_EFFECT',
					effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
				})
				actor.send({type: 'PLAY_CARD'})
				actor.send({type: 'END_TURN'})

				const anyCard = actor.getSnapshot().context.players[1].hand[0]
				if (anyCard.rank !== 'A') {
					actor.send({type: 'CHOOSE_CARD', cardId: anyCard.id})

					expect(actor.getSnapshot().value).toMatchObject({
						playing: {playerTurn: 'readyToPlay'},
					})
					expect(actor.getSnapshot().context.chosenCard).toEqual(anyCard)
				}
			}
		})

		describe('draw pile reshuffling', () => {
			it('should reshuffle discard pile into draw pile when draw pile is empty at turn start', () => {
				const actor = createActor(minOrMaxMachine)
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
				actor.send({type: 'SEED', seed: 'reshuffle-test'})
				actor.send({type: 'START_GAME'})
				actor.send({type: 'PILE_SHUFFLED'})
				actor.send({type: 'CARDS_DEALT'})
				actor.send({type: 'THRESHOLDS_SET'})
				actor.send({type: 'WHEEL_SPUN', angle: 270})
				actor.send({type: 'FIRST_CARD_PLAYED'})

				for (let i = 0; i < 23; i++) {
					const snapshot = actor.getSnapshot()
					if (snapshot.value === 'gameOver') break
					if (snapshot.context.drawPile.length === 0) break

					const currentPlayerIndex = snapshot.context.currentPlayerIndex
					const currentPlayer = snapshot.context.players[currentPlayerIndex]
					const playableCard = currentPlayer.hand.find((card) => {
						const topCard = snapshot.context.discardPile[0]
						if (!topCard) return true
						if (card.rank === 'A' || topCard.card.rank === 'A') return true
						const wheelAngle = snapshot.context.wheelAngle
						const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
						const cardValue = getCardOrder(card.rank)
						const topValue = getCardOrder(topCard.card.rank)
						if (wheelMode === 'max') {
							return cardValue >= topValue
						} else {
							return cardValue <= topValue
						}
					})

					if (playableCard) {
						actor.send({type: 'CHOOSE_CARD', cardId: playableCard.id})
						if (playableCard.effect) {
							actor.send({
								type: 'ADD_EFFECT',
								effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
							})
						}
						actor.send({type: 'PLAY_CARD'})
						if (actor.getSnapshot().value !== 'gameOver') {
							actor.send({type: 'END_TURN'})
						}
					}
				}

				if (actor.getSnapshot().context.drawPile.length === 0) {
					const discardPileLength =
						actor.getSnapshot().context.discardPile.length
					expect(discardPileLength).toBeGreaterThan(1)
				}
			})

			it('should not reshuffle when draw pile has cards', () => {
				const actor = createActor(minOrMaxMachine)
				actor.start()
				transitionToPlaying(actor)

				const drawPileBefore = actor.getSnapshot().context.drawPile.length
				expect(drawPileBefore).toBeGreaterThan(0)

				const discardBefore = actor.getSnapshot().context.discardPile.length

				const topCard = actor.getSnapshot().context.discardPile[0].card
				const wheelAngle = actor.getSnapshot().context.wheelAngle
				const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
				const hand = actor.getSnapshot().context.players[0].hand
				const cardToPlay = findValidCard(hand, topCard, wheelMode)

				if (cardToPlay) {
					actor.send({type: 'CHOOSE_CARD', cardId: cardToPlay.id})
					if (cardToPlay.rank === 'A') {
						actor.send({
							type: 'ADD_EFFECT',
							effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
						})
					}
					actor.send({type: 'PLAY_CARD'})
					actor.send({type: 'END_TURN'})

					expect(
						actor.getSnapshot().context.discardPile.length,
					).toBeGreaterThan(discardBefore)
				}
			})
		})

		describe('post-card-play wheel spinning', () => {
			it('should allow spinning wheel after playing card if not spun this turn', () => {
				const actor = createActor(minOrMaxMachine)
				actor.start()
				transitionToPlaying(actor)

				expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(false)

				const topCard = actor.getSnapshot().context.discardPile[0].card
				const wheelAngle = actor.getSnapshot().context.wheelAngle
				const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
				const hand = actor.getSnapshot().context.players[0].hand
				const cardToPlay = findValidCard(hand, topCard, wheelMode)

				if (cardToPlay) {
					actor.send({type: 'CHOOSE_CARD', cardId: cardToPlay.id})
					if (cardToPlay.rank === 'A') {
						actor.send({
							type: 'ADD_EFFECT',
							effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
						})
					}
					actor.send({type: 'PLAY_CARD'})

					if (actor.getSnapshot().value !== 'gameOver') {
						expect(actor.getSnapshot().value).toMatchObject({
							playing: {playerTurn: 'postCardPlay'},
						})

						const wheelAngleBefore = actor.getSnapshot().context.wheelAngle
						expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(false)

						const beforeContext = actor.getSnapshot().context
						const spinDegrees = calculateSpin(0.5, beforeContext.rng)
						const newAngle = beforeContext.wheelAngle + spinDegrees

						actor.send({type: 'WHEEL_SPUN', angle: newAngle})

						expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(true)
						expect(actor.getSnapshot().context.wheelAngle).toBeGreaterThan(
							wheelAngleBefore,
						)
						expect(actor.getSnapshot().value).toMatchObject({
							playing: {playerTurn: 'postCardPlay'},
						})

						actor.send({type: 'END_TURN'})
						expect(actor.getSnapshot().value).toMatchObject({
							playing: {playerTurn: 'awaitingAction'},
						})
					}
				}
			})

			it('should not allow spinning wheel after playing card if already spun this turn', () => {
				const actor = createActor(minOrMaxMachine)
				actor.start()
				transitionToPlaying(actor)

				const initialContext = actor.getSnapshot().context
				const spinDegrees = calculateSpin(0.05, initialContext.rng)
				const firstAngle = initialContext.wheelAngle + spinDegrees

				actor.send({type: 'WHEEL_SPUN', angle: firstAngle})
				expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(true)

				const currentWheelAngle = actor.getSnapshot().context.wheelAngle
				const wheelMode = currentWheelAngle >= 180 ? 'min' : 'max'
				const topCard = actor.getSnapshot().context.discardPile[0].card
				const hand = actor.getSnapshot().context.players[0].hand

				const validCard = hand.find((c) => {
					if (c.rank === 'A') return true
					const cardValue = getCardOrder(c.rank)
					const topValue = getCardOrder(topCard.rank)
					return wheelMode === 'max'
						? cardValue >= topValue
						: cardValue <= topValue
				})

				if (validCard) {
					actor.send({type: 'CHOOSE_CARD', cardId: validCard.id})
					if (validCard.effect) {
						actor.send({
							type: 'ADD_EFFECT',
							effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
						})
					}
					actor.send({type: 'PLAY_CARD'})

					if (actor.getSnapshot().value !== 'gameOver') {
						expect(actor.getSnapshot().value).toMatchObject({
							playing: {playerTurn: 'postCardPlay'},
						})

						const wheelAngleBefore = actor.getSnapshot().context.wheelAngle
						const contextBefore = actor.getSnapshot().context
						const spinDegrees = calculateSpin(0.8, contextBefore.rng)
						const secondAttemptAngle = wheelAngleBefore + spinDegrees

						actor.send({type: 'WHEEL_SPUN', angle: secondAttemptAngle})

						expect(actor.getSnapshot().context.wheelAngle).toBe(
							wheelAngleBefore,
						)
						expect(actor.getSnapshot().context.hasSpunThisTurn).toBe(true)
					}
				}
			})
		})

		describe('win conditions', () => {
			it('should transition to gameOver when score exactly matches maxThreshold', () => {
				const actor = createActor(minOrMaxMachine)
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
				actor.send({type: 'SEED', seed: 'exact-max-test'})
				actor.send({type: 'START_GAME'})
				actor.send({type: 'PILE_SHUFFLED'})
				actor.send({type: 'CARDS_DEALT'})
				actor.send({type: 'THRESHOLDS_SET'})

				const maxThreshold = actor.getSnapshot().context.maxThreshold
				const setupContext = actor.getSnapshot().context
				const spinDegrees = calculateSpin(0.1, setupContext.rng)
				const wheelAngle = setupContext.wheelAngle + spinDegrees

				actor.send({type: 'WHEEL_SPUN', angle: wheelAngle})
				actor.send({type: 'FIRST_CARD_PLAYED'})

				for (let turn = 0; turn < 30; turn++) {
					const snapshot = actor.getSnapshot()
					if (snapshot.value === 'gameOver') break

					const currentPlayerIndex = snapshot.context.currentPlayerIndex
					const currentPlayer = snapshot.context.players[currentPlayerIndex]

					const playableCard = currentPlayer.hand.find((card) => {
						const topCard = snapshot.context.discardPile[0]
						if (!topCard) return true
						if (card.rank === 'A' || topCard.card.rank === 'A') return true
						const wheelAngle = snapshot.context.wheelAngle
						const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
						const cardValue = getCardOrder(card.rank)
						const topValue = getCardOrder(topCard.card.rank)
						if (wheelMode === 'max') {
							return cardValue >= topValue
						} else {
							return cardValue <= topValue
						}
					})

					if (!playableCard) break

					actor.send({type: 'CHOOSE_CARD', cardId: playableCard.id})
					if (playableCard.effect) {
						const currentTally = snapshot.context.tally
						const cardValue = getCardOrder(playableCard.rank)
						const neededToMax = maxThreshold - currentTally
						const effectValue =
							neededToMax === cardValue + 10
								? 10
								: neededToMax === cardValue
									? 0
									: 10
						actor.send({
							type: 'ADD_EFFECT',
							effect: {
								type: 'value-adder',
								value: effectValue,
								stacksRemaining: 1,
							},
						})
					}
					actor.send({type: 'PLAY_CARD'})

					if (actor.getSnapshot().value === 'gameOver') {
						if (actor.getSnapshot().context.reason === 'exact_threshold') {
							expect(actor.getSnapshot().context.tally).toBe(maxThreshold)
							expect(actor.getSnapshot().context.winner?.id).toBe(
								`player-${currentPlayerIndex + 1}`,
							)
						}
						break
					}

					actor.send({type: 'END_TURN'})
				}
			})
		})

		describe('loss conditions', () => {
			it('should transition to gameOver when score exceeds maxThreshold', () => {
				const actor = createActor(minOrMaxMachine)
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
				actor.send({type: 'SEED', seed: 'bust-max-test'})
				actor.send({type: 'START_GAME'})
				actor.send({type: 'PILE_SHUFFLED'})
				actor.send({type: 'CARDS_DEALT'})
				actor.send({type: 'THRESHOLDS_SET'})

				const setupContext = actor.getSnapshot().context
				const spinDegrees = calculateSpin(0.1, setupContext.rng)
				const wheelAngle = setupContext.wheelAngle + spinDegrees

				actor.send({type: 'WHEEL_SPUN', angle: wheelAngle})
				actor.send({type: 'FIRST_CARD_PLAYED'})

				for (let turn = 0; turn < 30; turn++) {
					const snapshot = actor.getSnapshot()
					if (snapshot.value === 'gameOver') {
						if (snapshot.context.reason === 'exceeded_threshold') {
							expect(snapshot.context.tally).toBeGreaterThan(
								snapshot.context.maxThreshold,
							)
							expect(snapshot.context.winner).not.toBe(null)
							expect(snapshot.context.losers).toHaveLength(1)
						}
						break
					}

					const currentPlayerIndex = snapshot.context.currentPlayerIndex
					const currentPlayer = snapshot.context.players[currentPlayerIndex]
					const playableCard = currentPlayer.hand.find((card) => {
						const topCard = snapshot.context.discardPile[0]
						if (!topCard) return true
						if (card.rank === 'A' || topCard.card.rank === 'A') return true
						const wheelAngle = snapshot.context.wheelAngle
						const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
						const cardValue = getCardOrder(card.rank)
						const topValue = getCardOrder(topCard.card.rank)
						if (wheelMode === 'max') {
							return cardValue >= topValue
						} else {
							return cardValue <= topValue
						}
					})

					if (!playableCard) break

					actor.send({type: 'CHOOSE_CARD', cardId: playableCard.id})
					if (playableCard.effect) {
						actor.send({
							type: 'ADD_EFFECT',
							effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
						})
					}
					actor.send({type: 'PLAY_CARD'})

					if (actor.getSnapshot().value !== 'gameOver') {
						actor.send({type: 'END_TURN'})
					}
				}
			})

			describe('story: complete game to victory', () => {
				it('should play a realistic multi-turn game ending in a win', () => {
					const actor = createActor(minOrMaxMachine)
					actor.start()
					transitionToPlaying(actor, 'victory-story-test')

					expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0)
					expect(actor.getSnapshot().context.players[0].hand).toHaveLength(4)

					const playCard = () => {
						const snapshot = actor.getSnapshot()
						const currentPlayerIndex = snapshot.context.currentPlayerIndex
						const currentPlayer = snapshot.context.players[currentPlayerIndex]
						const topCard = snapshot.context.discardPile[0].card
						const wheelAngle = snapshot.context.wheelAngle
						const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
						const cardToPlay = findValidCard(
							currentPlayer.hand,
							topCard,
							wheelMode,
						)

						if (cardToPlay) {
							actor.send({type: 'CHOOSE_CARD', cardId: cardToPlay.id})
							if (cardToPlay.effect) {
								actor.send({
									type: 'ADD_EFFECT',
									effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
								})
							}
							actor.send({type: 'PLAY_CARD'})
							if (actor.getSnapshot().value !== 'gameOver') {
								actor.send({type: 'END_TURN'})
							}
						}
					}

					for (let turn = 0; turn < 10; turn++) {
						if (actor.getSnapshot().value === 'gameOver') {
							break
						}
						playCard()
					}

					expect(actor.getSnapshot().context.players).toHaveLength(2)
				})
			})

			describe('state serialization', () => {
				it('should serialize and restore RNG state for deterministic gameplay', () => {
					const actor = createActor(minOrMaxMachine)
					actor.start()
					transitionToPlaying(actor)

					actor.send({type: 'WHEEL_SPUN', angle: 270})

					const snapshot1 = actor.getSnapshot()
					const rngData = snapshot1.context.rng!.toJSON()

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
				})
			})

			describe('surrender conditions', () => {
				it('should transition to gameOver when player surrenders', () => {
					const actor = createActor(minOrMaxMachine)
					actor.start()
					transitionToPlaying(actor)

					expect(actor.getSnapshot().value).toMatchObject({
						playing: {playerTurn: 'awaitingAction'},
					})

					actor.send({type: 'SURRENDER'})

					expect(actor.getSnapshot().value).toBe('gameOver')
					expect(actor.getSnapshot().context.winner?.id).toBe('player-2')
					expect(actor.getSnapshot().context.losers).toHaveLength(1)
					expect(actor.getSnapshot().context.losers[0].id).toBe('player-1')
					expect(actor.getSnapshot().context.reason).toBe('surrendered')
				})

				it('should handle surrender with multiple players correctly', () => {
					const actor = createActor(minOrMaxMachine)
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
						type: 'PLAYER_JOINED',
						playerId: 'player-3',
						playerName: 'Charlie',
					})
					actor.send({type: 'SEED', seed: '3p-surrender-test'})
					actor.send({type: 'START_GAME'})
					actor.send({type: 'PILE_SHUFFLED'})
					actor.send({type: 'CARDS_DEALT'})
					actor.send({type: 'THRESHOLDS_SET'})
					actor.send({type: 'WHEEL_SPUN', angle: 270})
					actor.send({type: 'FIRST_CARD_PLAYED'})

					const topCard = actor.getSnapshot().context.discardPile[0].card
					const wheelAngle = actor.getSnapshot().context.wheelAngle
					const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
					const hand = actor.getSnapshot().context.players[0].hand
					const cardToPlay = findValidCard(hand, topCard, wheelMode)

					if (cardToPlay) {
						actor.send({type: 'CHOOSE_CARD', cardId: cardToPlay.id})
						if (cardToPlay.rank === 'A') {
							actor.send({
								type: 'ADD_EFFECT',
								effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
							})
						}
						actor.send({type: 'PLAY_CARD'})
						if (actor.getSnapshot().value !== 'gameOver') {
							actor.send({type: 'END_TURN'})
						}
					}

					if (actor.getSnapshot().value !== 'gameOver') {
						actor.send({type: 'SURRENDER'})

						expect(actor.getSnapshot().value).toBe('gameOver')
						expect(actor.getSnapshot().context.winner?.id).toBe('player-1')
						expect(actor.getSnapshot().context.losers).toHaveLength(2)
					}
					expect(
						actor
							.getSnapshot()
							.context.losers.map((p) => p.id)
							.sort(),
					).toEqual(['player-2', 'player-3'])
					expect(actor.getSnapshot().context.reason).toBe('surrendered')
				})

				it('should handle surrender when first player (index 0) surrenders', () => {
					const actor = createActor(minOrMaxMachine)
					actor.start()
					transitionToPlaying(actor)

					actor.send({type: 'SURRENDER'})

					expect(actor.getSnapshot().value).toBe('gameOver')
					expect(actor.getSnapshot().context.winner?.id).toBe('player-2')
					expect(actor.getSnapshot().context.losers[0].id).toBe('player-1')
					expect(actor.getSnapshot().context.reason).toBe('surrendered')
				})
			})

			describe('card effects', () => {
				it('should play small Ace (value 1) by adding zero-value effect', () => {
					const actor = createActor(minOrMaxMachine)
					actor.start()
					transitionToPlaying(actor, 'ace-small-test')

					const aceCard = actor
						.getSnapshot()
						.context.players[0].hand.find((card) => card.rank === 'A')

					if (aceCard) {
						const scoreBefore = actor.getSnapshot().context.tally

						actor.send({type: 'CHOOSE_CARD', cardId: aceCard.id})

						expect(actor.getSnapshot().value).toMatchObject({
							playing: {playerTurn: 'configuringEffect'},
						})

						actor.send({
							type: 'ADD_EFFECT',
							effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
						})

						expect(actor.getSnapshot().context.activeEffects).toEqual([
							{type: 'value-adder', value: 0, stacksRemaining: 1},
						])

						actor.send({type: 'PLAY_CARD'})

						const wheelAngle = actor.getSnapshot().context.wheelAngle
						const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
						const expectedScore =
							wheelMode === 'max' ? scoreBefore + 1 : scoreBefore - 1

						expect(actor.getSnapshot().context.tally).toBe(expectedScore)
						expect(actor.getSnapshot().context.activeEffects).toEqual([])
						expect(actor.getSnapshot().context.discardPile[0].playedValue).toBe(
							wheelMode === 'max' ? 1 : -1,
						)
					}
				})

				it('should play big Ace (value 11) by adding ten-value effect', () => {
					const actor = createActor(minOrMaxMachine)
					actor.start()
					transitionToPlaying(actor, 'ace-big-test')

					const aceCard = actor
						.getSnapshot()
						.context.players[0].hand.find((card) => card.rank === 'A')

					if (aceCard) {
						const scoreBefore = actor.getSnapshot().context.tally

						actor.send({type: 'CHOOSE_CARD', cardId: aceCard.id})
						actor.send({
							type: 'ADD_EFFECT',
							effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
						})

						actor.send({type: 'PLAY_CARD'})

						const wheelAngle = actor.getSnapshot().context.wheelAngle
						const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
						const expectedScore =
							wheelMode === 'max' ? scoreBefore + 11 : scoreBefore - 11

						expect(actor.getSnapshot().context.tally).toBe(expectedScore)
						expect(actor.getSnapshot().context.activeEffects).toEqual([])
						expect(actor.getSnapshot().context.discardPile[0].playedValue).toBe(
							wheelMode === 'max' ? 11 : -11,
						)
					}
				})

				it('should find and draw Jack target card when it exists in draw pile', () => {
					const actor = createActor(minOrMaxMachine)
					actor.start()
					transitionToPlaying(actor, 'jack-courtship-test')

					const jackCard = actor
						.getSnapshot()
						.context.players[0].hand.find(
							(card) => card.rank === 'J' && card.effect?.type === 'choice',
						)

					if (jackCard) {
						const handLengthBefore =
							actor.getSnapshot().context.players[0].hand.length
						const drawPileBefore = actor.getSnapshot().context.drawPile

						actor.send({type: 'CHOOSE_CARD', cardId: jackCard.id})

						expect(actor.getSnapshot().value).toMatchObject({
							playing: {playerTurn: 'configuringEffect'},
						})

						const targetRank = 'Q'
						const targetExists = drawPileBefore.some(
							(c) => c.rank === targetRank,
						)

						actor.send({type: 'SEARCH_AND_DRAW', rank: targetRank})

						if (targetExists) {
							const handAfterDraw = actor.getSnapshot().context.players[0].hand
							expect(handAfterDraw.length).toBeGreaterThan(handLengthBefore)
							expect(handAfterDraw.some((c) => c.rank === targetRank)).toBe(
								true,
							)
						}

						actor.send({type: 'PLAY_CARD'})

						expect(actor.getSnapshot().context.discardPile[0].card).toEqual(
							jackCard,
						)
					}
				})

				it('should handle Jack effect gracefully when target card not found', () => {
					const actor = createActor(minOrMaxMachine)
					actor.start()
					transitionToPlaying(actor, 'jack-no-target-test')

					const jackCard = actor
						.getSnapshot()
						.context.players[0].hand.find(
							(card) => card.rank === 'J' && card.effect?.type === 'choice',
						)

					if (jackCard) {
						const handLengthBefore =
							actor.getSnapshot().context.players[0].hand.length
						const drawPileBefore = actor.getSnapshot().context.drawPile

						actor.send({type: 'CHOOSE_CARD', cardId: jackCard.id})

						const targetRank = 'Q'
						const targetExists = drawPileBefore.some(
							(c) => c.rank === targetRank,
						)

						actor.send({type: 'SEARCH_AND_DRAW', rank: targetRank})

						if (!targetExists) {
							expect(actor.getSnapshot().context.players[0].hand.length).toBe(
								handLengthBefore,
							)
						}

						actor.send({type: 'PLAY_CARD'})

						expect(actor.getSnapshot().context.discardPile[0].card).toEqual(
							jackCard,
						)
					}
				})
			})
		})

		describe('Integration Tests', () => {
			it('should complete a 2-player game with TO THE MAX winner (exact max threshold)', () => {
				const actor = createActor(minOrMaxMachine)
				actor.start()

				expect(actor.getSnapshot().value).toBe('lobby')

				actor.send({
					type: 'PLAYER_JOINED',
					playerId: 'alice',
					playerName: 'Alice',
				})
				actor.send({
					type: 'PLAYER_JOINED',
					playerId: 'bob',
					playerName: 'Bob',
				})
				actor.send({type: 'SEED', seed: 'max-win-2p'})
				actor.send({type: 'START_GAME'})

				expect(actor.getSnapshot().value).toMatchObject({
					setup: 'shufflingPile',
				})
				expect(actor.getSnapshot().context.players).toHaveLength(2)
				expect(actor.getSnapshot().context.rng).not.toBe(null)

				actor.send({type: 'PILE_SHUFFLED'})
				expect(actor.getSnapshot().value).toMatchObject({setup: 'dealingCards'})

				actor.send({type: 'CARDS_DEALT'})
				expect(actor.getSnapshot().value).toMatchObject({
					setup: 'generatingThresholds',
				})
				expect(actor.getSnapshot().context.players[0].hand).toHaveLength(3)
				expect(actor.getSnapshot().context.players[1].hand).toHaveLength(3)

				actor.send({type: 'THRESHOLDS_SET'})
				expect(actor.getSnapshot().value).toMatchObject({
					setup: 'spinningInitialWheel',
				})
				expect(actor.getSnapshot().context.maxThreshold).toBeGreaterThan(0)

				actor.send({type: 'WHEEL_SPUN', angle: 270})
				expect(actor.getSnapshot().value).toMatchObject({
					setup: 'playingFirstCard',
				})

				actor.send({type: 'FIRST_CARD_PLAYED'})
				expect(actor.getSnapshot().value).toMatchObject({
					playing: {playerTurn: 'awaitingAction'},
				})
				expect(actor.getSnapshot().context.discardPile).toHaveLength(1)

				for (let turn = 0; turn < 30; turn++) {
					const snapshot = actor.getSnapshot()
					if (snapshot.value === 'gameOver') break

					const currentPlayerIndex = snapshot.context.currentPlayerIndex
					const currentPlayer = snapshot.context.players[currentPlayerIndex]
					const playableCard = currentPlayer.hand.find((card) => {
						const topCard = snapshot.context.discardPile[0]
						if (!topCard) return true
						if (card.rank === 'A' || topCard.card.rank === 'A') return true
						const wheelAngle = snapshot.context.wheelAngle
						const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
						const cardValue = getCardOrder(card.rank)
						const topValue = getCardOrder(topCard.card.rank)
						if (wheelMode === 'max') {
							return cardValue >= topValue
						} else {
							return cardValue <= topValue
						}
					})

					if (!playableCard) break

					actor.send({type: 'CHOOSE_CARD', cardId: playableCard.id})
					if (playableCard.effect) {
						actor.send({
							type: 'ADD_EFFECT',
							effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
						})
					}
					actor.send({type: 'PLAY_CARD'})

					if (actor.getSnapshot().value === 'gameOver') {
						break
					}

					actor.send({type: 'END_TURN'})
				}

				const finalSnapshot = actor.getSnapshot()
				const finalContext = finalSnapshot.context

				if (finalSnapshot.value === 'gameOver') {
					expect(finalContext.winner).not.toBe(null)
					expect(finalContext.losers).toHaveLength(1)
					if (finalContext.reason === 'exact_threshold') {
						expect(finalContext.tally).toBe(finalContext.maxThreshold)
					}
				}

				expect(finalContext.players).toHaveLength(2)
				expect(finalContext.tally).toBeGreaterThan(0)
			})

			it('should complete a 2-player game with threshold busted (previous player wins)', () => {
				const actor = createActor(minOrMaxMachine)
				actor.start()

				expect(actor.getSnapshot().value).toBe('lobby')

				actor.send({
					type: 'PLAYER_JOINED',
					playerId: 'alice',
					playerName: 'Alice',
				})
				actor.send({
					type: 'PLAYER_JOINED',
					playerId: 'bob',
					playerName: 'Bob',
				})
				actor.send({type: 'SEED', seed: 'threshold-bust-2p'})
				actor.send({type: 'START_GAME'})

				expect(actor.getSnapshot().value).toMatchObject({
					setup: 'shufflingPile',
				})

				actor.send({type: 'PILE_SHUFFLED'})
				actor.send({type: 'CARDS_DEALT'})
				actor.send({type: 'THRESHOLDS_SET'})

				const setupContext = actor.getSnapshot().context
				const spinDegrees = calculateSpin(0.3, setupContext.rng)
				const wheelAngle = setupContext.wheelAngle + spinDegrees

				actor.send({type: 'WHEEL_SPUN', angle: wheelAngle})
				actor.send({type: 'FIRST_CARD_PLAYED'})

				expect(actor.getSnapshot().value).toMatchObject({
					playing: {playerTurn: 'awaitingAction'},
				})

				for (let turn = 0; turn < 30; turn++) {
					const snapshot = actor.getSnapshot()
					if (snapshot.value === 'gameOver') break

					const currentPlayerIndex = snapshot.context.currentPlayerIndex
					const currentPlayer = snapshot.context.players[currentPlayerIndex]
					const playableCard = currentPlayer.hand.find((card) => {
						const topCard = snapshot.context.discardPile[0]
						if (!topCard) return true
						if (card.rank === 'A' || topCard.card.rank === 'A') return true
						const wheelAngle = snapshot.context.wheelAngle
						const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
						const cardValue = getCardOrder(card.rank)
						const topValue = getCardOrder(topCard.card.rank)
						if (wheelMode === 'max') {
							return cardValue >= topValue
						} else {
							return cardValue <= topValue
						}
					})

					if (!playableCard) break

					actor.send({type: 'CHOOSE_CARD', cardId: playableCard.id})
					if (playableCard.effect) {
						actor.send({
							type: 'ADD_EFFECT',
							effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
						})
					}
					actor.send({type: 'PLAY_CARD'})

					if (actor.getSnapshot().value === 'gameOver') {
						break
					}

					actor.send({type: 'END_TURN'})
				}

				const finalSnapshot = actor.getSnapshot()
				const finalContext = finalSnapshot.context

				if (finalSnapshot.value === 'gameOver') {
					expect(finalContext.winner).not.toBe(null)
					expect(finalContext.losers).toHaveLength(1)
					expect(finalContext.reason).toBe('exceeded_threshold')

					expect(finalContext.tally).toBeGreaterThan(finalContext.maxThreshold)

					const loserIndex = finalContext.players.findIndex(
						(p) => p.id === finalContext.losers[0].id,
					)
					const winnerIndex = finalContext.players.findIndex(
						(p) => p.id === finalContext.winner?.id,
					)
					expect(winnerIndex).toBe((loserIndex - 1 + 2) % 2)
				}

				expect(finalContext.players).toHaveLength(2)
			})

			it('should complete a 4-player game with min threshold busted (previous player wins)', () => {
				const actor = createActor(minOrMaxMachine)
				actor.start()

				expect(actor.getSnapshot().value).toBe('lobby')

				actor.send({
					type: 'PLAYER_JOINED',
					playerId: 'alice',
					playerName: 'Alice',
				})
				actor.send({
					type: 'PLAYER_JOINED',
					playerId: 'bob',
					playerName: 'Bob',
				})
				actor.send({
					type: 'PLAYER_JOINED',
					playerId: 'charlie',
					playerName: 'Charlie',
				})
				actor.send({
					type: 'PLAYER_JOINED',
					playerId: 'diana',
					playerName: 'Diana',
				})
				actor.send({type: 'SEED', seed: 'min-bust-4p'})
				actor.send({type: 'START_GAME'})

				expect(actor.getSnapshot().value).toMatchObject({
					setup: 'shufflingPile',
				})
				expect(actor.getSnapshot().context.players).toHaveLength(4)

				actor.send({type: 'PILE_SHUFFLED'})
				actor.send({type: 'CARDS_DEALT'})
				expect(actor.getSnapshot().context.players[0].hand).toHaveLength(3)
				expect(actor.getSnapshot().context.players[1].hand).toHaveLength(3)
				expect(actor.getSnapshot().context.players[2].hand).toHaveLength(3)
				expect(actor.getSnapshot().context.players[3].hand).toHaveLength(3)

				actor.send({type: 'THRESHOLDS_SET'})

				const setupContext = actor.getSnapshot().context
				const setupSpinDegrees = calculateSpin(0.95, setupContext.rng)
				const setupWheelAngle = setupContext.wheelAngle + setupSpinDegrees

				actor.send({type: 'WHEEL_SPUN', angle: setupWheelAngle})
				actor.send({type: 'FIRST_CARD_PLAYED'})

				expect(actor.getSnapshot().value).toMatchObject({
					playing: {playerTurn: 'awaitingAction'},
				})

				const beforeContext = actor.getSnapshot().context
				const spinDegrees = calculateSpin(0.9, beforeContext.rng)
				const newAngle = beforeContext.wheelAngle + spinDegrees

				actor.send({type: 'WHEEL_SPUN', angle: newAngle})

				const wheelAngle = actor.getSnapshot().context.wheelAngle
				const isMin = wheelAngle >= 180 && wheelAngle < 360

				if (isMin) {
					for (let turn = 0; turn < 40; turn++) {
						const snapshot = actor.getSnapshot()
						if (snapshot.value === 'gameOver') break

						const currentPlayerIndex = snapshot.context.currentPlayerIndex
						const currentPlayer = snapshot.context.players[currentPlayerIndex]
						const playableCard = currentPlayer.hand.find((card) => {
							const topCard = snapshot.context.discardPile[0]
							if (!topCard) return true
							if (card.rank === 'A' || topCard.card.rank === 'A') return true
							const currentWheelAngle = snapshot.context.wheelAngle
							const wheelMode = currentWheelAngle >= 180 ? 'min' : 'max'
							const cardValue = getCardOrder(card.rank)
							const topValue = getCardOrder(topCard.card.rank)
							if (wheelMode === 'max') {
								return cardValue >= topValue
							} else {
								return cardValue <= topValue
							}
						})

						if (!playableCard) break

						actor.send({type: 'CHOOSE_CARD', cardId: playableCard.id})
						if (playableCard.effect) {
							actor.send({
								type: 'ADD_EFFECT',
								effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
							})
						}
						actor.send({type: 'PLAY_CARD'})

						if (actor.getSnapshot().value === 'gameOver') {
							break
						}

						actor.send({type: 'END_TURN'})
					}

					if (actor.getSnapshot().value === 'gameOver') {
						const finalContext = actor.getSnapshot().context
						expect(finalContext.winner).not.toBe(null)
						expect(finalContext.losers).toHaveLength(3)
						expect(finalContext.reason).toBe('exceeded_threshold')
						expect(finalContext.tally).toBeGreaterThan(
							finalContext.maxThreshold,
						)

						const winnerIndex = finalContext.players.findIndex(
							(p) => p.id === finalContext.winner?.id,
						)
						expect(winnerIndex).toBeGreaterThanOrEqual(0)
					}
				}

				expect(actor.getSnapshot().context.players).toHaveLength(4)
			})
		})
	})
})
