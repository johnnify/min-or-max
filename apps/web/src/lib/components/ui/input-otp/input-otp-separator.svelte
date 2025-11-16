<script lang="ts">
	import type {HTMLAttributes} from 'svelte/elements'
	import DotIcon from '~icons/mdi/dot'
	import type {WithElementRef} from '$lib/utils'

	let {
		ref = $bindable(null),
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props()
</script>

<div
	bind:this={ref}
	data-slot="input-otp-separator"
	role="separator"
	{...restProps}
>
	{#if children}
		{@render children?.()}
	{:else}
		<DotIcon />
	{/if}
</div>
