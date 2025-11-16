import {DAY_IN_SECONDS} from '$lib/constants'
import type {PageServerLoad} from './$types'

export const load: PageServerLoad = async ({setHeaders}) => {
	setHeaders({'Cache-Control': `public, max-age=${DAY_IN_SECONDS}`})

	return {
		meta: {
			title: 'Cards',
			description:
				'A catalogue of all cards that appear in the Min or Max game.',
		},
	}
}
