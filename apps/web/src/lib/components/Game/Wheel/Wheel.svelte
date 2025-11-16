<script lang="ts">
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

	const deriveModeFromAngle = (angle: number) => {
		const normalizedAngle = angle % 360
		return normalizedAngle < 180 ? 'MIN' : 'MAX'
	}
	let mode = $derived(deriveModeFromAngle(angle))
</script>

<button
	{onclick}
	{disabled}
	class={cn(
		buttonVariants.base,
		'bg-card border-border flex size-32 flex-col rounded-full border',
	)}
>
	{#if mode === 'MIN'}
		<MinIcon />

		<span>Min</span>
	{:else}
		<MaxIcon />

		<span>Max</span>
	{/if}
</button>
