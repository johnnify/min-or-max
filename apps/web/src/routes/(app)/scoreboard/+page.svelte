<script lang="ts">
	import {onMount} from 'svelte'
	import {Rng} from '@repo/rng'
	import Scoreboard from '$lib/components/Game/Scoreboard.svelte'
	import Lead from '$lib/components/typography/Lead.svelte'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
	import SectionTitle from '$lib/components/typography/SectionTitle.svelte'

	const rng = new Rng(Date.now().toString())

	let animatedTally = $state(0)
	const animatedMaxThreshold = 60
	onMount(() => {
		const tallyInterval = setInterval(() => {
			if (animatedTally >= animatedMaxThreshold) {
				animatedTally = 0
				return
			}
			animatedTally = rng.nextInt(animatedTally, animatedTally + 11)
		}, 2_000) as unknown as number

		return () => clearInterval(tallyInterval)
	})
</script>

<main class="container grid gap-8">
	<PageTitle class="lg:text-6xl">Scoreboard</PageTitle>

	<Lead
		>See our famous Scoreboard in its various stages as it tracks of how close
		you are to getting TO THE MAX!</Lead
	>

	<SectionTitle>Animated</SectionTitle>

	<Scoreboard tally={animatedTally} maxThreshold={animatedMaxThreshold} />

	<SectionTitle>Standard</SectionTitle>

	<Scoreboard tally={12} maxThreshold={45} />

	<SectionTitle>Busted!</SectionTitle>

	<!-- TODO: Explosion effect -->
	<Scoreboard tally={52} maxThreshold={49} />
</main>
