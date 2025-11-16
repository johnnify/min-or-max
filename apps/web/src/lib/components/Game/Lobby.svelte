<script lang="ts">
	import {type MinOrMaxContext} from '@repo/state'
	import {Button} from '$lib/components/ui/button'

	type Props = {
		gameState: MinOrMaxContext
		// TODO: Common UIPlayer type
		player: {id: string; name: string}
		handleGameStart: () => void
	}

	let {gameState, player, handleGameStart}: Props = $props()

	let areEnoughPlayersReady = $derived(
		gameState.players.filter((p) => p.isReady).length >= 2,
	)
</script>

<section aria-labelledby="connected-players-heading">
	<h2 id="connected-players-heading">Connected players</h2>
	<ul>
		{#each gameState.players as gamePlayer (gamePlayer.id)}
			<!-- TODO: Nicer Player Item! -->
			<li>
				{gamePlayer.name}
				{#if gamePlayer.id === player.id}(you!){/if}
			</li>
		{/each}
	</ul>
</section>
<Button disabled={!areEnoughPlayersReady} onclick={handleGameStart}>
	Start!
</Button>
