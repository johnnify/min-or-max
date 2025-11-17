<script lang="ts">
	import {Meter, useId} from 'bits-ui'

	type Props = {
		tally: number
		maxThreshold: number
	}

	const labelId = useId()

	const min = 0

	let {tally, maxThreshold}: Props = $props()

	const usedPercentage = $derived((tally / maxThreshold) * 100)
	const percentageRemaining = $derived(100 - usedPercentage)

	const color = $derived.by(() => {
		if (percentageRemaining <= 0) return 'bg-rose-800 dark:bg-rose-700'
		if (percentageRemaining < 15) return 'bg-primary dark:bg-primary'
		if (percentageRemaining < 35) return 'bg-orange-500 dark:bg-orange-400'
		if (percentageRemaining < 50) return 'bg-yellow-500 dark:bg-yellow-400'
		return 'bg-green-500 dark:bg-green-400'
	})
</script>

<Meter.Root
	aria-labelledby={labelId}
	aria-valuetext="{tally} out of {maxThreshold}"
	value={tally}
	{min}
	max={maxThreshold}
	class="bg-primary/5 border-border relative h-full w-6 overflow-hidden rounded-full border"
>
	<div
		class="absolute top-0 w-full rounded-full transition-all duration-1000 ease-in-out {color}"
		style="height: {usedPercentage}%"
	>
		<span class="sr-only" id={labelId}
			>Colourful meter showing we are at {usedPercentage}% of the tally</span
		>
	</div>
</Meter.Root>
