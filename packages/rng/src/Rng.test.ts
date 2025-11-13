import {describe, expect, it} from 'vitest'
import {Rng} from './Rng'

describe('Rng', () => {
	it('produces deterministic sequences for the same seed', () => {
		const rng1 = new Rng('test-seed')
		const rng2 = new Rng('test-seed')

		const sequence1 = Array.from({length: 10}, () => rng1.next())
		const sequence2 = Array.from({length: 10}, () => rng2.next())

		expect(sequence1).toEqual(sequence2)
	})

	it('produces different sequences for different seeds', () => {
		const rng1 = new Rng('seed-1')
		const rng2 = new Rng('seed-2')

		const sequence1 = Array.from({length: 10}, () => rng1.next())
		const sequence2 = Array.from({length: 10}, () => rng2.next())

		expect(sequence1).not.toEqual(sequence2)
	})

	it('next() returns values in range [0, 1)', () => {
		const rng = new Rng('range-test')

		for (let i = 0; i < 1000; i++) {
			const value = rng.next()
			expect(value).toBeGreaterThanOrEqual(0)
			expect(value).toBeLessThan(1)
		}
	})

	it('nextInt() returns integers within specified inclusive range', () => {
		const rng = new Rng('int-test')
		const min = 1
		const max = 10

		const values = Array.from({length: 1000}, () => rng.nextInt(min, max))

		// All values should be integers
		values.forEach((value) => {
			expect(Number.isInteger(value)).toBe(true)
		})

		// All values should be within range (inclusive)
		values.forEach((value) => {
			expect(value).toBeGreaterThanOrEqual(min)
			expect(value).toBeLessThanOrEqual(max)
		})

		// Should produce both min and max values (eventually)
		expect(values).toContain(min)
		expect(values).toContain(max)
	})

	it('nextFloat() returns floats within specified range', () => {
		const rng = new Rng('float-test')
		const min = 10.5
		const max = 20.7

		for (let i = 0; i < 1000; i++) {
			const value = rng.nextFloat(min, max)
			expect(value).toBeGreaterThanOrEqual(min)
			expect(value).toBeLessThan(max)
		}
	})

	it('produces reasonable distribution of values', () => {
		const rng = new Rng('distribution-test')
		const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // 10 buckets

		// Generate 10000 samples and bucket them
		for (let i = 0; i < 10000; i++) {
			const value = rng.next()
			const bucketIndex = Math.floor(value * 10)
			buckets[bucketIndex]++
		}

		// Each bucket should have roughly 1000 values (±30% tolerance)
		// This catches catastrophically bad distributions
		buckets.forEach((count) => {
			expect(count).toBeGreaterThan(700)
			expect(count).toBeLessThan(1300)
		})
	})

	it('handles edge cases for nextInt', () => {
		const rng = new Rng('edge-test')

		// Single value range
		expect(rng.nextInt(5, 5)).toBe(5)
		expect(rng.nextInt(5, 5)).toBe(5)

		// Negative ranges
		const negValues = Array.from({length: 100}, () => rng.nextInt(-10, -5))
		negValues.forEach((value) => {
			expect(value).toBeGreaterThanOrEqual(-10)
			expect(value).toBeLessThanOrEqual(-5)
		})
	})

	it('maintains consistency across multiple calls', () => {
		const rng1 = new Rng('consistency-test')
		const rng2 = new Rng('consistency-test')

		// Mixed method calls should stay in sync
		expect(rng1.next()).toBe(rng2.next())
		expect(rng1.nextInt(1, 100)).toBe(rng2.nextInt(1, 100))
		expect(rng1.nextFloat(0, 1)).toBe(rng2.nextFloat(0, 1))
		expect(rng1.next()).toBe(rng2.next())
	})
})
