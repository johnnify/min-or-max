import {test, expect} from '@playwright/test'

test('multiplayer game lobby and start', async ({browser}) => {
	const roomId = `test-room-${Date.now()}`

	const context1 = await browser.newContext()
	const page1 = await context1.newPage()
	await page1.goto(`/play/${roomId}`)
	await expect(page1.getByTestId('hydrated')).toBeVisible()

	await expect(page1.getByText(/Waiting for players/i)).toBeVisible()

	await expect(page1.getByText(/Players: 1 \/ 4/)).toBeVisible()

	const context2 = await browser.newContext()
	const page2 = await context2.newPage()
	await page2.goto(`/play/${roomId}`)
	await expect(page2.getByTestId('hydrated')).toBeVisible()

	await expect(page2.getByText(/Waiting for players/i)).toBeVisible()

	await expect(page1.getByText(/Players: 2 \/ 4/)).toBeVisible()
	await expect(page2.getByText(/Players: 2 \/ 4/)).toBeVisible()

	const startButton = page1.getByRole('button', {name: /Start Game/i})
	await expect(startButton).toBeVisible()
	await startButton.click()

	await expect(page1.getByText(/Score:/i)).toBeVisible()
	await expect(page2.getByText(/Score:/i)).toBeVisible()

	await context1.close()
	await context2.close()
})

test('player reconnection in lobby', async ({browser}) => {
	const roomId = `test-reconnect-lobby-${Date.now()}`

	const context1 = await browser.newContext()
	const page1 = await context1.newPage()
	await page1.goto(`/play/${roomId}`)
	await expect(page1.getByTestId('hydrated')).toBeVisible()

	await expect(page1.getByText(/Waiting for players/i)).toBeVisible()
	await expect(page1.getByText(/Players: 1 \/ 4/)).toBeVisible()

	const playerNameMatch = await page1.textContent('body')
	const playerNameRegex = /Player [a-f0-9]{4}/
	const playerName = playerNameMatch?.match(playerNameRegex)?.[0]

	await page1.close()

	const page1Reconnect = await context1.newPage()
	await page1Reconnect.goto(`/play/${roomId}`)
	await expect(page1Reconnect.getByTestId('hydrated')).toBeVisible()

	await expect(page1Reconnect.getByText(/Waiting for players/i)).toBeVisible()
	await expect(page1Reconnect.getByText(/Players: 1 \/ 4/)).toBeVisible()

	if (playerName) {
		await expect(page1Reconnect.getByText(playerName)).toBeVisible()
	}

	await context1.close()
})

test('player reconnection during game', async ({browser}) => {
	const roomId = `test-reconnect-game-${Date.now()}`

	const context1 = await browser.newContext()
	const page1 = await context1.newPage()
	await page1.goto(`/play/${roomId}`)
	await expect(page1.getByTestId('hydrated')).toBeVisible()

	const context2 = await browser.newContext()
	const page2 = await context2.newPage()
	await page2.goto(`/play/${roomId}`)
	await expect(page2.getByTestId('hydrated')).toBeVisible()

	await expect(page1.getByText(/Players: 2 \/ 4/)).toBeVisible()

	const startButton = page1.getByRole('button', {name: /Start Game/i})
	await expect(startButton).toBeVisible()
	await startButton.click()

	await expect(page1.getByText(/Score:/i)).toBeVisible()
	await expect(page2.getByText(/Score:/i)).toBeVisible()

	const player1NameMatch = await page1.textContent('body')
	const player1NameRegex = /Your hand \(Player: (Player [a-f0-9]{4})\)/
	const player1Name = player1NameMatch?.match(player1NameRegex)?.[1]

	await page1.close()

	const page1Reconnect = await context1.newPage()
	await page1Reconnect.goto(`/play/${roomId}`)
	await expect(page1Reconnect.getByTestId('hydrated')).toBeVisible()

	await expect(page1Reconnect.getByText(/Score:/i)).toBeVisible()

	if (player1Name) {
		await expect(
			page1Reconnect.getByText(new RegExp(player1Name, 'i')),
		).toBeVisible()
	}

	const player1Hand = await page1Reconnect.getByText(/Your hand/).textContent()
	expect(player1Hand).toBeTruthy()

	await context1.close()
	await context2.close()
})
