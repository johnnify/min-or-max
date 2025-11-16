import type {PageServerLoad} from './$types'

export const prerender = false

export const load: PageServerLoad = async ({
	params: {roomId},
	locals: {anonUserId},
	url,
}) => {
	return {
		seed: url.searchParams.get('seed'),
		player: {id: anonUserId, name: 'Anonymous'},
		meta: {
			title: `Playroom ${roomId}`,
			description: `Playing Min or Max in Playroom ${roomId}!`,
		},
	}
}
