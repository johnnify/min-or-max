import {getServerByName} from 'partyserver'
import {GameRoom} from './GameRoom'

export {GameRoom}

export default {
	async fetch(
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url)

		if (url.pathname === '/healthz') {
			return new Response('OK', {status: 200})
		}

		if (env.ALLOWED_ORIGINS) {
			const origin = request.headers.get('Origin')
			if (!origin) {
				return new Response('Forbidden', {status: 403})
			}
			const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
			if (!allowedOrigins.includes(origin)) {
				return new Response('Forbidden', {status: 403})
			}
		}

		const apiRoomPrefix = '/api/room/'
		if (url.pathname.startsWith(apiRoomPrefix)) {
			const roomId = url.pathname.slice(apiRoomPrefix.length)

			if (!roomId) {
				return new Response('Missing roomId', {status: 400})
			}

			const stub = await getServerByName(
				env.GAME_ROOM as unknown as DurableObjectNamespace<GameRoom>,
				roomId,
			)
			return stub.fetch(request)
		}

		return new Response('Not Found', {status: 404})
	},
} satisfies ExportedHandler<Env>
