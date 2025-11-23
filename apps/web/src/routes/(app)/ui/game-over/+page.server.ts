import {DAY_IN_SECONDS} from '$lib/constants'
import type {PageServerLoad} from './$types'

export const load: PageServerLoad = async ({setHeaders}) => {
	setHeaders({'Cache-Control': `public, max-age=${DAY_IN_SECONDS}`})

	return {
		meta: {
			title: 'Game Over Screen',
			description:
				'A preview of our Game Over screen component in various states for design and development purposes.',
		},
	}
}
