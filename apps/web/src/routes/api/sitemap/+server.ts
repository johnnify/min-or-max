import {json} from '@sveltejs/kit'
import type {RequestHandler} from './$types'

import {getAllUiRoutes} from '$lib/getAllUiRoutes'
import {DAY_IN_SECONDS} from '$lib/constants'

export const GET: RequestHandler = ({setHeaders}) => {
	setHeaders({'Cache-Control': `public, max-age=${DAY_IN_SECONDS}`})
	const routes = getAllUiRoutes()

	return json(routes)
}
