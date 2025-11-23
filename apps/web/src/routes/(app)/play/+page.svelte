<script lang="ts">
	import Lead from '$lib/components/typography/Lead.svelte'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
	import {FieldSeparator} from '$lib/components/ui/field/index'
	import RoomCodeForm from './RoomCodeForm.svelte'
	import QuickplayForm from './QuickplayForm.svelte'
</script>

<main class="container grid gap-8">
	<PageTitle>Play</PageTitle>

	<Lead>
		Play with new friends across the internet, or use a code to join a specific
		lobby!
	</Lead>

	<section class="grid max-w-prose gap-8">
		<QuickplayForm />

		<FieldSeparator>or</FieldSeparator>

		<RoomCodeForm />
	</section>
</main>
