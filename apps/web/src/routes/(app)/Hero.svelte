<script lang="ts">
	import PlayIcon from '~icons/mdi/cards-playing'
	import {Button} from '$lib/components/ui/button'
</script>

<div class="relative isolate px-6 pt-14 lg:px-8">
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
	>
		<div
			style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
			class="from-primary to-secondary relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75"
		></div>
	</div>
	<div class="mx-auto grid place-items-center gap-8 py-32 sm:py-48 lg:py-56">
		<h1 class="text-4xl tracking-tighter sm:text-6xl">Min or Max</h1>
		<enhanced:img
			src="$lib/images/logo@128.png"
			alt="The 'Min' arrow pointing downwards, the 'Max' arrow pointing upwards"
		/>
		<div class="text-muted-foreground text-lg font-medium sm:text-xl/8">
			<p>
				A <strong>multiplayer card game</strong> where you lay low or play it to the
				max!
			</p>
		</div>
		<div class="grid gap-4">
			<Button href="/play" size="lg">
				<PlayIcon />
				Play now!
			</Button>
		</div>
	</div>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
	>
		<div
			style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
			class="from-primary to-secondary relative left-[calc(50%+3rem)] aspect-1155/678 w-144.5 -translate-x-1/2 bg-linear-to-tr opacity-30 sm:left-[calc(50%+36rem)] sm:w-288.75"
		></div>
	</div>
</div>

<style>
	h1 {
		font-variation-settings: 'SCAN' -25;
	}
</style>
