/**
 * Seeded random number generator using cyrb128 hash and SFC32 PRNG algorithm.
 *
 * @example
 * ```ts
 * const rng = new Rng('my-seed')
 * rng.next() // → 0.12345... (always same for 'my-seed')
 * rng.nextInt(1, 10) // → random int between 1-10
 * rng.nextFloat(0, 100) // → random float between 0-100
 * ```
 */
export class Rng {
	#seed: string
	#a: number
	#b: number
	#c: number
	#d: number
	#callCount = 0

	constructor(seed: string) {
		this.#seed = seed
		const [a, b, c, d] = hashString(seed)
		this.#a = a
		this.#b = b
		this.#c = c
		this.#d = d
	}

	/** Returns a random number in the range [0, 1) */
	next = (): number => {
		this.#callCount++
		this.#a >>>= 0
		this.#b >>>= 0
		this.#c >>>= 0
		this.#d >>>= 0
		let t = (this.#a + this.#b) | 0
		this.#a = this.#b ^ (this.#b >>> 9)
		this.#b = (this.#c + (this.#c << 3)) | 0
		this.#c = (this.#c << 21) | (this.#c >>> 11)
		this.#d = (this.#d + 1) | 0
		t = (t + this.#d) | 0
		this.#c = (this.#c + t) | 0
		return (t >>> 0) / 4294967296
	}

	/** Returns a random integer in the range [min, max] (inclusive) */
	nextInt = (min: number, max: number): number => {
		return Math.floor(this.next() * (max - min + 1)) + min
	}

	/** Returns a random float in the range [min, max) */
	nextFloat = (min: number, max: number): number => {
		return this.next() * (max - min) + min
	}

	/** Get the seed used to create this RNG */
	get seed(): string {
		return this.#seed
	}

	/** Get the number of times next() has been called */
	get callCount(): number {
		return this.#callCount
	}

	/** Serialize the RNG state for transport */
	toJSON(): {seed: string; callCount: number} {
		return {
			seed: this.#seed,
			callCount: this.#callCount,
		}
	}

	/** Restore RNG state from serialized data */
	static fromJSON(data: {seed: string; callCount: number}): Rng {
		const rng = new Rng(data.seed)
		// Advance the RNG state to match the original call count
		for (let i = 0; i < data.callCount; i++) {
			rng.next()
		}
		return rng
	}
}

/**
 * Hash a string into four 32-bit seeds using cyrb128
 * This provides good distribution and consistent results across platforms
 */
const hashString = (str: string): [number, number, number, number] => {
	let h1 = 1779033703
	let h2 = 3144134277
	let h3 = 1013904242
	let h4 = 2773480762

	for (let i = 0; i < str.length; i++) {
		const k = str.charCodeAt(i)
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
	}

	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

	return [
		(h1 ^ h2 ^ h3 ^ h4) >>> 0,
		(h2 ^ h1) >>> 0,
		(h3 ^ h1) >>> 0,
		(h4 ^ h1) >>> 0,
	]
}
