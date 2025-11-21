<script lang="ts">
	import {cn} from '$lib/utils'
	import type {Card} from '@repo/state'
	import type {HTMLAttributes} from 'svelte/elements'

	type ImageModule = {
		default: string
		[key: string]: unknown
	}

	const cardImages: Record<string, ImageModule> = import.meta.glob(
		'./cards/*.png',
		{
			eager: true,
			query: {
				enhanced: true,
			},
		},
	)

	type Props = Pick<HTMLAttributes<HTMLButtonElement>, 'class'> & {
		card: Card
		hidden?: boolean
	}
	let {card, hidden = false, class: className}: Props = $props()

	const src = $derived.by(() => {
		if (hidden) {
			return cardImages['./cards/card-back.png']?.default ?? ''
		}

		const imagePath = `./cards/${card.id}.png`
		const imageModule = cardImages[imagePath]

		if (imageModule) {
			return imageModule.default
		}

		const fallback = cardImages['./cards/card-empty.png']
		return fallback?.default ?? ''
	})

	const alt = $derived(
		hidden ? 'The back of a card!' : `${card.rank} of ${card.suit}`,
	)

	// TODO: Random slight rotation & transform per card would be neat!
</script>

<enhanced:img {src} {alt} class={cn('aspect-5/7 w-32', className)} />
