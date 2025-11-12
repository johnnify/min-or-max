<script lang="ts">
	import {setTheme, setMode, theme} from 'mode-watcher'
	import PlayIcon from '~icons/mdi/cards-playing'

	import {Button} from '$lib/components/ui/button'
	import ThemeToggleIcon from './ThemeToggleIcon.svelte'

	const cycleTheme = () => {
		if (theme.current === 'dark') {
			setTheme('light')
			setMode('light')
		} else {
			setTheme('dark')
			setMode('dark')
		}
	}
</script>

<header
	class="bg-background/70 sticky top-0 z-30 mb-[5svh] flex h-(--header-height) items-center gap-2 px-(--padding-inline) py-4 backdrop-blur-lg lg:gap-4"
>
	<div class="-ml-4 flex shrink-0 grow items-center">
		<Button variant="ghost" href="/" class="font-mono text-xl">
			<enhanced:img
				src="$lib/images/logo@128.png"
				alt="The 'Min' arrow pointing downwards, the 'Max' arrow pointing upwards"
				class="size-8"
			/>
			Min or Max
		</Button>
	</div>

	<nav aria-label="Header" class="flex">
		<Button variant="ghost" href="/play">
			<PlayIcon />
			<span class="sr-only sm:not-sr-only">Play</span>
		</Button>
	</nav>
	<Button
		variant="ghost"
		size="icon"
		onclick={cycleTheme}
		aria-label="toggle light/dark theme"
	>
		<ThemeToggleIcon />
	</Button>
</header>

<style>
	header {
		view-transition-name: header;
	}
</style>
