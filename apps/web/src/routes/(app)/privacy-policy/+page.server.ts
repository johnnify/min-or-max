import {DAY_IN_SECONDS} from '$lib/constants'
import type {PageServerLoad} from './$types'

export const load: PageServerLoad = async ({setHeaders}) => {
	setHeaders({'Cache-Control': `public, max-age=${DAY_IN_SECONDS}`})

	return {
		meta: {
			title: 'Privacy Policy',
			description:
				'Read our Privacy Policy and learn more about how we use your data, and keep it safe.',
		},
	}
}
