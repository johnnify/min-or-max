import {DAY_IN_SECONDS} from '$lib/constants'
import type {PageServerLoad} from './$types'

export const prerender = false

export const load: PageServerLoad = async ({setHeaders, params: {roomId}}) => {
	setHeaders({'Cache-Control': `public, max-age=${DAY_IN_SECONDS}`})

	return {
		meta: {
			title: `Playroom ${roomId}`,
			description: `Playing Min or Max in Playroom ${roomId}!`,
		},
	}
}
