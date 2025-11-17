import {DAY_IN_SECONDS} from '$lib/constants'
import type {PageServerLoad} from './$types'

export const load: PageServerLoad = async ({setHeaders}) => {
	setHeaders({'Cache-Control': `public, max-age=${DAY_IN_SECONDS}`})

	return {
		meta: {
			title: 'Scoreboard',
			description:
				'A look at various stages of our scoreboard that keeps track of how close you are to getting TO THE MAX!',
		},
	}
}
