<script lang="ts">
	import {canBeBodyguardCard, type Card} from '@repo/state'
	import * as Dialog from '$lib/components/ui/dialog'
	import {cn} from '$lib/utils'
	import {buttonVariants} from '$lib/components/ui/button'
	import GameCard from '../GameCard/GameCard.svelte'

	type Props = {
		hand: Card[]
		onChoice: (cardId: string) => void
	}

	let {hand, onChoice}: Props = $props()

	let bodyguardCards = $derived(hand.filter(canBeBodyguardCard))
</script>

<Dialog.Description>
	Choose one of your number cards to send first as your <strong
		class="text-primary">BODYGUARD</strong
	>!
</Dialog.Description>
<div class="max-h-96 overflow-y-auto">
	<ol class="flex flex-wrap justify-center gap-2">
		{#each bodyguardCards as card (card.id)}
			<li>
				<button
					class={cn(
						buttonVariants.base,
						'flex w-full flex-col items-center text-lg',
					)}
					onclick={() => onChoice(card.id)}
					aria-label="Use {card.rank} of {card.suit} as bodyguard"
				>
					<GameCard {card} />
					<span class={buttonVariants({variant: 'outline'})}>Send!</span>
				</button>
			</li>
		{/each}
	</ol>
</div>
