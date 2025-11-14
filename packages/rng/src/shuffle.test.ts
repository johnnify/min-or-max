import {describe, expect, it} from 'vitest'
import {Rng} from './Rng'
import {shuffle} from './shuffle'

describe('shuffle', () => {
	it('produces deterministic shuffles for the same seed', () => {
		const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
		const rng1 = new Rng('shuffle-test')
		const rng2 = new Rng('shuffle-test')

		const shuffled1 = shuffle(array, rng1)
		const shuffled2 = shuffle(array, rng2)

		expect(shuffled1).toEqual(shuffled2)
	})

	it('produces different shuffles for different seeds', () => {
		const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
		const rng1 = new Rng('seed-1')
		const rng2 = new Rng('seed-2')

		const shuffled1 = shuffle(array, rng1)
		const shuffled2 = shuffle(array, rng2)

		expect(shuffled1).not.toEqual(shuffled2)
	})

	it('does not mutate the original array', () => {
		const array = [1, 2, 3, 4, 5]
		const original = [...array]
		const rng = new Rng('mutation-test')

		shuffle(array, rng)

		expect(array).toEqual(original)
	})

	it('returns array with same elements', () => {
		const array = ['A', 'B', 'C', 'D', 'E']
		const rng = new Rng('elements-test')

		const shuffled = shuffle(array, rng)

		expect(shuffled.length).toBe(array.length)
		expect(shuffled.sort()).toEqual(array.sort())
	})

	it('handles empty array', () => {
		const array: number[] = []
		const rng = new Rng('empty-test')

		const shuffled = shuffle(array, rng)

		expect(shuffled).toEqual([])
	})

	it('handles single element array', () => {
		const array = [42]
		const rng = new Rng('single-test')

		const shuffled = shuffle(array, rng)

		expect(shuffled).toEqual([42])
	})

	it('actually shuffles the array', () => {
		const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
		const rng = new Rng('actual-shuffle-test')

		const shuffled = shuffle(array, rng)

		expect(shuffled).not.toEqual(array)
	})
})
