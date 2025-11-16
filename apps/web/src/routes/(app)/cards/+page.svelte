<script lang="ts">
	import DiscardPile from '$lib/components/Game/DiscardPile.svelte'
	import GameCard from '$lib/components/Game/GameCard/GameCard.svelte'
	import Lead from '$lib/components/typography/Lead.svelte'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
	import SectionTitle from '$lib/components/typography/SectionTitle.svelte'
	import {createStandardDeck, type PlayedCard} from '@repo/state'

	const cards = createStandardDeck()

	const playedCards: PlayedCard[] = cards.map((card) => ({
		card,
		playedValue: 0,
		playedBy: 'anon',
	}))
</script>

<main class="container grid grow gap-8">
	<PageTitle class="lg:text-6xl">Cards</PageTitle>

	<Lead>Behold all cards that appear in Min or Max!</Lead>

	<ol
		class="grid grid-cols-2 gap-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-13"
	>
		{#each cards as card (card.id)}
			<li>
				<GameCard {card} />
			</li>
		{/each}
	</ol>

	<SectionTitle>Piles</SectionTitle>
	<ul class="space-y-4">
		<li>
			<h3 class="mb-4 scroll-m-20 text-xl tracking-tight">Draw Pile</h3>
			TODO: Draw Pile
		</li>
		<li>
			<h3 class="mb-4 scroll-m-20 text-xl tracking-tight">Discard Pile</h3>
			<DiscardPile pile={playedCards} />
		</li>
	</ul>
</main>
