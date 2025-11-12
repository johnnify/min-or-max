<script lang="ts">
	import {page} from '$app/state'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
	import {Button} from '$lib/components/ui/button'
</script>

<div class="mb-4 grid grid-cols-3 items-center gap-4 lg:mb-8">
	<PageTitle class="col-span-2">Something went wrong!</PageTitle>
	<!-- TODO: Image here? -->
</div>

<section class="flex flex-col gap-4 text-xl">
	<p>Whoops! Apologies for the error.</p>
	<p>We are looking into it...</p>
	{#if page.error?.message}
		<p class="italics">{page.error?.message}</p>
	{/if}
	<Button
		class="self-start"
		onclick={() => {
			location.reload()
		}}
	>
		Try refreshing?
	</Button>
</section>
