<script lang="ts">
	import type {Snippet} from 'svelte'
	import type {HTMLAttributes} from 'svelte/elements'

	import {cn} from '$lib/utils'

	type Props = {
		children: Snippet
	} & HTMLAttributes<HTMLHeadingElement>
	let {children, class: className, ...restProps}: Props = $props()
</script>

<h2
	class={cn(
		'border-border scroll-m-20 border-b pb-2 text-3xl tracking-tight first:mt-0',
		className,
	)}
	{...restProps}
>
	{@render children()}
</h2>
