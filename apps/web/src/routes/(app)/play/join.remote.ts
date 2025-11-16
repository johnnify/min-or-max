import {z} from 'zod/v4'
import {redirect} from '@sveltejs/kit'
import {form} from '$app/server'

const joinRoomSchema = z.object({
	code: z.string().min(1, 'Code is required to join a specific room'),
})

export const joinRoom = form(joinRoomSchema, async ({code}) => {
	redirect(303, `/play/${code}`)
})
