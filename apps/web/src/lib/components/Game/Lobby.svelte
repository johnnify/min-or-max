<script lang="ts">
	import {type MinOrMaxContext} from '@repo/state'
	import {Button} from '$lib/components/ui/button'
	import PlayerList from './PlayerList.svelte'

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
	<PlayerList players={gameState.players} ownPlayerId={player.id} />
</section>

<Button disabled={!areEnoughPlayersReady} onclick={handleGameStart}>
	Start!
</Button>
