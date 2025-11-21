<script lang="ts">
	import {createCard, type Card, type CardRank} from '@repo/state'
	import * as Dialog from '$lib/components/ui/dialog'
	import GameCard from '../GameCard/GameCard.svelte'
	import {cn} from '$lib/utils'
	import {buttonVariants} from '$lib/components/ui/button'

	type Props = {
		card: Card
	}

	let {card}: Props = $props()

	const choiceRanks: CardRank[] = ['J', 'Q', 'K']
	let choiceCards = $derived(
		choiceRanks.map((rank) => createCard(card.suit, rank)),
	)
</script>

<Dialog.Description>
	Which date would you like to find for your Jack?
</Dialog.Description>
<ol class="grid grid-cols-2 gap-4">
	{#each choiceCards as card}
		<li>
			<button
				class={cn(
					buttonVariants.base,
					'flex w-full flex-col items-center text-lg',
				)}
			>
				<GameCard {card} class="scale-50" />
				<span>Pick <strong class="text-primary">{card.rank}</strong>!</span>
				<span class={buttonVariants({variant: 'outline'})}>Find..?</span>
			</button>
		</li>
	{/each}
</ol>
