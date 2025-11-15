import type {Snapshot} from 'xstate'
import type {
	SetupInput,
	PlayingInput,
	LobbyContext,
	SetupContext,
} from '@repo/state'

type Phase = 'lobby' | 'setup' | 'playing' | 'gameOver'

export const getNextPhase = (
	snapshot: Snapshot<unknown> & {value?: unknown},
): Phase | null => {
	const value = snapshot.value

	// Lobby machine transitions to setup when reaching 'ready' state
	if (value === 'ready') {
		return 'setup'
	}

	// Setup machine transitions to playing when reaching 'complete' state
	if (value === 'complete') {
		return 'playing'
	}

	// Playing machine is in gameOver when it reaches that state
	if (value === 'gameOver') {
		return 'gameOver'
	}

	// No transition needed - still in current phase
	return null
}

export const createTransitionInput = (
	targetPhase: Phase,
	snapshot: Snapshot<unknown> & {context?: unknown},
): SetupInput | PlayingInput | null => {
	if (!snapshot.context) {
		return null
	}

	if (targetPhase === 'setup') {
		const context = snapshot.context as LobbyContext

		if (!context.rng || !context.players || !context.deck) {
			return null
		}

		return {
			rng: context.rng,
			players: context.players,
			deck: context.deck,
		}
	}

	if (targetPhase === 'playing') {
		const context = snapshot.context as SetupContext

		if (
			!context.rng ||
			!context.players ||
			!context.drawPile ||
			!context.discardPile
		) {
			return null
		}

		return {
			rng: context.rng,
			players: context.players,
			drawPile: context.drawPile,
			discardPile: context.discardPile,
			minThreshold: context.minThreshold,
			maxThreshold: context.maxThreshold,
			wheelAngle: context.wheelAngle,
			currentScore: context.currentScore,
			currentPlayerIndex: 0,
			hasSpunThisTurn: false,
		}
	}

	// No input needed for other transitions or unsupported transitions
	return null
}
