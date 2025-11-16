import {describe, it, expect} from 'vitest'
import {getModeFromWheelAngle, canCardBeatTopCard} from './utils'
import type {Card} from './types'

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

describe('canCardBeatTopCard', () => {
	const createCard = (
		rank: Card['rank'],
		suit: Card['suit'] = 'hearts',
	): Card => ({
		id: `${rank}-${suit}`,
		rank,
		suit,
	})

	it('returns true when there is no top card', () => {
		const card = createCard('5')
		expect(canCardBeatTopCard(card, null, 90)).toBe(true)
	})

	it('allows Aces to be played on any card', () => {
		const ace = createCard('A')
		const topCard = createCard('K')
		expect(canCardBeatTopCard(ace, topCard, 90)).toBe(true)
		expect(canCardBeatTopCard(ace, topCard, 270)).toBe(true)
	})

	it('allows any card to be played on an Ace', () => {
		const card = createCard('2')
		const topAce = createCard('A')
		expect(canCardBeatTopCard(card, topAce, 90)).toBe(true)
		expect(canCardBeatTopCard(card, topAce, 270)).toBe(true)
	})

	describe('max mode (wheelAngle < 180)', () => {
		const wheelAngle = 90

		it('allows cards with value >= top card', () => {
			const topCard = createCard('5')
			expect(canCardBeatTopCard(createCard('5'), topCard, wheelAngle)).toBe(
				true,
			)
			expect(canCardBeatTopCard(createCard('6'), topCard, wheelAngle)).toBe(
				true,
			)
			expect(canCardBeatTopCard(createCard('10'), topCard, wheelAngle)).toBe(
				true,
			)
			expect(canCardBeatTopCard(createCard('K'), topCard, wheelAngle)).toBe(
				true,
			)
		})

		it('rejects cards with value < top card', () => {
			const topCard = createCard('5')
			expect(canCardBeatTopCard(createCard('2'), topCard, wheelAngle)).toBe(
				false,
			)
			expect(canCardBeatTopCard(createCard('3'), topCard, wheelAngle)).toBe(
				false,
			)
			expect(canCardBeatTopCard(createCard('4'), topCard, wheelAngle)).toBe(
				false,
			)
		})
	})

	describe('min mode (wheelAngle >= 180)', () => {
		const wheelAngle = 270

		it('allows cards with value <= top card', () => {
			const topCard = createCard('5')
			expect(canCardBeatTopCard(createCard('2'), topCard, wheelAngle)).toBe(
				true,
			)
			expect(canCardBeatTopCard(createCard('3'), topCard, wheelAngle)).toBe(
				true,
			)
			expect(canCardBeatTopCard(createCard('5'), topCard, wheelAngle)).toBe(
				true,
			)
		})

		it('rejects cards with value > top card', () => {
			const topCard = createCard('5')
			expect(canCardBeatTopCard(createCard('6'), topCard, wheelAngle)).toBe(
				false,
			)
			expect(canCardBeatTopCard(createCard('10'), topCard, wheelAngle)).toBe(
				false,
			)
			expect(canCardBeatTopCard(createCard('K'), topCard, wheelAngle)).toBe(
				false,
			)
		})
	})

	it('handles face cards correctly', () => {
		const topCard = createCard('J')
		expect(canCardBeatTopCard(createCard('Q'), topCard, 90)).toBe(true)
		expect(canCardBeatTopCard(createCard('K'), topCard, 90)).toBe(true)
		expect(canCardBeatTopCard(createCard('9'), topCard, 90)).toBe(false)
	})
})
