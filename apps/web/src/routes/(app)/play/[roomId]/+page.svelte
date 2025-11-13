<script lang="ts">
	import {page} from '$app/state'
	import GameCard from '$lib/components/Game/GameCard/GameCard.svelte'
	import Wheel from '$lib/components/Game/Wheel/Wheel.svelte'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
</script>

<main class="container grow">
	<PageTitle class="mb-6 lg:mb-12 lg:text-6xl"
		>Playroom {page.params.roomId}</PageTitle
	>

	<GameCard card={{id: 'hearts-5', rank: '5', suit: 'hearts'}} />
	<Wheel angle={90} />
	<GameCard card={{id: 'spades-A', rank: 'A', suit: 'spades'}} />
</main>
