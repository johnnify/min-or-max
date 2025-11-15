import {describe, it, expect} from 'vitest'
import {createActor} from 'xstate'
import {lobbyMachine, setupMachine, playingMachine} from '@repo/state'
import type {Player} from '@repo/state'
import {getCardValue} from '@repo/state'
import {canPlayerSendEvent} from './validation'
import {getNextPhase, createTransitionInput} from './transitions'

describe('Orchestrator Happy Path Story', () => {
	it('should orchestrate complete 2-player game from lobby to game over', () => {
		// Start in lobby
		let currentActor = createActor(lobbyMachine)
		currentActor.start()

		// Player 1 joins
		const joinP1 = {
			type: 'PLAYER_JOINED' as const,
			playerId: 'p1',
			playerName: 'Alice',
		}
		const canP1Join = canPlayerSendEvent(
			currentActor.getSnapshot(),
			joinP1,
			'p1',
		)
		expect(canP1Join.allowed).toBe(true)
		currentActor.send(joinP1)

		// Player 2 joins
		const joinP2 = {
			type: 'PLAYER_JOINED' as const,
			playerId: 'p2',
			playerName: 'Bob',
		}
		const canP2Join = canPlayerSendEvent(
			currentActor.getSnapshot(),
			joinP2,
			'p2',
		)
		expect(canP2Join.allowed).toBe(true)
		currentActor.send(joinP2)

		// Both players ready up
		currentActor.send({type: 'PLAYER_READY', playerId: 'p1'})
		currentActor.send({type: 'PLAYER_READY', playerId: 'p2'})
		currentActor.send({type: 'SEED', seed: 'happy-path-test'})

		// Start game
		const startGame = {type: 'START_GAME' as const}
		const canStart = canPlayerSendEvent(
			currentActor.getSnapshot(),
			startGame,
			'p1',
		)
		expect(canStart.allowed).toBe(true)
		currentActor.send(startGame)

		// Check transition to setup
		expect(currentActor.getSnapshot().value).toBe('ready')
		const nextPhase = getNextPhase(currentActor.getSnapshot())
		expect(nextPhase).toBe('setup')

		// Transition to setup
		const setupInput = createTransitionInput(
			'setup',
			currentActor.getSnapshot(),
		)
		expect(setupInput).not.toBe(null)
		if (!setupInput || !('deck' in setupInput)) {
			throw new Error('Setup input is missing deck')
		}

		const setupActor = createActor(setupMachine, {input: setupInput})
		setupActor.start()

		// Go through setup steps (automated in server)
		setupActor.send({type: 'PILE_SHUFFLED'})
		setupActor.send({type: 'CARDS_DEALT'})
		setupActor.send({type: 'THRESHOLDS_SET'})
		setupActor.send({type: 'WHEEL_SPUN', force: 0.5})
		setupActor.send({type: 'FIRST_CARD_PLAYED'})

		// Check transition to playing
		expect(setupActor.getSnapshot().value).toBe('complete')
		const nextPhaseAfterSetup = getNextPhase(setupActor.getSnapshot())
		expect(nextPhaseAfterSetup).toBe('playing')

		// Transition to playing
		const playingInput = createTransitionInput(
			'playing',
			setupActor.getSnapshot(),
		)
		expect(playingInput).not.toBe(null)
		if (!playingInput || !('drawPile' in playingInput)) {
			throw new Error('Playing input is missing drawPile')
		}

		const playingActor = createActor(playingMachine, {input: playingInput})
		playingActor.start()

		// Verify we're in playerTurn state (auto-transitioned from turnStart)
		expect(playingActor.getSnapshot().value).toMatchObject({
			playerTurn: 'awaitingAction',
		})

		// Player 1's turn - they are current player
		const p1Context = playingActor.getSnapshot().context
		expect(p1Context.players[p1Context.currentPlayerIndex].id).toBe('p1')

		// Player 2 tries to play but shouldn't be allowed
		const p2TryPlay = {type: 'CHOOSE_CARD' as const, cardId: 'any-card'}
		const canP2Play = canPlayerSendEvent(
			playingActor.getSnapshot(),
			p2TryPlay,
			'p2',
		)
		expect(canP2Play.allowed).toBe(false)
		expect(canP2Play.reason).toBe('Not your turn')

		// Player 1 can play
		const p1Hand = p1Context.players[0].hand
		const playableCard = p1Hand.find((card) => {
			const topCard = p1Context.discardPile[0]
			if (!topCard) return true
			if (card.rank === 'A' || topCard.card.rank === 'A') return true
			const wheelAngle = p1Context.wheelAngle
			const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
			const cardValue = getCardValue(card.rank)
			const topValue = getCardValue(topCard.card.rank)
			if (wheelMode === 'max') {
				return cardValue >= topValue
			} else {
				return cardValue <= topValue
			}
		})

		expect(playableCard).toBeDefined()

		const chooseCard = {type: 'CHOOSE_CARD' as const, cardId: playableCard!.id}
		const canP1Choose = canPlayerSendEvent(
			playingActor.getSnapshot(),
			chooseCard,
			'p1',
		)
		expect(canP1Choose.allowed).toBe(true)
		playingActor.send(chooseCard)

		// Play the card
		const playCard = {type: 'PLAY_CARD' as const}
		const canP1PlayCard = canPlayerSendEvent(
			playingActor.getSnapshot(),
			playCard,
			'p1',
		)
		expect(canP1PlayCard.allowed).toBe(true)
		playingActor.send(playCard)

		// Check we're in postCardPlay or gameOver
		const afterPlayValue = playingActor.getSnapshot().value
		const isGameOver = afterPlayValue === 'gameOver'
		const isPostCardPlay =
			typeof afterPlayValue === 'object' &&
			'playerTurn' in afterPlayValue &&
			afterPlayValue.playerTurn === 'postCardPlay'

		expect(isGameOver || isPostCardPlay).toBe(true)

		// If not game over, end turn
		if (!isGameOver) {
			const endTurn = {type: 'END_TURN' as const}
			const canP1EndTurn = canPlayerSendEvent(
				playingActor.getSnapshot(),
				endTurn,
				'p1',
			)
			expect(canP1EndTurn.allowed).toBe(true)
			playingActor.send(endTurn)

			// Now it should be player 2's turn (auto-transitioned to their turn)
			const p2Context = playingActor.getSnapshot().context
			expect(p2Context.players[p2Context.currentPlayerIndex].id).toBe('p2')
			expect(playingActor.getSnapshot().value).toMatchObject({
				playerTurn: 'awaitingAction',
			})
		}

		// Play until game over (max 30 turns to prevent infinite loop)
		for (let turn = 0; turn < 30; turn++) {
			if (playingActor.getSnapshot().value === 'gameOver') {
				break
			}

			const context = playingActor.getSnapshot().context
			const currentPlayerHand = context.players[context.currentPlayerIndex].hand

			const canPlay = currentPlayerHand.find((card) => {
				const topCard = context.discardPile[0]
				if (!topCard) return true
				if (card.rank === 'A' || topCard.card.rank === 'A') return true
				const wheelAngle = context.wheelAngle
				const wheelMode = wheelAngle >= 180 ? 'min' : 'max'
				const cardValue = getCardValue(card.rank)
				const topValue = getCardValue(topCard.card.rank)
				if (wheelMode === 'max') {
					return cardValue >= topValue
				} else {
					return cardValue <= topValue
				}
			})

			if (!canPlay) {
				// Player must surrender
				playingActor.send({type: 'SURRENDER'})
				break
			}

			playingActor.send({type: 'CHOOSE_CARD', cardId: canPlay.id})
			if (canPlay.effect) {
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

		// Verify game ended
		expect(playingActor.getSnapshot().value).toBe('gameOver')
		const nextPhaseAfterPlaying = getNextPhase(playingActor.getSnapshot())
		expect(nextPhaseAfterPlaying).toBe('gameOver')

		// Verify winner and losers
		const finalContext = playingActor.getSnapshot().context
		expect(finalContext.winner).not.toBe(null)
		expect(finalContext.losers).toHaveLength(1)
		expect(finalContext.reason).toBeTruthy()

		// Verify all players still exist
		expect(finalContext.players).toHaveLength(2)
		expect(finalContext.players.some((p: Player) => p.id === 'p1')).toBe(true)
		expect(finalContext.players.some((p: Player) => p.id === 'p2')).toBe(true)
	})
})
