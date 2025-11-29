import {describe, it, expect} from 'vitest'
import {
	getModeFromWheelAngle,
	canCardBeatTopCard,
	determineAutoPlayAction,
	createPlayedCard,
	createCard,
	getCardValue,
	getCardOrder,
} from './utils'
import type {Card, Player, PlayedCard} from './types'

describe('getCardValue', () => {
	it('returns correct values for number cards', () => {
		expect(getCardValue('2')).toBe(2)
		expect(getCardValue('5')).toBe(5)
		expect(getCardValue('10')).toBe(10)
	})

	it('returns 1 for Ace (base value before effect)', () => {
		expect(getCardValue('A')).toBe(1)
	})

	it('returns 10 for all face cards (scoring value)', () => {
		expect(getCardValue('J')).toBe(10)
		expect(getCardValue('Q')).toBe(10)
		expect(getCardValue('K')).toBe(10)
	})
})

describe('getCardOrder', () => {
	it('returns correct order for number cards', () => {
		expect(getCardOrder('2')).toBe(2)
		expect(getCardOrder('5')).toBe(5)
		expect(getCardOrder('10')).toBe(10)
	})

	it('returns 1 for Ace', () => {
		expect(getCardOrder('A')).toBe(1)
	})

	it('returns distinct ascending values for face cards (10 < J < Q < K)', () => {
		const tenOrder = getCardOrder('10')
		const jackOrder = getCardOrder('J')
		const queenOrder = getCardOrder('Q')
		const kingOrder = getCardOrder('K')

		expect(tenOrder).toBe(10)
		expect(jackOrder).toBe(11)
		expect(queenOrder).toBe(12)
		expect(kingOrder).toBe(13)

		expect(tenOrder).toBeLessThan(jackOrder)
		expect(jackOrder).toBeLessThan(queenOrder)
		expect(queenOrder).toBeLessThan(kingOrder)
	})
})

describe('getModeFromWheelAngle', () => {
	it('returns max mode for angles in the first half of rotation (0-179 degrees)', () => {
		expect(getModeFromWheelAngle(0)).toBe('max')
		expect(getModeFromWheelAngle(90)).toBe('max')
		expect(getModeFromWheelAngle(179)).toBe('max')
	})

	it('returns min mode for angles in the second half of rotation (180-359 degrees)', () => {
		expect(getModeFromWheelAngle(180)).toBe('min')
		expect(getModeFromWheelAngle(270)).toBe('min')
		expect(getModeFromWheelAngle(359)).toBe('min')
	})

	it('handles angles greater than 360 by normalizing them', () => {
		expect(getModeFromWheelAngle(360)).toBe('max')
		expect(getModeFromWheelAngle(450)).toBe('max')
		expect(getModeFromWheelAngle(540)).toBe('min')
		expect(getModeFromWheelAngle(720)).toBe('max')
	})

	it('handles negative angles by normalizing them', () => {
		expect(getModeFromWheelAngle(-90)).toBe('min')
		expect(getModeFromWheelAngle(-180)).toBe('min')
		expect(getModeFromWheelAngle(-270)).toBe('max')
	})

	it('handles very large angles', () => {
		expect(getModeFromWheelAngle(2880)).toBe('max')
		expect(getModeFromWheelAngle(2970)).toBe('max')
	})
})

const createTestCard = (
	rank: Card['rank'],
	suit: Card['suit'] = 'hearts',
): Card => ({
	id: `${rank}-${suit}`,
	rank,
	suit,
})

describe('canCardBeatTopCard', () => {
	it('returns true when there is no top card', () => {
		const card = createTestCard('5')
		expect(canCardBeatTopCard(card, null, 90)).toBe(true)
	})

	it('allows Aces to be played on any card', () => {
		const ace = createTestCard('A')
		const topCard = createTestCard('K')
		expect(canCardBeatTopCard(ace, topCard, 90)).toBe(true)
		expect(canCardBeatTopCard(ace, topCard, 270)).toBe(true)
	})

	it('allows any card to be played on an Ace', () => {
		const card = createTestCard('2')
		const topAce = createTestCard('A')
		expect(canCardBeatTopCard(card, topAce, 90)).toBe(true)
		expect(canCardBeatTopCard(card, topAce, 270)).toBe(true)
	})

	describe('max mode (wheelAngle < 180)', () => {
		const wheelAngle = 90

		it('allows cards with value >= top card', () => {
			const topCard = createTestCard('5')
			expect(canCardBeatTopCard(createTestCard('5'), topCard, wheelAngle)).toBe(
				true,
			)
			expect(canCardBeatTopCard(createTestCard('6'), topCard, wheelAngle)).toBe(
				true,
			)
			expect(
				canCardBeatTopCard(createTestCard('10'), topCard, wheelAngle),
			).toBe(true)
			expect(canCardBeatTopCard(createTestCard('K'), topCard, wheelAngle)).toBe(
				true,
			)
		})

		it('rejects cards with value < top card', () => {
			const topCard = createTestCard('5')
			expect(canCardBeatTopCard(createTestCard('2'), topCard, wheelAngle)).toBe(
				false,
			)
			expect(canCardBeatTopCard(createTestCard('3'), topCard, wheelAngle)).toBe(
				false,
			)
			expect(canCardBeatTopCard(createTestCard('4'), topCard, wheelAngle)).toBe(
				false,
			)
		})
	})

	describe('min mode (wheelAngle >= 180)', () => {
		const wheelAngle = 270

		it('allows cards with value <= top card', () => {
			const topCard = createTestCard('5')
			expect(canCardBeatTopCard(createTestCard('2'), topCard, wheelAngle)).toBe(
				true,
			)
			expect(canCardBeatTopCard(createTestCard('3'), topCard, wheelAngle)).toBe(
				true,
			)
			expect(canCardBeatTopCard(createTestCard('5'), topCard, wheelAngle)).toBe(
				true,
			)
		})

		it('rejects cards with value > top card', () => {
			const topCard = createTestCard('5')
			expect(canCardBeatTopCard(createTestCard('6'), topCard, wheelAngle)).toBe(
				false,
			)
			expect(
				canCardBeatTopCard(createTestCard('10'), topCard, wheelAngle),
			).toBe(false)
			expect(canCardBeatTopCard(createTestCard('K'), topCard, wheelAngle)).toBe(
				false,
			)
		})
	})

	it('handles face cards correctly', () => {
		const topCard = createTestCard('J')
		expect(canCardBeatTopCard(createTestCard('Q'), topCard, 90)).toBe(true)
		expect(canCardBeatTopCard(createTestCard('K'), topCard, 90)).toBe(true)
		expect(canCardBeatTopCard(createTestCard('9'), topCard, 90)).toBe(false)
	})
})

