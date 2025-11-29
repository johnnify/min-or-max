<script lang="ts">
	import type {Card, Player} from '@repo/state'
	import * as Dialog from '$lib/components/ui/dialog'
	import GameCard from '../GameCard/GameCard.svelte'
	import {cn} from '$lib/utils'
	import {buttonVariants} from '$lib/components/ui/button'

	type Props = {
		villains: Player[]
		onChoice: (targetPlayerId: string, targetCardId: string) => void
	}

	let {villains, onChoice}: Props = $props()
</script>

<Dialog.Description>
	Choose an opponent’s card to <strong class="text-destructive">SLAY</strong>!
</Dialog.Description>
<div class="max-h-96 space-y-4 overflow-y-auto">
	{#each villains as villain (villain.id)}
		<div>
			<p class="mb-2 font-semibold">{villain.name}'s hand:</p>
			<ol class="flex flex-wrap justify-center gap-2">
				{#each villain.hand as targetCard (targetCard.id)}
					<li>
						<button
							class={cn(
								buttonVariants.base,
								'flex w-full flex-col items-center text-lg',
							)}
							onclick={() => onChoice(villain.id, targetCard.id)}
							aria-label="Slay {targetCard.rank} of {targetCard.suit}"
						>
							<GameCard card={targetCard} />
							<span class={buttonVariants({variant: 'outline'})}> Slay! </span>
						</button>
					</li>
				{/each}
			</ol>
		</div>
	{/each}
</div>
