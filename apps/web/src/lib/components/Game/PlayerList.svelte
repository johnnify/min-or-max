<script lang="ts">
	import type {Player} from '@repo/state'
	import * as Item from '$lib/components/ui/item'
	import * as Avatar from '$lib/components/ui/avatar'
	import {Badge} from '../ui/badge'
	import type {HTMLAttributes} from 'svelte/elements'
	import {cn} from '$lib/utils'

	type Props = {
		players: Omit<Player, 'hand'>[]
		ownPlayerId: string
	} & Pick<HTMLAttributes<HTMLDivElement>, 'class'>

	let {players, ownPlayerId, class: className}: Props = $props()

	const getInitials = (name?: string | null): string => {
		if (!name) return '?'

		const nameParts = name.trim().split(/\s+/)
		if (nameParts.length === 1) {
			return nameParts[0][0]?.toUpperCase() || '?'
		}

		return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
	}

	let shouldShowWins = $derived(players.some((player) => player.wins > 0))

	let orderedPlayers = $derived(
		shouldShowWins ? [...players].sort((a, b) => b.wins - a.wins) : players,
	)
</script>

<div class={cn('flex w-full max-w-prose flex-col gap-6', className)}>
	<Item.Group>
		{#each orderedPlayers as player, index (player.id)}
			<Item.Root>
				<Item.Media>
					<Avatar.Root>
						<Avatar.Fallback>{getInitials(player.name)}</Avatar.Fallback>
					</Avatar.Root>
				</Item.Media>
				<Item.Content class="gap-1">
					<Item.Title>
						{player.name}
						{#if player.id === ownPlayerId}
							<span class="text-muted-foreground">(you!)</span>
						{/if}
					</Item.Title>
					{#if shouldShowWins}
						<Item.Description>
							<strong>{player.wins}</strong> win{player.wins !== 1 ? 's' : ''}
						</Item.Description>
					{/if}
				</Item.Content>
				<Item.Actions><Badge variant="outline">ready</Badge></Item.Actions>
			</Item.Root>
			{#if index !== players.length - 1}
				<Item.Separator />
			{/if}
		{/each}
	</Item.Group>
</div>