describe('determineAutoPlayAction', () => {
	const createPlayer = (id: string, hand: Card[], name = 'Player'): Player => ({
		id,
		name,
		isReady: true,
		hand,
		wins: 0,
	})

	const createContext = (
		players: Player[],
		currentPlayerIndex: number,
		discardPile: PlayedCard[],
		wheelAngle: number,
		hasSpunThisTurn: boolean,
	) => ({
		players,
		currentPlayerIndex,
		discardPile,
		wheelAngle,
		hasSpunThisTurn,
	})

	it('returns null when player is not the current player', () => {
		const player1 = createPlayer('player-1', [createCard('hearts', '5')])
		const player2 = createPlayer('player-2', [createCard('diamonds', '6')])
		const context = createContext([player1, player2], 0, [], 90, false)

		expect(determineAutoPlayAction(context, 'player-2')).toBeNull()
	})

	it('returns null when player ID does not match any player', () => {
		const player1 = createPlayer('player-1', [createCard('hearts', '5')])
		const context = createContext([player1], 0, [], 90, false)

		expect(determineAutoPlayAction(context, 'unknown-player')).toBeNull()
	})

	it('returns play_card when the current player has a valid card', () => {
		const card = createCard('hearts', '8')
		const player = createPlayer('player-1', [card])
		const topCard = createPlayedCard(createCard('diamonds', '5'), 5)
		const context = createContext([player], 0, [topCard], 90, false)

		const result = determineAutoPlayAction(context, 'player-1')

		expect(result).toEqual({type: 'play_card', cardId: 'hearts-8'})
	})

	it('finds the first valid card in hand when some cards cannot beat top card', () => {
		const invalidCard = createCard('hearts', '3')
		const validCard = createCard('diamonds', '7')
		const player = createPlayer('player-1', [invalidCard, validCard])
		const topCard = createPlayedCard(createCard('spades', '5'), 5)
		const context = createContext([player], 0, [topCard], 90, false)

		const result = determineAutoPlayAction(context, 'player-1')

		expect(result).toEqual({type: 'play_card', cardId: 'diamonds-7'})
	})

	it('returns play_card with any card when discard pile is empty', () => {
		const card = createCard('hearts', '2')
		const player = createPlayer('player-1', [card])
		const context = createContext([player], 0, [], 90, false)

		const result = determineAutoPlayAction(context, 'player-1')

		expect(result).toEqual({type: 'play_card', cardId: 'hearts-2'})
	})

	it('returns spin when no valid card exists and has not spun this turn', () => {
		const card = createCard('hearts', '3')
		const player = createPlayer('player-1', [card])
		const topCard = createPlayedCard(createCard('diamonds', '8'), 8)
		const context = createContext([player], 0, [topCard], 90, false)

		const result = determineAutoPlayAction(context, 'player-1')

		expect(result).toEqual({type: 'spin'})
	})

	it('returns end_turn when no valid card exists and has already spun', () => {
		const card = createCard('hearts', '3')
		const player = createPlayer('player-1', [card])
		const topCard = createPlayedCard(createCard('diamonds', '8'), 8)
		const context = createContext([player], 0, [topCard], 90, true)

		const result = determineAutoPlayAction(context, 'player-1')

		expect(result).toEqual({type: 'end_turn'})
	})

	it('respects wheel mode when determining valid cards (min mode)', () => {
		const lowCard = createCard('hearts', '3')
		const highCard = createCard('diamonds', '9')
		const player = createPlayer('player-1', [highCard, lowCard])
		const topCard = createPlayedCard(createCard('spades', '5'), 5)
		const context = createContext([player], 0, [topCard], 270, false)

		const result = determineAutoPlayAction(context, 'player-1')

		expect(result).toEqual({type: 'play_card', cardId: 'hearts-3'})
	})

	it('allows Ace to be played on any card regardless of wheel mode', () => {
		const ace = createCard('hearts', 'A')
		const player = createPlayer('player-1', [ace])
		const topCard = createPlayedCard(createCard('diamonds', 'K'), 10)
		const context = createContext([player], 0, [topCard], 90, false)

		const result = determineAutoPlayAction(context, 'player-1')

		expect(result).toEqual({type: 'play_card', cardId: 'hearts-A'})
	})
})
