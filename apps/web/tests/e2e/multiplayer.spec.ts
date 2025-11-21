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

	await expect(page1.getByRole('complementary', {name: 'tally'})).toBeVisible()
	await expect(page2.getByRole('complementary', {name: 'tally'})).toBeVisible()

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

	// current tally should be 8
	await expect(
		page1.getByRole('complementary', {name: 'tally'}).getByText('8'),
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

	// Player 2 plays an ace, which is a card needing a choice!
	const heroHandRegion2 = page2.getByRole('list', {name: 'Hero hand'})
	await heroHandRegion2.getByRole('button', {name: 'A of hearts'}).click()

	const aceChoiceDialog = page2.getByRole('alertdialog', {
		name: 'Make your choice',
	})
	await aceChoiceDialog.getByRole('button', {name: 'Small Ace'}).click()

	// current tally should be 19 now (8 + 11)
	await expect(
		page2.getByRole('complementary', {name: 'tally'}).getByText('19'),
	).toBeVisible()

	await context1.close()
	await context2.close()
})

test('room can be re-used after all players disconnect', async ({browser}) => {
	test.slow()

	const roomId = `reusable-room-${Date.now()}`

	// First game session
	const context1 = await browser.newContext()
	const page1 = await context1.newPage()
	await page1.goto(`/play/${roomId}?seed=first-session`)
	await expect(page1.getByTestId('hydrated')).toBeVisible()

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

	await expect(connectedPlayersRegion1.getByRole('listitem')).toHaveCount(2)

	await page1.getByRole('button', {name: 'start'}).click()
	await expect(page1.getByRole('complementary', {name: 'tally'})).toBeVisible()

	// Close both contexts to simulate all players disconnecting
	await context1.close()
	await context2.close()

	// Small delay to ensure cleanup
	await new Promise((resolve) => setTimeout(resolve, 100))

	// Second game session - new player joins the same room
	const context3 = await browser.newContext()
	const page3 = await context3.newPage()
	await page3.goto(`/play/${roomId}`)
	await expect(page3.getByTestId('hydrated')).toBeVisible()

	const connectedPlayersRegion3 = page3.getByRole('region', {
		name: 'Connected players',
	})
	await expect(connectedPlayersRegion3).toBeVisible()

	// Should see themselves in a fresh lobby
	await expect(
		connectedPlayersRegion3.getByRole('listitem').first(),
	).toHaveText('Anonymous (you!)')
	await expect(connectedPlayersRegion3.getByRole('listitem')).toHaveCount(1)

	// Should be able to add a second player
	const context4 = await browser.newContext()
	const page4 = await context4.newPage()
	await page4.goto(`/play/${roomId}`)
	await expect(page4.getByTestId('hydrated')).toBeVisible()

	await expect(connectedPlayersRegion3.getByRole('listitem')).toHaveCount(2)

	// Should be able to start a fresh game
	const startButton = page3.getByRole('button', {name: 'start'})
	await expect(startButton).toBeEnabled()
	await startButton.click()

	await expect(page3.getByRole('complementary', {name: 'tally'})).toBeVisible()
	await expect(page4.getByRole('complementary', {name: 'tally'})).toBeVisible()

	await context3.close()
	await context4.close()
})
