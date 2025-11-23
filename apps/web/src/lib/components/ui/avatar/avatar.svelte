<script lang="ts">
	import {onMount} from 'svelte'
	import {Avatar as AvatarPrimitive} from 'bits-ui'
	import {cn} from '$lib/utils'

	let {
		ref = $bindable(null),
		loadingStatus = $bindable('loading'),
		class: className,
		...restProps
	}: AvatarPrimitive.RootProps = $props()

	let isMounted = $state(false)
	onMount(() => {
		isMounted = true
	})
</script>

<!-- HACK: loading state interferes with pre-fetching navigation!
so we wait for the component to mount before
actually attempting to render the avatar -->
{#if isMounted}
	<AvatarPrimitive.Root
		bind:ref
		bind:loadingStatus
		data-slot="avatar"
		class={cn(
			'relative flex size-8 shrink-0 overflow-hidden rounded-full',
			className,
		)}
		{...restProps}
	/>
{/if}
