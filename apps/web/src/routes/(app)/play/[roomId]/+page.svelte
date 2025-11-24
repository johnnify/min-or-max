<script lang="ts">
	import {page} from '$app/state'
	import PlayRoom from '$lib/components/Game/PlayRoom.svelte'
	import Rules from '$lib/components/Game/Rules.svelte'

	let {data} = $props()
</script>

<main class="container">
	{#if page.params.roomId}
		<PlayRoom
			roomId={page.params.roomId}
			player={data.player}
			seed={data.seed}
		/>
	{/if}

	<div class="mt-32">
		<Rules />
	</div>
</main>
