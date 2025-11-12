<script lang="ts">
	import type {Snippet} from 'svelte'
	import type {HTMLAttributes} from 'svelte/elements'

	import {cn} from '$lib/utils'

	type Props = {
		children: Snippet
	} & HTMLAttributes<HTMLParagraphElement>
	let {children, class: className = '', ...restProps}: Props = $props()
</script>

<p class={cn('leading-7 not-first:mt-6', className)} {...restProps}>
	{@render children()}
</p>
