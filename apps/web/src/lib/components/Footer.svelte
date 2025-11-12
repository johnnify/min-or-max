<script lang="ts">
	import Discord from '~icons/ic/baseline-discord'
	import YouTube from '~icons/mdi/youtube'
	import GitHub from '~icons/mdi/github'

	import PulsingHeart from './PulsingHeart.svelte'
	import OutboundLink from './OutboundLink.svelte'
	import Button from './ui/button/button.svelte'
</script>

<footer class="px-inline mt-[5svh] flex flex-col items-center pb-6 text-sm">
	<section class="flex gap-2">
		<div class="flex shrink-0 items-center justify-center gap-2">
			Made with
			<PulsingHeart />
			by <OutboundLink size="inline" href="https://magrippis.com"
				>jmagrippis</OutboundLink
			>
		</div>

		<div class="flex items-center gap-2">
			<OutboundLink size="inline" href="https://www.youtube.com/@johnnifytech">
				<span class="sr-only">Johnny’s YouTube channel</span>
				<YouTube />
			</OutboundLink>
			<OutboundLink size="inline" href="https://github.com/johnnify/min-or-max">
				<span class="sr-only">checkout the source code at the github repo</span>
				<GitHub />
			</OutboundLink>
			<OutboundLink size="inline" href="https://discord.gg/sUpvwSdgjh">
				<span class="sr-only">Join Johnny's Discord community!</span>
				<Discord />
			</OutboundLink>
		</div>
	</section>
	<section>
		Read our <Button size="inline" variant="link" href="/terms"
			>Terms of Service</Button
		>
		& our
		<Button size="inline" variant="link" href="/privacy-policy"
			>Privacy Policy</Button
		>
	</section>
</footer>

<style>
	footer {
		view-transition-name: footer;
	}
</style>
