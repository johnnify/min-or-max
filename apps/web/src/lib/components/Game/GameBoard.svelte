<script lang="ts">
	import {SvelteMap} from 'svelte/reactivity'
	import {createActor} from 'xstate'
	import {
		getPhaseFromState,
		minOrMaxMachine,
		isServerMessage,
		isStateSnapshot,
		isGameEvent,
		isMinOrMaxSnapshot,
		type ClientMessage,
	} from '@repo/state'
	import TickCircleIcon from '~icons/mdi/tick-circle-outline'

	import {PUBLIC_API_URL} from '$env/static/public'
	import Wheel from '$lib/components/Game/Wheel/Wheel.svelte'
	import {Button} from '$lib/components/ui/button'
	import Badge from '$lib/components/ui/badge/badge.svelte'
	import {browser} from '$app/environment'
	import {toast} from 'svelte-sonner'
	import {Spinner} from '../ui/spinner'

	type Props = {
		roomId: string
		player: {id: string; name: string}
		seed: string | null
	}
	let {roomId, player, seed}: Props = $props()

	let roomIdToWs = new SvelteMap<string, WebSocket>()

	let minOrMaxActor = $state(createActor(minOrMaxMachine))

	$effect(() => {
		minOrMaxActor.start()
		return () => minOrMaxActor.stop()
	})

	const sendMessage = (message: ClientMessage) => {
		const ws = roomIdToWs.get(roomId)
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message))
		}
	}

	$effect(() => {
		if (!browser || roomIdToWs.has(roomId)) return

		// close and delete any other connections
		roomIdToWs.forEach((ws, id) => {
			if (id === roomId) return

			ws.close()
			roomIdToWs.delete(id)
		})

		const wsBaseUrl = PUBLIC_API_URL.replace(/^http/, 'ws')
		const wsUrl = new URL('/api/room/', wsBaseUrl)

		if (seed) {
			wsUrl.searchParams.set('seed', seed)
		}

		const ws = new WebSocket(`${wsUrl}/api/room/${roomId}`)
		roomIdToWs.set(roomId, ws)

		ws.onopen = () => {
			ws.send(
				JSON.stringify({
					type: 'JOIN_GAME',
					playerId: player.id,
					playerName: player.name,
				}),
			)
		}

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data)

			if (!isServerMessage(data)) {
				console.error('Invalid server message:', data)
				return
			}

			if (isGameEvent(data)) {
				// Apply the event to the local state machine
				minOrMaxActor.send(data.event)
			} else if (isStateSnapshot(data)) {
				if (!isMinOrMaxSnapshot(data.state)) {
					console.error('Invalid snapshot:', data.state)
					return
				}

				minOrMaxActor.stop()
				minOrMaxActor = createActor(minOrMaxMachine, {
					snapshot: data.state,
				})
				minOrMaxActor.start()
			} else if (data.type === 'CONNECTED') {
				console.log('Connected as player:', data.playerId)
				sendMessage({type: 'READY'})
			} else if (data.type === 'ERROR') {
				toast.error(data.message)
			}
		}

		ws.onerror = (err) => {
			toast.error('There was an error with your multiplayer connection!')
			console.error('WebSocket error:', err)
		}

		ws.onclose = () => {
			roomIdToWs.delete(roomId)
		}
	})

	let isConnected = $derived(roomIdToWs.has(roomId))

	let gamePhase = $derived(getPhaseFromState(minOrMaxActor.getSnapshot().value))
	let gameState = $derived(minOrMaxActor.getSnapshot().context)
</script>

<div class="mb-[5svh] flex justify-between gap-4">
	<h1 class="text-muted-foreground">
		Playroom {roomId}
	</h1>
	<Badge variant="outline">
		{#if isConnected}
			<TickCircleIcon /> Connected
		{:else}
			<Spinner /> Connecting...
		{/if}
	</Badge>
</div>

{#if gamePhase === 'lobby'}
	<!-- Connected -->
	<div>
		<h2>Connected players</h2>
		<ul>
			<li>TODO: Player 1</li>
			<li>TODO: Player 2</li>
		</ul>
	</div>
	<Button onclick={() => sendMessage({type: 'START_GAME'})}>Start!</Button>
{:else}
	<div class="space-y-4">
		<aside class="grid grid-cols-12 gap-4 font-mono text-sm">
			<div class="col-span-3">
				<span>Min:</span>
				{gameState.minThreshold}
			</div>
			<div class="col-span-6 text-center text-2xl">
				<span class="text-sm">Tally:</span>
				{gameState.currentScore}
			</div>
			<div class="col-span-3 text-right">
				<span>Max:</span>
				{gameState.maxThreshold}
			</div>
		</aside>

		<section class="grid gap-8 py-8">
			TODO

			<div class="flex flex-col items-center">
				<!-- TODO: Actual angle -->
				<!-- TODO: Spin on click -->
				<!-- TODO: Only enabled if I can spin -->
				<Wheel angle={90} onclick={() => {}} disabled={false} />

				<div>
					<!-- TODO: Show top discard card-->
				</div>
			</div>

			<div class="text-center">
				<p class="mb-2 text-sm">
					{player.name} (You!)
					<!-- TODO: UI to make it obvious it's our turn -->
				</p>
				<div class="flex justify-center gap-2">TODO: My hand</div>
				<Button
					onclick={() => {
						// TODO: End turn
						// TODO: Only enabled if I actually can end my turn
					}}
					disabled={false}
				>
					End Turn
				</Button>
			</div>
		</section>
	</div>
{/if}
