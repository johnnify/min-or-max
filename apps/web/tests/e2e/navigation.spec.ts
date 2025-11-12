import {test, expect} from '@playwright/test'

test('navigation smoke test', async ({page}) => {
	await page.goto('/')
	await expect(page.getByTestId('hydrated')).toBeVisible()

	await expect(
		page.getByRole('heading', {
			name: 'Min or Max',
			level: 1,
		}),
	).toBeVisible()
	await expect(page).toHaveTitle(/Min or Max/)

	// Use the header for navigation
	const headerElement = page.getByRole('banner')
	// Navigate to the Play page
	await headerElement.getByRole('link', {name: 'Play'}).click()

	// use the footer for navigation to boring but necessary links
	const footerElement = page.getByRole('contentinfo')
	await footerElement.getByRole('link', {name: 'Terms of Service'}).click()
	await expect(
		page.getByRole('heading', {name: 'Terms of Service', level: 1}),
	).toBeVisible()
	await expect(page).toHaveTitle(/Terms of Service/gi)
	await expect(
		page.getByRole('heading', {name: 'Login', level: 1}),
	).toBeHidden()

	await footerElement.getByRole('link', {name: 'Privacy Policy'}).click()
	await expect(
		page.getByRole('heading', {name: 'Privacy Policy', level: 1}),
	).toBeVisible()
	await expect(page).toHaveTitle(/Privacy Policy/gi)
	await expect(
		page.getByRole('heading', {name: 'Terms of Service', level: 1}),
	).toBeHidden()
})
