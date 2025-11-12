<script lang="ts">
	import type {Snippet} from 'svelte'
	import type {HTMLBlockquoteAttributes} from 'svelte/elements'

	import {cn} from '$lib/utils'

	type Props = {
		children: Snippet
	} & HTMLBlockquoteAttributes
	let {children, class: className, ...restProps}: Props = $props()
</script>

<blockquote
	class={cn('border-border border-l-2 pl-6 italic', className)}
	{...restProps}
>
	{@render children()}
</blockquote>
