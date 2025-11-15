<script lang="ts">
	import {PUBLIC_API_URL} from '$env/static/public'
	import type {
		GamePhase,
		LobbyContext,
		SetupContext,
		PlayingContext,
	} from '@repo/state'
	import type {ClientMessage, ServerMessage} from '$lib/types/game'
	import GameCard from '$lib/components/Game/GameCard/GameCard.svelte'
	import Wheel from '$lib/components/Game/Wheel/Wheel.svelte'
	import {Button} from '$lib/components/ui/button'
	import {browser} from '$app/environment'
	import {toast} from 'svelte-sonner'
	import {SvelteMap} from 'svelte/reactivity'

	type GameSnapshot = {
		value: string | Record<string, unknown>
		context: LobbyContext | SetupContext | PlayingContext
	}

	type GameStateWithPhase = {
		phase: GamePhase
		snapshot: GameSnapshot
	}

	type Props = {roomId: string}
	let {roomId}: Props = $props()

	let roomIdToWs = new SvelteMap<string, WebSocket>()
	let playerId = $state<string | null>(null)
	let isConnected = $state(false)
	let errorMessage = $state<string | null>(null)
	let game = $state<GameStateWithPhase | null>(null)

	const send = (message: ClientMessage) => {
		const ws = roomIdToWs.get(roomId)

		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message))
		} else {
			console.error('WebSocket is not open. Cannot send message:', message)
		}
	}

	const handleServerMessage = (message: ServerMessage) => {
		switch (message.type) {
			case 'CONNECTED':
				playerId = message.playerId
				isConnected = true
				send({type: 'READY'})
				break

			case 'STATE_UPDATE':
				game = {
					phase: message.phase,
					snapshot: message.state as GameSnapshot,
				}
				break

			case 'ERROR':
				errorMessage = message.message
				break

			case 'PLAYER_JOINED':
			case 'PLAYER_LEFT':
			case 'AUTO_SPIN':
			case 'AUTO_PLAY':
			case 'PLAYER_SURRENDERED':
				break
		}
	}

	$effect(() => {
		if (!browser || roomIdToWs.has(roomId)) return

		// Close all other connections
		roomIdToWs.forEach((ws, key) => {
			if (key !== roomId) {
				ws.close()
				roomIdToWs.delete(key)
			}
		})

		const wsUrl = PUBLIC_API_URL.replace(/^http/, 'ws')
		const ws = new WebSocket(`${wsUrl}/api/room/${roomId}`)
		roomIdToWs.set(roomId, ws)

		ws.onopen = () => {
			const storageKey = `playerId-${roomId}`
			let generatedPlayerId = localStorage.getItem(storageKey)

			if (!generatedPlayerId) {
				generatedPlayerId = crypto.randomUUID()
				localStorage.setItem(storageKey, generatedPlayerId)
			}

			const playerName = `Player ${generatedPlayerId.slice(0, 4)}`

			send({
				type: 'JOIN_GAME',
				playerId: generatedPlayerId,
				playerName,
			})
		}

		ws.onmessage = (event) => {
			const message = JSON.parse(event.data) as ServerMessage
			handleServerMessage(message)
		}

		ws.onerror = (err) => {
			isConnected = false
			errorMessage = 'Connection error'
			toast.error('There was an error with your multiplayer connection!')
			console.error('WebSocket error:', err)
		}

		ws.onclose = () => {
			isConnected = false
			roomIdToWs.delete(roomId)
		}
	})

	const connectionStatus = $derived<
		'connecting' | 'connected' | 'disconnected'
	>(isConnected ? 'connected' : game ? 'connecting' : 'disconnected')

	const currentPhase = $derived(game?.phase ?? 'lobby')
	const gameState = $derived(game?.snapshot ?? null)

	const handleStartGame = () => {
		send({type: 'START_GAME'})
	}

	const handleWheelClick = () => {
		if (!isMyTurn) return

		const force = Math.random()
		send({type: 'SPIN_WHEEL', force})
	}

	const handleCardClick = (cardId: string) => {
		if (!currentPlayer || currentPlayer.id !== playerId) return

		const card = currentPlayer.hand.find((c) => c.id === cardId)
		if (!card) return

		send({type: 'CHOOSE_CARD', cardId})

		if (card.effect) {
			if (card.rank === 'A') {
				send({
					type: 'ADD_EFFECT',
					effect: {type: 'value-adder', value: 10, stacksRemaining: 1},
				})
			} else if (card.rank === 'J') {
				send({type: 'SEARCH_AND_DRAW', rank: 'Q'})
			}
		}

		send({type: 'PLAY_CARD'})
	}

	const handleEndTurn = () => {
		if (!isMyTurn) return

		send({type: 'END_TURN'})
	}

	const playingContext = $derived(
		gameState && currentPhase === 'playing'
			? (gameState.context as PlayingContext)
			: null,
	)

	const currentPlayer = $derived(
		playingContext
			? playingContext.players[playingContext.currentPlayerIndex]
			: null,
	)

	const isMyTurn = $derived(currentPlayer?.id === playerId)

	const canEndTurn = $derived(
		playingContext &&
			isMyTurn &&
			typeof gameState?.value === 'object' &&
			'playerTurn' in gameState.value &&
			gameState.value.playerTurn === 'postCardPlay',
	)

	const myPlayer = $derived(
		playingContext
			? (playingContext.players.find((p) => p.id === playerId) ?? null)
			: null,
	)

	const otherPlayers = $derived(
		playingContext
			? playingContext.players.filter((p) => p.id !== playerId)
			: [],
	)

	const topDiscardCard = $derived(
		playingContext && playingContext.discardPile[0]
			? playingContext.discardPile[0]
			: null,
	)
