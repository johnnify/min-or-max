<script lang="ts">
	import {Rng} from '@repo/rng'
	import {
		createCard,
		createPlayedCard,
		type MinOrMaxContext,
		type Player,
	} from '@repo/state'
	import GameBoard from '$lib/components/Game/GameBoard.svelte'
	import Lead from '$lib/components/typography/Lead.svelte'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'

	const heroId = 'hero-player-id'
	const villainId = 'villain-player-id'

	const players: Player[] = [
		{
			id: heroId,
			name: 'Hero',
			isReady: true,
			hand: [
				createCard('hearts', '7'),
				createCard('spades', 'Q'),
				createCard('diamonds', '3'),
				createCard('clubs', 'A'),
			],
		},
		{
			id: villainId,
			name: 'Villain',
			isReady: true,
			hand: [
				createCard('hearts', '2'),
				createCard('spades', '5'),
				createCard('diamonds', 'K'),
			],
		},
	]

	const tally = 13 + 6 + 9

	const mockGameState: MinOrMaxContext = {
		players,
		minPlayers: 2,
		maxPlayers: 4,
		deck: [],
		rng: new Rng('ui-preview'),
		drawPile: [],
		discardPile: [
			createPlayedCard(createCard('clubs', '9'), 9, villainId),
			createPlayedCard(createCard('hearts', '6'), 6, heroId),
			createPlayedCard(createCard('diamonds', 'K'), 13, null),
		],
		tally,
		maxThreshold: 60,
		wheelAngle: 45,
		currentPlayerIndex: 0,
		hasSpunThisTurn: false,
		chosenCard: null,
		activeEffects: [],
		winner: null,
		losers: [],
		reason: null,
	}

	const mockPlayer = {id: heroId, name: 'Hero'}

	const mockSendMessage = (message: unknown) => {
		console.info('Mock sendMessage:', message)
	}
</script>

<main class="container grid gap-8">
	<PageTitle class="lg:text-6xl">GameBoard</PageTitle>

	<Lead>
		See our glorious Game Board, without needing to play an actual game!
	</Lead>

	<GameBoard
		gameState={mockGameState}
		player={mockPlayer}
		sendMessage={mockSendMessage}
	/>
</main>
