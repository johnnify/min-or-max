<script lang="ts">
	import type {Snippet} from 'svelte'
	import type {HTMLAttributes} from 'svelte/elements'

	import {cn} from '$lib/utils'

	type Props = {
		children: Snippet
	} & HTMLAttributes<HTMLHeadingElement>
	let {children, class: className, ...restProps}: Props = $props()
</script>

<h3 class={cn('scroll-m-20 text-2xl tracking-tight', className)} {...restProps}>
	{@render children()}
</h3>
