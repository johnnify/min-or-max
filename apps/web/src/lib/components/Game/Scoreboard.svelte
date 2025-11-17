<script lang="ts">
	import {useId} from 'bits-ui'
	import ThresholdMeter from './ThresholdMeter.svelte'

	type Props = {
		tally: number
		maxThreshold: number
	}

	let {tally, maxThreshold}: Props = $props()

	const labelId = useId()
</script>

<aside
	class="bg-card border-border grid gap-4 place-self-center rounded-md border p-8 font-mono text-2xl"
	style="grid-template-columns: auto 2ch 1fr;"
	aria-labelledby={labelId}
>
	<h2 class="col-span-2 grid grid-cols-subgrid" id={labelId}>
		<span class="text-right">Tally:</span>
		<span>{tally}</span>
	</h2>

	<div class="row-span-2 px-2"><ThresholdMeter {tally} {maxThreshold} /></div>

	<h3 class="border-border text-primary col-span-2 grid grid-cols-subgrid">
		<span class="text-right">Max:</span>
		<span>{maxThreshold}</span>
	</h3>
</aside>
