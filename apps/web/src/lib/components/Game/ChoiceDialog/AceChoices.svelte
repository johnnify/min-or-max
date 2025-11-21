<script lang="ts">
	import type {Card} from '@repo/state'
	import * as Dialog from '$lib/components/ui/dialog'
	import GameCard from '../GameCard/GameCard.svelte'
	import {cn} from '$lib/utils'
	import {buttonVariants} from '$lib/components/ui/button'

	type Props = {
		card: Card
		onChoice: (addedValue: number) => void
	}

	let {card, onChoice}: Props = $props()
</script>

<Dialog.Description>Choose the value of your Ace:</Dialog.Description>
<ol class="grid grid-cols-2 gap-4">
	<li>
		<button
			class={cn(
				buttonVariants.base,
				'flex w-full flex-col items-center text-lg',
			)}
			onclick={() => onChoice(0)}
			aria-label="Play Small Ace for 1 value"
		>
			<GameCard {card} class="scale-50" />
			<span>Small Ace (counts as <strong class="text-primary">1</strong>)</span>
			<span class={buttonVariants({variant: 'outline'})}>Pick!</span>
		</button>
	</li>
	<li>
		<button
			class={cn(
				buttonVariants.base,
				'flex w-full flex-col items-center text-lg',
			)}
			onclick={() => onChoice(10)}
			aria-label="Play Big Ace for 11 value"
		>
			<GameCard {card} />
			<span>Big Ace (counts as <strong class="text-primary">11</strong>)</span>
			<span class={buttonVariants({variant: 'outline'})}>Pick!</span>
		</button>
	</li>
</ol>
