import {z} from 'zod/v4'
import {redirect} from '@sveltejs/kit'

import {form, getRequestEvent} from '$app/server'
import {PUBLIC_API_URL} from '$env/static/public'

type ApiQuickplayResponse = {
	roomId: string
}

export const quickplay = form(async () => {
	const {fetch} = getRequestEvent()
	const response = await fetch(`${PUBLIC_API_URL}/api/quickplay`, {
		method: 'POST',
	})
	const {roomId} = (await response.json()) as ApiQuickplayResponse
	redirect(303, `/play/${roomId}`)
})

const joinRoomSchema = z.object({
	code: z.string().min(1, 'Code is required to join a specific room'),
})

export const joinRoom = form(joinRoomSchema, async ({code}) => {
	redirect(303, `/play/${code}`)
})
