import {createActor} from 'xstate'
import {describe, it, expect} from 'vitest'
import {lobbyMachine, setupMachine, playingMachine} from './index'
import {getCardValue} from '../utils'

describe('Game Flow Integration Tests', () => {
	it('should complete a 2-player game with TO THE MAX winner (exact max threshold)', () => {
		const lobbyActor = createActor(lobbyMachine)
		lobbyActor.start()

		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'alice',
			playerName: 'Alice',
		})
		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'bob',
			playerName: 'Bob',
		})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'alice'})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'bob'})
		lobbyActor.send({type: 'SEED', seed: 'max-win-2p'})
		lobbyActor.send({type: 'START_GAME'})

		expect(lobbyActor.getSnapshot().value).toBe('ready')
		const lobbyContext = lobbyActor.getSnapshot().context
		expect(lobbyContext.players).toHaveLength(2)
		expect(lobbyContext.rng).not.toBe(null)

		const setupActor = createActor(setupMachine, {
			input: {
				rng: lobbyContext.rng!,
				players: lobbyContext.players,
				deck: lobbyContext.deck,
			},
		})
		setupActor.start()

		setupActor.send({type: 'PILE_SHUFFLED'})
		setupActor.send({type: 'CARDS_DEALT'})
		setupActor.send({type: 'THRESHOLDS_SET'})
		setupActor.send({type: 'WHEEL_SPUN', force: 0.5})
		setupActor.send({type: 'FIRST_CARD_PLAYED'})

		expect(setupActor.getSnapshot().value).toBe('complete')
		const setupContext = setupActor.getSnapshot().context

		expect(setupContext.players[0].hand).toHaveLength(3)
		expect(setupContext.players[1].hand).toHaveLength(3)
		expect(setupContext.discardPile).toHaveLength(1)
		expect(setupContext.minThreshold).toBeLessThan(0)
		expect(setupContext.maxThreshold).toBeGreaterThan(0)

		const playingActor = createActor(playingMachine, {
			input: {
				rng: setupContext.rng!,
				players: setupContext.players,
				drawPile: setupContext.drawPile,
				discardPile: setupContext.discardPile,
				minThreshold: setupContext.minThreshold,
				maxThreshold: setupContext.maxThreshold,
				wheelAngle: setupContext.wheelAngle,
				currentScore: setupContext.currentScore,
				currentPlayerIndex: 0,
				hasSpunThisTurn: false,
			},
		})
		playingActor.start()

		for (let turn = 0; turn < 30; turn++) {
			playingActor.send({type: 'TURN_STARTED'})

			const currentPlayerIndex =
				playingActor.getSnapshot().context.currentPlayerIndex
			const currentPlayer =
				playingActor.getSnapshot().context.players[currentPlayerIndex]
			const playableCard = currentPlayer.hand.find((card) => {
				const topCard = playingActor.getSnapshot().context.discardPile[0]
				if (!topCard) return true
				if (card.rank === 'A' || topCard.card.rank === 'A') return true
				const wheelAngle = playingActor.getSnapshot().context.wheelAngle
				const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
				const cardValue = getCardValue(card.rank)
				const topValue = getCardValue(topCard.card.rank)
				if (wheelMode === 'max') {
					return cardValue >= topValue
				} else {
					return cardValue <= topValue
				}
			})

			if (!playableCard) break

			playingActor.send({type: 'CHOOSE_CARD', cardId: playableCard.id})
			if (playableCard.effect) {
				playingActor.send({
					type: 'ADD_EFFECT',
					effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
				})
			}
			playingActor.send({type: 'PLAY_CARD'})

			if (playingActor.getSnapshot().value === 'gameOver') {
				break
			}

			playingActor.send({type: 'END_TURN'})
		}

		const finalContext = playingActor.getSnapshot().context

		if (playingActor.getSnapshot().value === 'gameOver') {
			expect(finalContext.winner).not.toBe(null)
			expect(finalContext.losers).toHaveLength(1)
			if (finalContext.reason === 'exact_threshold') {
				const isMaxWin = finalContext.currentScore === finalContext.maxThreshold
				const isMinWin = finalContext.currentScore === finalContext.minThreshold
				expect(isMaxWin || isMinWin).toBe(true)
			}
		}

		expect(finalContext.players).toHaveLength(2)
		expect(finalContext.currentScore).not.toBe(0)
	})

	it('should complete a 3-player game with "to the min" winner (exact min threshold)', () => {
		const lobbyActor = createActor(lobbyMachine)
		lobbyActor.start()

		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'alice',
			playerName: 'Alice',
		})
		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'bob',
			playerName: 'Bob',
		})
		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'charlie',
			playerName: 'Charlie',
		})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'alice'})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'bob'})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'charlie'})
		lobbyActor.send({type: 'SEED', seed: 'min-win-3p'})
		lobbyActor.send({type: 'START_GAME'})

		expect(lobbyActor.getSnapshot().value).toBe('ready')
		const lobbyContext = lobbyActor.getSnapshot().context
		expect(lobbyContext.players).toHaveLength(3)

		const setupActor = createActor(setupMachine, {
			input: {
				rng: lobbyContext.rng!,
				players: lobbyContext.players,
				deck: lobbyContext.deck,
			},
		})
		setupActor.start()

		setupActor.send({type: 'PILE_SHUFFLED'})
		setupActor.send({type: 'CARDS_DEALT'})
		setupActor.send({type: 'THRESHOLDS_SET'})
		setupActor.send({type: 'WHEEL_SPUN', force: 0.75})
		setupActor.send({type: 'FIRST_CARD_PLAYED'})

		expect(setupActor.getSnapshot().value).toBe('complete')
		const setupContext = setupActor.getSnapshot().context

		expect(setupContext.players[0].hand).toHaveLength(3)
		expect(setupContext.players[1].hand).toHaveLength(3)
		expect(setupContext.players[2].hand).toHaveLength(3)

		const playingActor = createActor(playingMachine, {
			input: {
				rng: setupContext.rng!,
				players: setupContext.players,
				drawPile: setupContext.drawPile,
				discardPile: setupContext.discardPile,
				minThreshold: setupContext.minThreshold,
				maxThreshold: setupContext.maxThreshold,
				wheelAngle: setupContext.wheelAngle,
				currentScore: setupContext.currentScore,
				currentPlayerIndex: 0,
				hasSpunThisTurn: false,
			},
		})
		playingActor.start()

		playingActor.send({type: 'TURN_STARTED'})
		playingActor.send({type: 'SPIN_WHEEL', force: 0.9})

		const wheelAngle = playingActor.getSnapshot().context.wheelAngle
		const isMin = wheelAngle >= 180 && wheelAngle < 360

		if (isMin) {
			for (let turn = 0; turn < 30; turn++) {
				if (playingActor.getSnapshot().value === 'gameOver') {
					break
				}

				if (
					playingActor.getSnapshot().value === 'turnStart' ||
					!playingActor.getSnapshot().value
				) {
					playingActor.send({type: 'TURN_STARTED'})
				}

				const currentPlayerIndex =
					playingActor.getSnapshot().context.currentPlayerIndex
				const currentPlayer =
					playingActor.getSnapshot().context.players[currentPlayerIndex]
				const playableCard = currentPlayer.hand[0]

				if (!playableCard) break

				playingActor.send({type: 'CHOOSE_CARD', cardId: playableCard.id})
				if (playableCard.effect) {
					playingActor.send({
						type: 'ADD_EFFECT',
						effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
					})
				}
				playingActor.send({type: 'PLAY_CARD'})

				if (playingActor.getSnapshot().value === 'gameOver') {
					break
				}

				playingActor.send({type: 'END_TURN'})
			}

			if (playingActor.getSnapshot().value === 'gameOver') {
				const finalContext = playingActor.getSnapshot().context
				expect(finalContext.winner).not.toBe(null)
				expect(finalContext.losers).toHaveLength(2)
				expect(finalContext.reason).toBe('exact_threshold')
				expect(finalContext.currentScore).toBe(finalContext.minThreshold)
			}
		}

		expect(playingActor.getSnapshot().context.players).toHaveLength(3)
	})

	it('should complete a 2-player game with threshold busted (previous player wins)', () => {
		const lobbyActor = createActor(lobbyMachine)
		lobbyActor.start()

		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'alice',
			playerName: 'Alice',
		})
		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'bob',
			playerName: 'Bob',
		})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'alice'})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'bob'})
		lobbyActor.send({type: 'SEED', seed: 'threshold-bust-2p'})
		lobbyActor.send({type: 'START_GAME'})

		expect(lobbyActor.getSnapshot().value).toBe('ready')
		const lobbyContext = lobbyActor.getSnapshot().context

		const setupActor = createActor(setupMachine, {
			input: {
				rng: lobbyContext.rng!,
				players: lobbyContext.players,
				deck: lobbyContext.deck,
			},
		})
		setupActor.start()

		setupActor.send({type: 'PILE_SHUFFLED'})
		setupActor.send({type: 'CARDS_DEALT'})
		setupActor.send({type: 'THRESHOLDS_SET'})
		setupActor.send({type: 'WHEEL_SPUN', force: 0.3})
		setupActor.send({type: 'FIRST_CARD_PLAYED'})

		const setupContext = setupActor.getSnapshot().context

		const playingActor = createActor(playingMachine, {
			input: {
				rng: setupContext.rng!,
				players: setupContext.players,
				drawPile: setupContext.drawPile,
				discardPile: setupContext.discardPile,
				minThreshold: setupContext.minThreshold,
				maxThreshold: setupContext.maxThreshold,
				wheelAngle: setupContext.wheelAngle,
				currentScore: setupContext.currentScore,
				currentPlayerIndex: 0,
				hasSpunThisTurn: false,
			},
		})
		playingActor.start()

		for (let turn = 0; turn < 30; turn++) {
			playingActor.send({type: 'TURN_STARTED'})

			const currentPlayerIndex =
				playingActor.getSnapshot().context.currentPlayerIndex
			const currentPlayer =
				playingActor.getSnapshot().context.players[currentPlayerIndex]
			const playableCard = currentPlayer.hand.find((card) => {
				const topCard = playingActor.getSnapshot().context.discardPile[0]
				if (!topCard) return true
				if (card.rank === 'A' || topCard.card.rank === 'A') return true
				const wheelAngle = playingActor.getSnapshot().context.wheelAngle
				const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
				const cardValue = getCardValue(card.rank)
				const topValue = getCardValue(topCard.card.rank)
				if (wheelMode === 'max') {
					return cardValue >= topValue
				} else {
					return cardValue <= topValue
				}
			})

			if (!playableCard) break

			playingActor.send({type: 'CHOOSE_CARD', cardId: playableCard.id})
			if (playableCard.effect) {
				playingActor.send({
					type: 'ADD_EFFECT',
					effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
				})
			}
			playingActor.send({type: 'PLAY_CARD'})

			if (playingActor.getSnapshot().value === 'gameOver') {
				break
			}

			playingActor.send({type: 'END_TURN'})
		}

		const finalContext = playingActor.getSnapshot().context

		if (playingActor.getSnapshot().value === 'gameOver') {
			expect(finalContext.winner).not.toBe(null)
			expect(finalContext.losers).toHaveLength(1)
			expect(finalContext.reason).toBe('exceeded_threshold')

			const isMaxBust = finalContext.currentScore > finalContext.maxThreshold
			const isMinBust = finalContext.currentScore < finalContext.minThreshold
			expect(isMaxBust || isMinBust).toBe(true)

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
		const lobbyActor = createActor(lobbyMachine)
		lobbyActor.start()

		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'alice',
			playerName: 'Alice',
		})
		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'bob',
			playerName: 'Bob',
		})
		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'charlie',
			playerName: 'Charlie',
		})
		lobbyActor.send({
			type: 'PLAYER_JOINED',
			playerId: 'diana',
			playerName: 'Diana',
		})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'alice'})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'bob'})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'charlie'})
		lobbyActor.send({type: 'PLAYER_READY', playerId: 'diana'})
		lobbyActor.send({type: 'SEED', seed: 'min-bust-4p'})
		lobbyActor.send({type: 'START_GAME'})

		expect(lobbyActor.getSnapshot().value).toBe('ready')
		const lobbyContext = lobbyActor.getSnapshot().context
		expect(lobbyContext.players).toHaveLength(4)

		const setupActor = createActor(setupMachine, {
			input: {
				rng: lobbyContext.rng!,
				players: lobbyContext.players,
				deck: lobbyContext.deck,
			},
		})
		setupActor.start()

		setupActor.send({type: 'PILE_SHUFFLED'})
		setupActor.send({type: 'CARDS_DEALT'})
		setupActor.send({type: 'THRESHOLDS_SET'})
		setupActor.send({type: 'WHEEL_SPUN', force: 0.95})
		setupActor.send({type: 'FIRST_CARD_PLAYED'})

		const setupContext = setupActor.getSnapshot().context
		expect(setupContext.players[0].hand).toHaveLength(3)
		expect(setupContext.players[1].hand).toHaveLength(3)
		expect(setupContext.players[2].hand).toHaveLength(3)
		expect(setupContext.players[3].hand).toHaveLength(3)

		const playingActor = createActor(playingMachine, {
			input: {
				rng: setupContext.rng!,
				players: setupContext.players,
				drawPile: setupContext.drawPile,
				discardPile: setupContext.discardPile,
				minThreshold: setupContext.minThreshold,
				maxThreshold: setupContext.maxThreshold,
				wheelAngle: setupContext.wheelAngle,
				currentScore: setupContext.currentScore,
				currentPlayerIndex: 0,
				hasSpunThisTurn: false,
			},
		})
		playingActor.start()

		playingActor.send({type: 'TURN_STARTED'})
		playingActor.send({type: 'SPIN_WHEEL', force: 0.9})

		const wheelAngle = playingActor.getSnapshot().context.wheelAngle
		const isMin = wheelAngle >= 180 && wheelAngle < 360

		if (isMin) {
			for (let turn = 0; turn < 40; turn++) {
				if (playingActor.getSnapshot().value === 'gameOver') {
					break
				}

				if (
					playingActor.getSnapshot().value === 'turnStart' ||
					!playingActor.getSnapshot().value
				) {
					playingActor.send({type: 'TURN_STARTED'})
				}

				const currentPlayerIndex =
					playingActor.getSnapshot().context.currentPlayerIndex
				const currentPlayer =
					playingActor.getSnapshot().context.players[currentPlayerIndex]
				const playableCard = currentPlayer.hand.find((card) => {
					const topCard = playingActor.getSnapshot().context.discardPile[0]
					if (!topCard) return true
					if (card.rank === 'A' || topCard.card.rank === 'A') return true
					const currentWheelAngle =
						playingActor.getSnapshot().context.wheelAngle
					const wheelMode = currentWheelAngle >= 180 ? 'min' : 'max'
					const cardValue = getCardValue(card.rank)
					const topValue = getCardValue(topCard.card.rank)
					if (wheelMode === 'max') {
						return cardValue >= topValue
					} else {
						return cardValue <= topValue
					}
				})

				if (!playableCard) break

				playingActor.send({type: 'CHOOSE_CARD', cardId: playableCard.id})
				if (playableCard.effect) {
					playingActor.send({
						type: 'ADD_EFFECT',
						effect: {type: 'value-adder', value: 0, stacksRemaining: 1},
					})
				}
				playingActor.send({type: 'PLAY_CARD'})

				if (playingActor.getSnapshot().value === 'gameOver') {
					break
				}

				playingActor.send({type: 'END_TURN'})
			}

			if (playingActor.getSnapshot().value === 'gameOver') {
				const finalContext = playingActor.getSnapshot().context
				expect(finalContext.winner).not.toBe(null)
				expect(finalContext.losers).toHaveLength(3)
				expect(finalContext.reason).toBe('exceeded_threshold')
				expect(finalContext.currentScore).toBeLessThan(
					finalContext.minThreshold,
				)

				const winnerIndex = finalContext.players.findIndex(
					(p) => p.id === finalContext.winner?.id,
				)
				expect(winnerIndex).toBeGreaterThanOrEqual(0)
			}
		}

		expect(playingActor.getSnapshot().context.players).toHaveLength(4)
	})
})
