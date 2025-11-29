<script lang="ts">
	import type {PlayedCard} from '@repo/state'

	import GameCard from './GameCard/GameCard.svelte'

	type Props = {
		pile: PlayedCard[]
	}
	let {pile}: Props = $props()
</script>

<ul
	aria-label="Discard Pile"
	class="stack-layout isolate place-content-center w-full"
	style="--card-count: {pile.length}"
>
	{#each pile as { card }, index (card.id)}
		<li style="--index: {index}">
			<GameCard {card} />
		</li>
	{/each}
</ul>

<style>
	ul {
		padding-left: calc(calc(var(--card-count) - 1) * 8rem * 0.3);
	}

	ul li {
		z-index: calc(100 - var(--index));
		margin-left: calc(var(--index) * -30%);
	}
</style>
