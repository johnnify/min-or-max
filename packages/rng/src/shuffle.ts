import type {Rng} from './Rng'

/**
 * Shuffle an array using the Fisher-Yates algorithm with a seeded RNG.
 * Returns a new shuffled array without mutating the original.
 *
 * @example
 * ```ts
 * const rng = new Rng('my-seed')
 * const cards = ['A', 'K', 'Q', 'J']
 * const shuffled = shuffle(cards, rng) // → deterministic shuffle
 * ```
 */
export const shuffle = <T>(array: T[], rng: Rng): T[] => {
	const shuffled = [...array]
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = rng.nextInt(0, i)
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}
	return shuffled
}
