<script lang="ts">
	import type {Snippet} from 'svelte'
	import type {HTMLAttributes} from 'svelte/elements'

	import {cn} from '$lib/utils'

	type Props = {
		children: Snippet
	} & HTMLAttributes<HTMLHeadingElement>
	let {children, class: className, ...restProps}: Props = $props()
</script>

<h1
	class={cn(
		'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
		className,
	)}
	{...restProps}
>
	{@render children()}
</h1>

<style>
	h1 {
		font-variation-settings: 'SCAN' -30;
	}
</style>
