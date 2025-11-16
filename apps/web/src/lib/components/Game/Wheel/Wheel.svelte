<script lang="ts">
	import {getModeFromWheelAngle} from '@repo/state'
	import MinIcon from '~icons/mdi/less-than'
	import MaxIcon from '~icons/mdi/greater-than'
	import {cn} from '$lib/utils'
	import {buttonVariants} from '$lib/components/ui/button'

	type Props = {
		angle: number
		onclick?: () => void
		disabled?: boolean
	}

	let {angle, onclick, disabled}: Props = $props()

	let mode = $derived(getModeFromWheelAngle(angle))
</script>

<button
	{onclick}
	{disabled}
	class={cn(
		buttonVariants.base,
		'bg-card border-border flex size-32 flex-col rounded-full border',
	)}
	aria-label="spin the wheel"
>
	{#if mode === 'min'}
		<MinIcon />

		<span>Min</span>
	{:else}
		<MaxIcon />

		<span>Max</span>
	{/if}
</button>
