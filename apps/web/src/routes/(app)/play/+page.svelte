<script lang="ts">
	import Lead from '$lib/components/typography/Lead.svelte'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
	import Paragraph from '$lib/components/typography/Paragraph.svelte'
	import RoomCodeForm from './RoomCodeForm.svelte'
</script>

<main class="container grid gap-8">
	<PageTitle>Play</PageTitle>

	<Lead>
		Play with new friends across the internet, or use a code to join a specific
		lobby!
	</Lead>

	<RoomCodeForm />
</main>
