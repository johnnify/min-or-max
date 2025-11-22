import {describe, it, expect, vi} from 'vitest'

vi.mock('partyserver', () => ({
	Server: class {},
}))

import {
	generateRoomCode,
	isLegitRoomCode,
	ROOM_CODE_CHARS,
	ROOM_CODE_LENGTH,
} from './Matchmaker'

describe('generateRoomCode', () => {
	it('generates codes of exactly 6 characters', () => {
		for (let i = 0; i < 100; i++) {
			const code = generateRoomCode()
			expect(code).toHaveLength(ROOM_CODE_LENGTH)
		}
	})

	it('only uses valid card characters', () => {
		for (let i = 0; i < 100; i++) {
			const code = generateRoomCode()
			for (const char of code) {
				expect(ROOM_CODE_CHARS).toContain(char)
			}
		}
	})
})

describe('isLegitRoomCode', () => {
	it('accepts valid 6-character codes', () => {
		expect(isLegitRoomCode('234567')).toBe(true)
		expect(isLegitRoomCode('JQKAJQ')).toBe(true)
		expect(isLegitRoomCode('2J4K6A')).toBe(true)
		expect(isLegitRoomCode('999999')).toBe(true)
	})

	it('rejects codes that are too short', () => {
		expect(isLegitRoomCode('23456')).toBe(false)
		expect(isLegitRoomCode('JQK')).toBe(false)
		expect(isLegitRoomCode('')).toBe(false)
	})

	it('rejects codes that are too long', () => {
		expect(isLegitRoomCode('2345678')).toBe(false)
		expect(isLegitRoomCode('JQKAJQKA')).toBe(false)
	})

	it('rejects codes with invalid characters', () => {
		expect(isLegitRoomCode('012345')).toBe(false)
		expect(isLegitRoomCode('10JQKA')).toBe(false)
		expect(isLegitRoomCode('abcdef')).toBe(false)
		expect(isLegitRoomCode('jqkajq')).toBe(false)
		expect(isLegitRoomCode('23-456')).toBe(false)
		expect(isLegitRoomCode('23 456')).toBe(false)
	})

	it('rejects manually-created room IDs', () => {
		expect(isLegitRoomCode('test-room-123')).toBe(false)
		expect(isLegitRoomCode('my-room')).toBe(false)
		expect(isLegitRoomCode('lobby1')).toBe(false)
	})
})
