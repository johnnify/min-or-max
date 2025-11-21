<script lang="ts">
	import {
		createCard,
		faceCardRanks,
		type Card,
		type FaceCardRank,
	} from '@repo/state'
	import * as Dialog from '$lib/components/ui/dialog'
	import GameCard from '../GameCard/GameCard.svelte'
	import {cn} from '$lib/utils'
	import {buttonVariants} from '$lib/components/ui/button'

	type Props = {
		card: Card
		onChoice: (rank: FaceCardRank) => void
	}

	let {card, onChoice}: Props = $props()

	let choiceCards = $derived(
		faceCardRanks.map((rank) => ({card: createCard(card.suit, rank), rank})),
	)
</script>

<Dialog.Description>
	Which date would you like to find for your Jack?
</Dialog.Description>
<ol class="grid grid-cols-2 gap-4">
	{#each choiceCards as { card: choiceCard, rank }}
		<li>
			<button
				class={cn(
					buttonVariants.base,
					'flex w-full flex-col items-center text-lg',
				)}
				onclick={() => onChoice(rank)}
			>
				<GameCard card={choiceCard} />
				<span>Pick <strong class="text-primary">{rank}</strong>!</span>
				<span class={buttonVariants({variant: 'outline'})}>Find..?</span>
			</button>
		</li>
	{/each}
</ol>
