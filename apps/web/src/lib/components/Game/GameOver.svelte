<script lang="ts">
	import {Confetti} from 'svelte-confetti'
	import type {MinOrMaxContext} from '@repo/state'
	import {Button} from '$lib/components/ui/button'
	import PlayerList from './PlayerList.svelte'

	type Props = {
		gameState: MinOrMaxContext
		player: {id: string}
		handleRematch: () => void
	}

	let {gameState, player, handleRematch}: Props = $props()

	let didWin = $derived(gameState.winner?.id === player.id)
	let reason = $derived(gameState.reason)
	let winnerName = $derived(gameState.winner?.name ?? 'Someone')
</script>

{#if didWin}
	<span
		class="pointer-events-none fixed -top-[50px] left-0 -z-10 flex h-screen w-screen justify-center overflow-hidden"
	>
		<Confetti
			x={[-5, 5]}
			y={[0, 0.1]}
			delay={[100, 2_000]}
			infinite
			duration={20_000}
			amount={1000}
			fallDistance="125vh"
		/>
	</span>
{/if}

<section
	class="bg-card/70 text-card-foreground border-border mb-8 grid flex-col place-items-center gap-8 rounded-xl border p-8 shadow-sm backdrop-blur-lg"
>
	{#if didWin}
		<h2 class="text-center text-4xl">A Winner is YOU!</h2>

		{#if reason === 'exact_threshold'}
			<p class="text-xl">
				You hit exactly <strong>{gameState.maxThreshold}</strong>!
			</p>
			<p class="text-primary font-mono text-3xl uppercase">To the max!</p>
		{:else if reason === 'exceeded_threshold'}
			<p class="text-xl">Your opponent <strong>busted</strong>!</p>
			<p class="text-muted-foreground">
				They went over <strong>{gameState.maxThreshold}</strong>
			</p>
		{:else if reason === 'surrendered'}
			<p class="text-xl">Your opponent <strong>surrendered</strong>!</p>
			<p class="text-muted-foreground">They gave up!</p>
		{/if}
	{:else}
		<h2 class="text-center text-4xl">Game Over</h2>
		<p class="text-xl">You lost!</p>

		{#if reason === 'exact_threshold'}
			<p class="text-muted-foreground">
				<strong>{winnerName}</strong> hit exactly
				<strong>{gameState.maxThreshold}</strong>
			</p>
			<p class="text-2xl">
				{winnerName} wins <strong class="uppercase">to the max</strong>!
			</p>
		{:else if reason === 'exceeded_threshold'}
			<p>
				You busted! You went over <strong>{gameState.maxThreshold}</strong>.
			</p>
			<p class="text-muted-foreground"><strong>{winnerName}</strong> wins!</p>
		{:else if reason === 'surrendered'}
			<p>You surrendered!</p>
			<p class="text-muted-foreground"><strong>{winnerName}</strong> wins!</p>
		{/if}
	{/if}
</section>

<PlayerList
	class="mx-auto"
	players={gameState.players}
	ownPlayerId={player.id}
/>

<Button onclick={handleRematch}>Rematch!</Button>
