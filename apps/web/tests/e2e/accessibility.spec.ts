import {test, expect} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

let routes: string[]

test.beforeAll(async ({request}) => {
	// Dynamically fetch all UI routes
	const response = await request.get('/api/sitemap')
	routes = await response.json()
})

test('accessibility', async ({page}) => {
	// Each page needs about half a second!
	test.setTimeout(routes.length * 2_000)

	for (const route of routes) {
		await test.step(`"${route}" has no accessibility violations`, async () => {
			await page.goto(route)
			await expect(page.getByTestId('hydrated')).toBeVisible()
			await expect(page.getByRole('heading', {level: 1})).toBeVisible()

			const accessibilityScanResults = await new AxeBuilder({page}).analyze()
			expect(accessibilityScanResults.violations).toEqual([])
		})
	}
})
