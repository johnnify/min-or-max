<script lang="ts">
	import MinIcon from '~icons/mdi/less-than'
	import MaxIcon from '~icons/mdi/greater-than'

	import {
		type MinOrMaxContext,
		type MinOrMaxSnapshot,
		type Card,
		type ClientMessage,
		type Player,
		canCardBeatTopCard,
		getModeFromWheelAngle,
	} from '@repo/state'
	import Badge from '$lib/components/ui/badge/badge.svelte'
	import {Button} from '$lib/components/ui/button'
	import Wheel from '$lib/components/Game/Wheel/Wheel.svelte'
	import GameCard from '$lib/components/Game/GameCard/GameCard.svelte'
	import DiscardPile from './DiscardPile.svelte'
	import Scoreboard from './Scoreboard.svelte'
	import ChoiceDialog from './ChoiceDialog/ChoiceDialog.svelte'
	import AceChoices from './ChoiceDialog/AceChoices.svelte'
	import JackChoices from './ChoiceDialog/JackChoices.svelte'

	type Props = {
		gameState: MinOrMaxContext
		actorSnapshot?: MinOrMaxSnapshot
		player: {id: string; name: string}
		sendMessage: (message: ClientMessage) => void
	}

	let {gameState, actorSnapshot, player, sendMessage}: Props = $props()

	let topDiscardCard = $derived(
		gameState.discardPile.length > 0 ? gameState.discardPile[0] : null,
	)

	let {hero, villains} = $derived(
		gameState.players.reduce<{hero: Player | null; villains: Player[]}>(
			(acc, p) => {
				if (p.id === player.id) {
					acc.hero = p
				} else {
					acc.villains.push(p)
				}
				return acc
			},
			{hero: null, villains: []},
		),
	)

	const canPlayCard = (card: Card): boolean => {
		return canCardBeatTopCard(
			card,
			topDiscardCard?.card || null,
			gameState.wheelAngle,
		)
	}

	let isCurrentPlayer = $derived(
		gameState.currentPlayerIndex !== undefined &&
			gameState.players[gameState.currentPlayerIndex]?.id === player.id,
	)

	let canSpinWheel = $derived(
		isCurrentPlayer && gameState.hasSpunThisTurn === false,
	)

	let canEndTurn = $derived.by(() => {
		if (!isCurrentPlayer || !actorSnapshot) return false

		const stateValue = actorSnapshot.value
		if (typeof stateValue === 'object' && 'playing' in stateValue) {
			const playingState = stateValue.playing
			if (
				typeof playingState === 'object' &&
				'playerTurn' in playingState &&
				playingState.playerTurn !== 'processingCard' &&
				playingState.playerTurn !== 'configuringEffect'
			) {
				return true
			}
		}
		return false
	})

	let isConfiguringEffect = $derived.by(() => {
		if (!actorSnapshot) return false

		const stateValue = actorSnapshot.value
		if (typeof stateValue === 'object' && 'playing' in stateValue) {
			const playingState = stateValue.playing
			if (
				typeof playingState === 'object' &&
				'playerTurn' in playingState &&
				playingState.playerTurn === 'configuringEffect'
			) {
				return true
			}
		}
		return false
	})

	let chosenCard = $derived(gameState.chosenCard ?? null)

	let mode = $derived(
		gameState.wheelAngle ? getModeFromWheelAngle(gameState.wheelAngle) : 'min',
	)
</script>

<ChoiceDialog
	open={isConfiguringEffect && isCurrentPlayer && chosenCard !== null}
>
	{#if chosenCard?.rank === 'J'}
		<JackChoices
			card={chosenCard}
			onChoice={(rank) => {
				sendMessage({type: 'SEARCH_AND_DRAW', rank})
				sendMessage({type: 'PLAY_CARD'})
			}}
		/>
	{:else if chosenCard?.rank === 'A'}
		<AceChoices
			card={chosenCard}
			onChoice={(addedValue) => {
				sendMessage({
					type: 'ADD_EFFECT',
					effect: {
						type: 'value-adder',
						value: addedValue,
						stacksRemaining: 1,
					},
				})
				sendMessage({type: 'PLAY_CARD'})
			}}
		/>
	{/if}
</ChoiceDialog>

<div class="space-y-4">
	<Scoreboard
		tally={gameState.tally}
		maxThreshold={gameState.maxThreshold}
		class="sticky top-(--header-height) z-200"
	/>

	<section class="grid gap-8 py-8">
		<ol>
			{#each villains as { id, hand }, index (id)}
				<li>
					<ul
						class="flex justify-center gap-2"
						aria-label="Villain {index + 1} hand"
					>
						{#each hand as card (card.id)}
							<li>
								<GameCard {card} hidden />
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ol>

		<div class="flex flex-col items-center">
			<Wheel
				angle={gameState.wheelAngle}
				disabled={!canSpinWheel}
				onclick={() => {
					sendMessage({type: 'REQUEST_WHEEL_SPIN', force: 0.55})
				}}
			/>

			{#if topDiscardCard}
				<div class="flex items-center gap-4">
					<DiscardPile pile={gameState.discardPile} />
					<div class="flex flex-col items-center gap-4">
						{#if mode === 'min'}
							<MaxIcon class="size-32" />
							{#if topDiscardCard.card.rank === 'A'}
								<span
									>play <strong>any card</strong> (ace counts as highest OR lowest)</span
								>
							{:else}
								<span
									>play <strong>{topDiscardCard.card.rank}</strong> or lower!</span
								>
							{/if}
						{:else}
							<MinIcon class="size-32" />
							{#if topDiscardCard.card.rank === 'A'}
								<span
									>play <strong>any card</strong> (ace counts as highest OR lowest)</span
								>
							{:else}
								<span
									>play <strong>{topDiscardCard.card.rank}</strong> or higher!</span
								>
							{/if}
						{/if}
					</div>
					<div
						class="border-border aspect-5/7 w-32 border-2 border-dotted"
					></div>
				</div>
			{/if}
		</div>

		<div class="text-center">
			<p class="mb-2 flex flex-col items-center gap-1 text-sm">
				{player.name} (you!)
				{#if isCurrentPlayer}
					<Badge>you're up!</Badge>
				{:else}
					<Badge variant="secondary">waiting...</Badge>
				{/if}
			</p>
			<ul class="flex justify-center gap-2" aria-label="Hero hand">
				{#each hero?.hand as card (card.id)}
					<li>
						<button
							onclick={() => {
								sendMessage({type: 'CHOOSE_CARD', cardId: card.id})
							}}
							disabled={!canPlayCard(card)}
						>
							<GameCard {card} class={{'opacity-70': !canPlayCard(card)}} />
						</button>
					</li>
				{/each}
			</ul>
			<Button
				onclick={() => {
					sendMessage({type: 'END_TURN'})
				}}
				disabled={!canEndTurn}
			>
				End Turn
			</Button>
		</div>
	</section>
</div>
