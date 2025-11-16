<script lang="ts">
	import {getModeFromWheelAngle} from '@repo/state'
	import Button from '$lib/components/ui/button/button.svelte'

	type Props = {
		angle: number
		onclick?: () => void
		disabled?: boolean
	}

	let {angle, onclick, disabled}: Props = $props()

	let mode = $derived(getModeFromWheelAngle(angle))
</script>

<div class="mb-4 flex flex-col items-center gap-4">
	<h3 class="uppercase">Mode {mode}</h3>

	<!-- TODO: Cool spin thingy -->
	<Button
		{onclick}
		{disabled}
		variant="outline"
		class="py-8 font-mono text-2xl uppercase">Spin!</Button
	>
</div>
