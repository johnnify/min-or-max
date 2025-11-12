import {error} from '@sveltejs/kit'
import type {PageServerLoad} from './$types'

export const prerender = false

export const load: PageServerLoad = async () => {
	// use this route to easily customise and test our error page
	error(500, 'This is a test error. No cause for alarm.')
}
