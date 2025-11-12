export const getAllUiRoutes = () => {
	const uiPages = import.meta.glob('/src/routes/**/+page.svelte', {eager: true})
	const routes: string[] = []

	for (const path of Object.keys(uiPages)) {
		let route = path.replace('/src/routes', '').replace('/+page.svelte', '')

		// Skip dynamic routes (containing [...] or [slug])
		if (route.includes('[')) continue

		// Remove route groups (app), (auth), etc.
		route = route.replace(/\/\([^)]+\)/g, '')

		// Convert empty string to root path
		if (route === '') route = '/'

		routes.push(route)
	}

	return routes.sort()
}
