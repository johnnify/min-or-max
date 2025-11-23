<script lang="ts">
	import {WebSocket as ReconnectingWebSocket} from 'partysocket'
	import {createActor} from 'xstate'
	import {toast} from 'svelte-sonner'
	import {
		getPhaseFromState,
		minOrMaxMachine,
		isServerMessage,
		isStateSnapshot,
		isGameEvent,
		isMinOrMaxSnapshot,
		type ClientMessage,
		type MinOrMaxSnapshot,
	} from '@repo/state'
	import {Rng} from '@repo/rng'
	import TickCircleIcon from '~icons/mdi/tick-circle-outline'

	import {browser} from '$app/environment'
	import {PUBLIC_API_URL} from '$env/static/public'
	import Badge from '$lib/components/ui/badge/badge.svelte'
	import {Spinner} from '$lib/components/ui/spinner'
	import Lobby from './Lobby.svelte'
	import GameBoard from './GameBoard.svelte'
	import GameOver from './GameOver.svelte'

	type Props = {
		roomId: string
		player: {id: string; name: string}
		seed: string | null
	}
	let {roomId, player, seed}: Props = $props()

	let socket = $state<ReconnectingWebSocket | null>(null)
	let isConnected = $state(false)

	let minOrMaxActor = $state(createActor(minOrMaxMachine))
	let actorSnapshot = $state<MinOrMaxSnapshot>()

	$effect(() => {
		const currentActor = minOrMaxActor
		currentActor.start()
		actorSnapshot = currentActor.getSnapshot()
		const subscription = currentActor.subscribe((snapshot) => {
			actorSnapshot = snapshot
		})
		return () => {
			subscription.unsubscribe()
			currentActor.stop()
		}
	})

	const sendMessage = (message: ClientMessage) => {
		if (socket) {
			socket.send(JSON.stringify(message))
		} else {
			toast.error('Not yet connected to the game server...')
		}
	}

	$effect(() => {
		if (!browser) return

		const wsBaseUrl = PUBLIC_API_URL.replace(/^http/, 'ws')
		const wsUrl = new URL(`/api/room/${roomId}`, wsBaseUrl)

		if (seed) {
			wsUrl.searchParams.set('seed', seed)
		}

		const ws = new ReconnectingWebSocket(wsUrl.toString())

		socket = ws

		ws.addEventListener('open', () => {
			isConnected = true
			ws.send(
				JSON.stringify({
					type: 'JOIN_GAME',
					playerId: player.id,
					playerName: player.name,
				} satisfies ClientMessage),
			)
		})

		ws.addEventListener('message', (event) => {
			const data = JSON.parse(event.data as string)

			if (!isServerMessage(data)) {
				console.error('Invalid server message:', data)
				return
			}

			if (isGameEvent(data)) {
				console.info('Received game event:', data.event)
				minOrMaxActor.send(data.event)
			} else if (isStateSnapshot(data)) {
				if (!isMinOrMaxSnapshot(data.state)) {
					console.error('Invalid snapshot:', data.state)
					return
				}

				data.state.context.rng = Rng.fromJSON(data.state.context.rng)

				minOrMaxActor.stop()
				minOrMaxActor = createActor(minOrMaxMachine, {
					snapshot: data.state,
				})
				minOrMaxActor.start()
				actorSnapshot = minOrMaxActor.getSnapshot()
			} else if (data.type === 'CONNECTED') {
				console.info('Connected as player:', data.playerId)
			} else if (data.type === 'ERROR') {
				toast.error(data.message)
			}
		})

		ws.addEventListener('close', () => {
			isConnected = false
		})

		ws.addEventListener('error', (err) => {
			console.error('WebSocket error:', err)
		})

		return () => {
			ws.close()
			socket = null
		}
	})

	let gamePhase = $derived(
		actorSnapshot ? getPhaseFromState(actorSnapshot.value) : 'lobby',
	)
	let gameState = $derived(actorSnapshot?.context)

	$effect(() => {
		if (!isConnected) {
			const timeout = setTimeout(() => {
				toast.warning('Connection lost! Reconnecting...')
			}, 5_000)

			return () => {
				clearTimeout(timeout)
			}
		}
	})
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

{#if !gameState}
	<Spinner class="size-5" />
{:else if gamePhase === 'lobby'}
	<Lobby
		{gameState}
		{player}
		handleGameStart={() => {
			sendMessage({type: 'START_GAME'})
		}}
	/>
{:else if gamePhase === 'gameOver'}
	<GameOver
		{gameState}
		{player}
		handleRematch={() => {
			sendMessage({type: 'PLAY_AGAIN'})
		}}
	/>
{:else}
	<GameBoard {gameState} {actorSnapshot} {player} {sendMessage} />
{/if}
