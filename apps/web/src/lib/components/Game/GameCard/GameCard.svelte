<script lang="ts">
	import type {Card} from '@repo/state'

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

	type Props = {
		card: Card
		hidden?: boolean
	}
	let {card, hidden = false}: Props = $props()

	const src = $derived.by(() => {
		const imagePath = `./cards/${card.id}.png`
		const imageModule = cardImages[imagePath]

		if (imageModule) {
			return imageModule.default
		}

		const fallback = cardImages['./cards/card-empty.png']
		return fallback?.default ?? ''
	})

	const alt = $derived(`${card.rank} of ${card.suit}`)
</script>

{#if hidden}
	<enhanced:img src="./cards/card-back.png" alt="The back of a card!" />
{:else}
	<enhanced:img {src} {alt} />
{/if}
