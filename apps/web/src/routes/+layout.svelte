<script lang="ts">
	import type {Snippet} from 'svelte'
	import type {OnNavigate} from '@sveltejs/kit'
	import {ModeWatcher} from 'mode-watcher'
	import '@fontsource-variable/montserrat'
	import '@fontsource-variable/sixtyfour/scan.css'

	import '../app.css'

	import {page} from '$app/state'
	import {onNavigate} from '$app/navigation'
	import Header from '$lib/components/Header.svelte'
	import {Toaster} from '$lib/components/ui/sonner'
	import Footer from '$lib/components/Footer.svelte'

	const defaultMeta = {
		title: 'Min or Max',
		description:
			'Min or Max is a multiplayer card game where you lay low or play it to the max!',
	}
	type Props = {
		children: Snippet
	}
	let {children}: Props = $props()

	// Meta tags
	let title = $derived(
		page.data.meta?.title
			? `${page.data.meta.title} ⏱️ ${defaultMeta.title}`
			: defaultMeta.title,
	)
	let description = $derived(
		page.data.meta?.description
			? page.data.meta.description
			: defaultMeta.description,
	)

	const shouldViewTransition = (navigation: OnNavigate) =>
		document.startViewTransition &&
		navigation.from?.url.href !== navigation.to?.url.href

	onNavigate((navigation) => {
		if (shouldViewTransition(navigation)) {
			if (navigation.delta && navigation.delta < 0) {
				document.documentElement.dataset.back = 'true'
			} else {
				document.documentElement.removeAttribute('data-back')
			}

			return new Promise((resolve) => {
				if (document.startViewTransition) {
					document.startViewTransition(async () => {
						resolve()
						await navigation.complete
					})
				}
			})
		}
	})

	$effect(() => {
		// Add data-testid now that our app is hydrated
		// We have Playwright "wait" for this before starting any test
		document.documentElement.dataset.testid = 'hydrated'
	})
</script>

<svelte:head>
	<title>{title}</title>

	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={defaultMeta.title} />
	<meta property="og:url" content={page.url.href} />
</svelte:head>

<ModeWatcher
	track={false}
	defaultMode="dark"
	defaultTheme="dark"
	disableTransitions={false}
	darkClassNames={[]}
/>

<div class="z-1 flex grow flex-col">
	<Header />

	<div class="z-1 flex grow flex-col">
		{@render children()}
		<Toaster richColors />
	</div>

	<Footer />
</div>
