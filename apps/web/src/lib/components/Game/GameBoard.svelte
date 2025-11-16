<script lang="ts">
	import {SvelteMap} from 'svelte/reactivity'
	import {createActor} from 'xstate'
	import {toast} from 'svelte-sonner'
	import {
		getPhaseFromState,
		minOrMaxMachine,
		isServerMessage,
		isStateSnapshot,
		isGameEvent,
		isMinOrMaxSnapshot,
		canCardBeatTopCard,
		type ClientMessage,
		type MinOrMaxSnapshot,
		type Player,
		type Card,
	} from '@repo/state'
	import TickCircleIcon from '~icons/mdi/tick-circle-outline'

	import {browser} from '$app/environment'
	import {PUBLIC_API_URL} from '$env/static/public'
	import Wheel from '$lib/components/Game/Wheel/Wheel.svelte'
	import {Button} from '$lib/components/ui/button'
	import Badge from '$lib/components/ui/badge/badge.svelte'
	import {Spinner} from '$lib/components/ui/spinner'
	import Lobby from './Lobby.svelte'
	import GameCard from './GameCard/GameCard.svelte'
	import DiscardPile from './DiscardPile.svelte'

	type Props = {
		roomId: string
		player: {id: string; name: string}
		seed: string | null
	}
	let {roomId, player, seed}: Props = $props()

	let roomIdsToWs = new SvelteMap<string, WebSocket>()

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
		const ws = roomIdsToWs.get(roomId)
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message))
		}
	}

	$effect(() => {
		if (!browser || roomIdsToWs.has(roomId)) return

		// close and delete any other connections
		roomIdsToWs.forEach((ws, id) => {
			if (id === roomId) return

			ws.close()
			roomIdsToWs.delete(id)
		})

		const wsBaseUrl = PUBLIC_API_URL.replace(/^http/, 'ws')
		const wsUrl = new URL(`/api/room/${roomId}`, wsBaseUrl)

		if (seed) {
			wsUrl.searchParams.set('seed', seed)
		}

		const ws = new WebSocket(wsUrl)
		roomIdsToWs.set(roomId, ws)

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
				console.info('Received game event:', data.event)
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
				actorSnapshot = minOrMaxActor.getSnapshot()
			} else if (data.type === 'CONNECTED') {
				console.log('Connected as player:', data.playerId)
			} else if (data.type === 'ERROR') {
				toast.error(data.message)
			}
		}

		ws.onerror = (err) => {
			toast.error('There was an error with your multiplayer connection!')
			console.error('WebSocket error:', err)
		}

		ws.onclose = () => {
			roomIdsToWs.delete(roomId)
		}
	})

	let isConnected = $derived(roomIdsToWs.has(roomId))

	let gamePhase = $derived(
		actorSnapshot ? getPhaseFromState(actorSnapshot.value) : 'lobby',
	)
	let gameState = $derived(actorSnapshot?.context)

	let topDiscardCard = $derived(
		gameState && gameState.discardPile.length > 0
			? gameState.discardPile[0]
			: null,
	)

	let {hero, villains} = $derived(
		gameState?.players?.reduce<{hero: Player | null; villains: Player[]}>(
			(acc, p) => {
				if (p.id === player.id) {
					acc.hero = p
				} else {
					acc.villains.push(p)
				}
				return acc
			},
			{hero: null, villains: []},
		) || {hero: null, villains: []},
	)

	const canPlayCard = (card: Card): boolean => {
		if (!gameState) return false

		return canCardBeatTopCard(
			card,
			topDiscardCard?.card || null,
			gameState.wheelAngle,
		)
	}
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
			<ol>
				{#each villains as { id, hand }, index (id)}
					<li>
						<ul
							class="flex justify-center gap-2"
							aria-label="Villain {index + 1} hand"
						>
							{#each hand as card (card.id)}
								<li>
									<GameCard {card} hidden />
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ol>

			<div class="flex flex-col items-center">
				<!-- TODO: Only enabled if I can spin -->
				<!-- TODO: Spin on click -->
				<Wheel
					angle={gameState.wheelAngle}
					disabled={false}
					onclick={() => {}}
				/>

				{#if gameState.discardPile.length}
					<DiscardPile pile={gameState.discardPile} />
				{/if}
			</div>

			<div class="text-center">
				<p class="mb-2 text-sm">
					{player.name} (you!)
					<!-- TODO: UI to make it obvious it's our turn -->
				</p>
				<ul class="flex justify-center gap-2" aria-label="Hero hand">
					{#each hero?.hand as card (card.id)}
						<li>
							<button
								onclick={() => {
									sendMessage({type: 'CHOOSE_CARD', cardId: card.id})
									sendMessage({type: 'PLAY_CARD'})
								}}
								disabled={!canPlayCard(card)}
							>
								<GameCard {card} />
							</button>
						</li>
					{/each}
				</ul>
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
