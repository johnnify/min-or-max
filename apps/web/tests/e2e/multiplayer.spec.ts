import {test, expect} from '@playwright/test'

test('multiplayer game lobby and start', async ({browser}) => {
	const roomId = `test-room-${Date.now()}`

	const context1 = await browser.newContext()
	const page1 = await context1.newPage()
	await page1.goto(`/play/${roomId}`)
	await expect(page1.getByTestId('hydrated')).toBeVisible()

	await expect(
		page1.getByRole('heading', {name: roomId, level: 1}),
	).toBeVisible()

	const context2 = await browser.newContext()
	const page2 = await context2.newPage()
	await page2.goto(`/play/${roomId}`)
	await expect(page2.getByTestId('hydrated')).toBeVisible()

	const startButton = page1.getByRole('button', {name: 'start'})
	await startButton.click()

	await expect(page1.getByText('Tally')).toBeVisible()

	await context1.close()
	await context2.close()
})
