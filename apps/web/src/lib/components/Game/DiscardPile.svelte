<script lang="ts">
	import type {PlayedCard} from '@repo/state'

	import GameCard from './GameCard/GameCard.svelte'

	type Props = {
		pile: PlayedCard[]
	}
	let {pile}: Props = $props()
</script>

<ul aria-label="Discard Pile" class="stack-layout isolate place-content-start">
	{#each pile as { card }, index (card.id)}
		<li style="--index: {index}">
			<GameCard {card} />
		</li>
	{/each}
</ul>

<style>
	ul li {
		z-index: calc(100 - var(--index));
	}
</style>
