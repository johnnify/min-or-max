const generateShortId = (): string => {
	return Math.random().toString(16).slice(2, 6)
}

export const getOrCreatePlayerId = (): string => {
	const stored = localStorage.getItem('playerId')
	if (stored) return stored

	const newId = `player-${generateShortId()}`
	localStorage.setItem('playerId', newId)
	return newId
}

export const getOrCreatePlayerName = (): string => {
	const stored = localStorage.getItem('playerName')
	if (stored) return stored

	const shortId = generateShortId()
	const newName = `Player ${shortId}`
	localStorage.setItem('playerName', newName)
	return newName
}
