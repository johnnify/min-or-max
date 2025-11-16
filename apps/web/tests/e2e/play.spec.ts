import {test, expect} from '@playwright/test'

test('can enter a code to join a playroom', async ({page}) => {
	const roomId = `A23JQK`

	await page.goto('/play')
	await expect(page.getByTestId('hydrated')).toBeVisible()

	await expect(
		page.getByRole('heading', {name: 'Play', level: 1}),
	).toBeVisible()

	const codeInput = page.getByLabel('code')
	await codeInput.fill(roomId)

	await page.getByRole('button', {name: 'Join'}).click()

	await expect(page).toHaveURL(`/play/${roomId}`)
})
