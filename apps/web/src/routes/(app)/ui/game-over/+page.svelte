<script lang="ts">
	import {Rng} from '@repo/rng'
	import {
		createCard,
		createPlayedCard,
		type MinOrMaxContext,
		type Player,
	} from '@repo/state'
	import GameOver from '$lib/components/Game/GameOver.svelte'
	import Lead from '$lib/components/typography/Lead.svelte'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
	import SectionTitle from '$lib/components/typography/SectionTitle.svelte'

	const heroId = 'hero-player-id'
	const villainId = 'villain-player-id'

	const basePlayers: Player[] = [
		{
			id: heroId,
			name: 'Hero',
			isReady: true,
			hand: [createCard('hearts', '7'), createCard('spades', 'Q')],
			wins: 3,
		},
		{
			id: villainId,
			name: 'Villain',
			isReady: true,
			hand: [createCard('diamonds', 'K')],
			wins: 2,
		},
	]

	const baseDiscardPile = [
		createPlayedCard(createCard('clubs', '9'), 9, villainId),
		createPlayedCard(createCard('hearts', '6'), 6, heroId),
		createPlayedCard(createCard('diamonds', 'K'), 13, null),
	]

	const createMockGameState = (
		overrides: Partial<MinOrMaxContext>,
	): MinOrMaxContext => ({
		players: basePlayers,
		minPlayers: 2,
		maxPlayers: 4,
		deck: [],
		rng: new Rng('ui-preview'),
		drawPile: [],
		discardPile: baseDiscardPile,
		tally: 28,
		maxThreshold: 60,
		wheelAngle: 45,
		currentPlayerIndex: 0,
		hasSpunThisTurn: false,
		chosenCard: null,
		activeEffects: [],
		winner: null,
		losers: [],
		reason: null,
		...overrides,
	})

	const mockPlayer = {id: heroId, name: 'Hero'}

	const mockHandleRematch = () => {
		console.info('Rematch requested!')
	}

	const heroWonExactState = createMockGameState({
		tally: 60,
		maxThreshold: 60,
		winner: basePlayers[0],
		losers: [basePlayers[1]],
		reason: 'exact_threshold',
	})

	const heroWonBustState = createMockGameState({
		tally: 65,
		maxThreshold: 60,
		winner: basePlayers[0],
		losers: [basePlayers[1]],
		reason: 'exceeded_threshold',
	})

	const heroLostBustState = createMockGameState({
		tally: 72,
		maxThreshold: 60,
		winner: basePlayers[1],
		losers: [basePlayers[0]],
		reason: 'exceeded_threshold',
	})
</script>

<main class="container grid gap-8">
	<PageTitle class="lg:text-6xl">Game Over Screens</PageTitle>

	<Lead>Take a look at our Game Over screen in its various states!</Lead>

	<SectionTitle>We Won TO THE MAX!</SectionTitle>
	<GameOver
		gameState={heroWonExactState}
		player={mockPlayer}
		handleRematch={mockHandleRematch}
	/>

	<SectionTitle>We Lost 😔</SectionTitle>
	<GameOver
		gameState={heroLostBustState}
		player={mockPlayer}
		handleRematch={mockHandleRematch}
	/>

	<SectionTitle>We Won! (Opponent Busted)</SectionTitle>
	<GameOver
		gameState={heroWonBustState}
		player={mockPlayer}
		handleRematch={mockHandleRematch}
	/>
</main>
