import {describe, it, expect} from 'vitest'
import worker from './index'
import type {Env} from './types'

const mockEnv = {
	ALLOWED_ORIGINS: 'http://localhost:5173,https://example.com',
} as Env
const mockCtx = {} as ExecutionContext

describe('Worker routing', () => {
	it('routes to healthz without Origin check', async () => {
		const request = new Request('https://example.com/healthz')
		const response = await worker.fetch(request, mockEnv, mockCtx)

		expect(response.status).toBe(200)
		expect(await response.text()).toBe('OK')
	})

	it('returns 404 for unknown routes with valid Origin', async () => {
		const request = new Request('https://example.com/unknown', {
			headers: {Origin: 'http://localhost:5173'},
		})
		const response = await worker.fetch(request, mockEnv, mockCtx)

		expect(response.status).toBe(404)
		expect(await response.text()).toBe('Not Found')
	})

	it('returns 400 when roomId is missing with valid Origin', async () => {
		const request = new Request('https://example.com/api/room/', {
			headers: {Origin: 'http://localhost:5173'},
		})
		const response = await worker.fetch(request, mockEnv, mockCtx)

		expect(response.status).toBe(400)
		expect(await response.text()).toBe('Missing roomId')
	})

	it('returns 426 when WebSocket upgrade header is missing with valid Origin', async () => {
		const request = new Request('https://example.com/api/room/test-room-123', {
			headers: {Origin: 'http://localhost:5173'},
		})
		const response = await worker.fetch(request, mockEnv, mockCtx)

		expect(response.status).toBe(426)
		expect(await response.text()).toBe('Expected WebSocket')
	})

	it('returns 403 when Origin header is from disallowed origin', async () => {
		const request = new Request('https://example.com/api/room/test-room-123', {
			headers: {
				Upgrade: 'websocket',
				Origin: 'https://malicious-site.com',
			},
		})
		const response = await worker.fetch(request, mockEnv, mockCtx)

		expect(response.status).toBe(403)
		expect(await response.text()).toBe('Forbidden')
	})

	it('allows request when Origin header is from allowed origin', async () => {
		const mockEnvWithDO = {
			...mockEnv,
			GAME_ROOM: {
				idFromName: () => ({}) as DurableObjectId,
				get: () =>
					({
						fetch: async () => new Response('OK', {status: 200}),
					}) as unknown as DurableObjectStub,
			} as unknown as DurableObjectNamespace,
		}

		const request = new Request('https://example.com/api/room/test-room-123', {
			headers: {
				Upgrade: 'websocket',
				Origin: 'http://localhost:5173',
			},
		})
		const response = await worker.fetch(request, mockEnvWithDO, mockCtx)

		expect(response.status).toBe(200)
	})

	it('rejects request when Origin header is missing', async () => {
		const request = new Request('https://example.com/api/room/test-room-123', {
			headers: {
				Upgrade: 'websocket',
			},
		})
		const response = await worker.fetch(request, mockEnv, mockCtx)

		expect(response.status).toBe(403)
		expect(await response.text()).toBe('Forbidden')
	})
})
