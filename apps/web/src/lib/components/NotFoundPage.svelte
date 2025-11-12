<script lang="ts">
	import {page} from '$app/state'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
	import {Button} from '$lib/components/ui/button'
</script>

<div class="mb-4 grid grid-cols-3 items-center gap-4 lg:mb-8">
	<PageTitle class="col-span-2">Page not found</PageTitle>
	<!-- TODO: Image here? -->
</div>

<section class="flex flex-col gap-4 text-xl">
	<p>
		We couldn’t find <strong>{page.url.pathname}</strong>...
	</p>

	<Button class="self-start" href="/">Back to the homepage</Button>
</section>
