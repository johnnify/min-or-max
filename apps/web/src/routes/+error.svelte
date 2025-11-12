<script lang="ts">
	import {page} from '$app/state'
	import GenericErrorPage from '$lib/components/GenericErrorPage.svelte'
	import NotFoundPage from '$lib/components/NotFoundPage.svelte'
</script>

<main class="container">
	{#if page.status === 404}
		<NotFoundPage />
	{:else}
		<GenericErrorPage />
	{/if}
</main>
