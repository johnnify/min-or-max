import {DAY_IN_SECONDS} from '$lib/constants'
import type {PageServerLoad} from './$types'

export const load: PageServerLoad = async ({setHeaders}) => {
	setHeaders({'Cache-Control': `public, max-age=${DAY_IN_SECONDS}`})

	return {
		meta: {
			title: 'Terms of Service',
			description: 'Find out more about our legal terms of service',
		},
	}
}
