<script lang="ts">
	import QuickplayIcon from '~icons/mdi/world'
	import {Button} from '$lib/components/ui/button'
	import Spinner from '$lib/components/ui/spinner/spinner.svelte'
	import {quickplay} from './join.remote'
</script>

<form {...quickplay}>
	<Button class="w-full" size="lg">
		{#if quickplay.pending}
			<Spinner />
		{:else}
			<QuickplayIcon />
		{/if}
		Quickplay
	</Button>
</form>
