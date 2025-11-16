import {dev} from '$app/environment'
import {DAY_IN_MS} from '$lib/constants'
import {type Handle} from '@sveltejs/kit'

const anonUserIdCookieName = 'anonUserId'

export const authHandle: Handle = async ({event, resolve}) => {
	// TODO: Upgrade to support logged-in eponymous auth too!
	let anonUserId = event.cookies.get(anonUserIdCookieName)
	if (!anonUserId) {
		anonUserId = crypto.randomUUID()
		event.cookies.set(anonUserIdCookieName, anonUserId, {
			path: '/',
			expires: new Date(Date.now() + DAY_IN_MS * 30),
			secure: !dev,
			httpOnly: true,
			sameSite: 'lax',
		})
	}

	event.locals.anonUserId = anonUserId

	return resolve(event)
}