</script>

<div class="space-y-4">
	{#if connectionStatus === 'connecting'}
		<div class="rounded-lg border-2 p-4 text-center">
			<p>Connecting to room {roomId}...</p>
		</div>
	{:else if connectionStatus === 'disconnected'}
		<div class="rounded-lg border-2 p-4 text-center">
			<p>Disconnected from server</p>
			{#if errorMessage}
				<p class="mt-2 text-sm">{errorMessage}</p>
			{/if}
		</div>
	{:else if currentPhase === 'lobby'}
		{@const lobbyContext = gameState?.context as LobbyContext | undefined}
		<div class="rounded-lg border-2 p-4 text-center">
			<p class="mb-4">Waiting for players...</p>
			{#if lobbyContext}
				<p class="mb-4 text-sm">
					Players: {lobbyContext.players.length} / {lobbyContext.maxPlayers}
				</p>
				<div class="mb-4 space-y-1">
					{#each lobbyContext.players as player (player.id)}
						<div class="text-sm">
							{player.name}
							{player.isReady ? '✓' : '...'}
						</div>
					{/each}
				</div>
				{#if lobbyContext.players.length >= lobbyContext.minPlayers && lobbyContext.players.every((p) => p.isReady)}
					<Button onclick={handleStartGame}>Start Game</Button>
				{/if}
			{/if}
		</div>
	{:else if currentPhase === 'setup'}
		<div class="rounded-lg border-2 p-4 text-center">
			<p>Setting up game...</p>
		</div>
	{:else if currentPhase === 'playing' && playingContext}
		<aside class="grid grid-cols-12 gap-4 font-mono text-sm">
			<div class="col-span-3">
				<span>Min:</span>
				{playingContext.minThreshold}
			</div>
			<div class="col-span-6 text-center text-2xl">
				Score: {playingContext.currentScore}
			</div>
			<div class="col-span-3 text-right">
				<span>Max:</span>
				{playingContext.maxThreshold}
			</div>
		</aside>

		<section class="grid gap-8 py-8">
			{#each otherPlayers as player (player.id)}
				<div class="text-center">
					<p class="mb-2 text-sm">
						{player.name}'s hand ({player.hand.length} cards)
						{#if currentPlayer && currentPlayer.id === player.id}
							<span>← Current turn</span>
						{/if}
					</p>
					<div class="flex justify-center gap-2">
						{#each player.hand as card (card.id)}
							<div class="opacity-50">
								<GameCard {card} />
							</div>
						{/each}
					</div>
				</div>
			{/each}

			<div class="flex flex-col items-center">
				<Wheel
					angle={playingContext.wheelAngle}
					onclick={handleWheelClick}
					disabled={!isMyTurn}
				/>
				{#if topDiscardCard}
					<div class="mt-4">
						<p class="mb-2 text-sm">Card to beat:</p>
						<GameCard card={topDiscardCard.card} />
					</div>
				{/if}
			</div>

			{#if myPlayer}
				<div class="text-center">
					<p class="mb-2 text-sm">
						Your hand (Player: {myPlayer.name})
						{#if isMyTurn}
							<span>← Your turn!</span>
						{/if}
					</p>
					<div class="flex justify-center gap-2">
						{#each myPlayer.hand as card (card.id)}
							<button
								onclick={() => handleCardClick(card.id)}
								disabled={!isMyTurn}
							>
								<GameCard {card} />
							</button>
						{/each}
					</div>
					{#if isMyTurn}
						<div class="mt-4">
							<Button onclick={handleEndTurn} disabled={!canEndTurn}>
								End Turn
							</Button>
						</div>
					{/if}
				</div>
			{/if}
		</section>
	{:else if currentPhase === 'gameOver'}
		{@const gameOverContext = gameState?.context as PlayingContext | undefined}
		{#if gameOverContext}
			<div class="rounded-lg border-2 p-8 text-center">
				<h2 class="mb-4 text-3xl font-bold">Game Over!</h2>

				{#if gameOverContext.winner}
					<p class="mb-2 text-xl">Winner: {gameOverContext.winner.name}</p>
				{/if}

				{#if gameOverContext.reason === 'exact_threshold'}
					<p class="mb-4">
						Hit the exact threshold with a score of {gameOverContext.currentScore}!
					</p>
				{:else if gameOverContext.reason === 'exceeded_threshold'}
					<p class="mb-4">
						Score exceeded the max threshold of {gameOverContext.maxThreshold}!
					</p>
				{:else if gameOverContext.reason === 'surrendered'}
					<p class="mb-4">Player surrendered</p>
				{/if}

				<div class="mb-4 rounded border p-4">
					<p class="mb-2 text-sm">Final Score</p>
					<p class="text-2xl font-bold">{gameOverContext.currentScore}</p>
				</div>

				<Button onclick={() => send({type: 'PLAY_AGAIN'})}>Play Again</Button>
			</div>
		{/if}
	{/if}
</div>
