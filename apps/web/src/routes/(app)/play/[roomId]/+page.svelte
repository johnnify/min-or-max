<script lang="ts">
	import {page} from '$app/state'
	import GameBoard from '$lib/components/Game/GameBoard.svelte'

	let {data} = $props()
</script>

<main class="container">
	{#if page.params.roomId}
		<GameBoard
			roomId={page.params.roomId}
			player={data.player}
			seed={data.seed}
		/>
	{/if}
</main>
