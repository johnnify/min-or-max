import {describe, it, expect, vi, beforeEach} from 'vitest'

const mockStubFetch = vi.fn()

vi.mock('partyserver', () => ({
	getServerByName: vi.fn(() => Promise.resolve({fetch: mockStubFetch})),
	Server: class {},
}))

import worker from './index'

const mockEnv = {
	ALLOWED_ORIGINS: 'http://localhost:5173,https://example.com',
	GAME_ROOM: {},
	MATCHMAKER: {},
} as Env
const mockCtx = {} as ExecutionContext

describe('Worker routing', () => {
	beforeEach(() => {
		mockStubFetch.mockReset()
		mockStubFetch.mockResolvedValue(new Response('OK', {status: 200}))
	})

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

	it('returns 403 when Origin header is from disallowed origin', async () => {
		const request = new Request('https://example.com/api/room/test-room-123', {
			headers: {
				Origin: 'https://malicious-site.com',
			},
		})
		const response = await worker.fetch(request, mockEnv, mockCtx)

		expect(response.status).toBe(403)
		expect(await response.text()).toBe('Forbidden')
	})

	it('routes to game room when Origin header is from allowed origin', async () => {
		const request = new Request('https://example.com/api/room/test-room-123', {
			headers: {
				Origin: 'http://localhost:5173',
			},
		})
		const response = await worker.fetch(request, mockEnv, mockCtx)

		expect(response.status).toBe(200)
		expect(mockStubFetch).toHaveBeenCalledWith(request)
	})

	it('rejects request when Origin header is missing', async () => {
		const request = new Request('https://example.com/api/room/test-room-123')
		const response = await worker.fetch(request, mockEnv, mockCtx)

		expect(response.status).toBe(403)
		expect(await response.text()).toBe('Forbidden')
	})

	it('routes to matchmaker for quickplay endpoint', async () => {
		const request = new Request('https://example.com/api/quickplay', {
			method: 'POST',
			headers: {Origin: 'http://localhost:5173'},
		})
		const response = await worker.fetch(request, mockEnv, mockCtx)

		expect(response.status).toBe(200)
		expect(mockStubFetch).toHaveBeenCalledWith(request)
	})
})
