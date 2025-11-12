<script lang="ts">
	import {
		Toaster as Sonner,
		type ToasterProps as SonnerProps,
	} from 'svelte-sonner'

	let restProps: SonnerProps = $props()

	let theme = $state<'light' | 'dark'>()

	$effect(() => {
		theme = document.documentElement.dataset.theme as 'light' | 'dark'

		const themeObserver = new MutationObserver(() => {
			theme = document.documentElement.dataset.theme as 'light' | 'dark'
		})

		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme'],
		})

		return () => {
			themeObserver.disconnect()
		}
	})
</script>

<Sonner
	{theme}
	class="toaster group"
	toastOptions={{
		classes: {
			toast:
				'font-sans group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow',
			description: 'group-[.toast]:text-muted-foreground',
			actionButton:
				'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
			cancelButton:
				'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
		},
	}}
	{...restProps}
/>
