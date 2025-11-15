<script lang="ts">
	import {page} from '$app/state'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
	import GameBoard from '$lib/components/Game/GameBoard.svelte'
</script>

<main class="container grow">
	{#if page.params.roomId}
		<PageTitle class="mb-6 lg:mb-12 lg:text-6xl">
			Playroom {page.params.roomId}
		</PageTitle>

		<GameBoard roomId={page.params.roomId} />
	{/if}
</main>
