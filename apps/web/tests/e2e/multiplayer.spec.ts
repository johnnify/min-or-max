import {test, expect} from '@playwright/test'

test('multiplayer game lobby and start', async ({browser}) => {
	test.slow()

	const roomId = `test-room-${Date.now()}`

	const context1 = await browser.newContext()
	const page1 = await context1.newPage()
	await page1.goto(`/play/${roomId}?seed=playwright`)
	await expect(page1.getByTestId('hydrated')).toBeVisible()

	await expect(
		page1.getByRole('heading', {name: roomId, level: 1}),
	).toBeVisible()

	// Page 1 sees itself as the only connected player
	const connectedPlayersRegion1 = page1.getByRole('region', {
		name: 'Connected players',
	})
	await expect(connectedPlayersRegion1).toBeVisible()
	await expect(
		connectedPlayersRegion1.getByRole('listitem').first(),
	).toHaveText('Anonymous (you!)')

	const context2 = await browser.newContext()
	const page2 = await context2.newPage()
	await page2.goto(`/play/${roomId}`)
	await expect(page2.getByTestId('hydrated')).toBeVisible()
	// Page 2 sees the page1 player and itself!
	const connectedPlayersRegion2 = page2.getByRole('region', {
		name: 'Connected players',
	})
	await expect(connectedPlayersRegion2).toBeVisible()
	expect(
		await connectedPlayersRegion2.getByRole('listitem').all(),
	).toHaveLength(2)

	await expect(
		connectedPlayersRegion2.getByRole('listitem').first(),
	).toHaveText('Anonymous')
	await expect(connectedPlayersRegion2.getByRole('listitem').nth(1)).toHaveText(
		'Anonymous (you!)',
	)

	// Page 1 can see the second player too now
	await expect(connectedPlayersRegion1.getByRole('listitem').nth(1)).toHaveText(
		'Anonymous',
	)

	// We can start the game!
	const startButton = page1.getByRole('button', {name: 'start'})
	await startButton.click()

	await expect(page1.getByText('Tally')).toBeVisible()
	await expect(page2.getByText('Tally')).toBeVisible()

	// can see the top discard card
	const discardPileRegion1 = page1.getByRole('list', {name: 'Discard Pile'})
	await expect(
		discardPileRegion1.getByRole('img', {name: 'K of diamonds'}),
	).toBeVisible()

	// Player 1 starts with 4 cards (3 + 1 already drawn for turn)
	const heroHandRegion1 = page1.getByRole('list', {name: 'Hero hand'})
	await expect(heroHandRegion1.getByRole('listitem')).toHaveCount(4)

	// Player 2 starts with 3 cards
	const villainHandRegion1 = page1.getByRole('list', {name: 'Villain 1 hand'})
	await expect(villainHandRegion1.getByRole('listitem')).toHaveCount(3)
	// Player 1 cannot see the Villain's cards!
	await expect(
		villainHandRegion1.getByRole('img', {name: 'The back of a card'}),
	).toHaveCount(3)

	// Player 1 plays the 8 of spades (on min mode, beats the King of diamonds)
	await heroHandRegion1.getByRole('button', {name: '8 of spades'}).click()
	await expect(
		discardPileRegion1.getByRole('img', {name: '8 of spades'}),
	).toBeVisible()

	// We should change to mode max after spinning!
	await expect(
		page1.getByRole('heading', {level: 3, name: 'mode min'}),
	).toBeVisible()
	await page1.getByRole('button', {name: 'spin'}).click()
	await expect(
		page1.getByRole('heading', {level: 3, name: 'mode max'}),
	).toBeVisible()

	// End turn, villain draws a card!
	await page1.getByRole('button', {name: 'End Turn'}).click()
	await expect(
		villainHandRegion1.getByRole('img', {name: 'The back of a card'}),
	).toHaveCount(4)
	await expect(page1.getByRole('button', {name: 'End Turn'})).toBeDisabled()

	await context1.close()
	await context2.close()
})
