import type {Env} from './types'
export {GameRoom} from './GameRoom'

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

		if (url.pathname.startsWith('/api/room/')) {
			const roomId = url.pathname.slice('/api/room/'.length)

			if (!roomId) {
				return new Response('Missing roomId', {status: 400})
			}

			const upgradeHeader = request.headers.get('Upgrade')
			if (upgradeHeader !== 'websocket') {
				return new Response('Expected WebSocket', {status: 426})
			}

			const id = env.GAME_ROOM.idFromName(roomId)
			const stub = env.GAME_ROOM.get(id)

			return stub.fetch(request)
		}

		return new Response('Not Found', {status: 404})
	},
} satisfies ExportedHandler<Env>
