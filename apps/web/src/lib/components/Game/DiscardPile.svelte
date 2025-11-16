<script lang="ts">
	import {type PlayedCard} from '@repo/state'

	import GameCard from './GameCard/GameCard.svelte'

	type Props = {
		pile: PlayedCard[]
	}
	let {pile}: Props = $props()
</script>

<ul aria-label="Discard Pile" class="stack-layout">
	{#each pile as { card }, index (card.id)}
		<li>
			<GameCard {card} --index={index} />
		</li>
	{/each}
</ul>
