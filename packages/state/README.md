# Min or Max State

Game state management for Min or Max, implemented with XState!

## Notable tech

- State Machine framework: [XState](https://xstate.js.org/)
- Tests: [Vitest](https://vitest.dev/)
- [TypeScript](https://www.typescriptlang.org/) for static type checking

## Local development

This package is not to be used by itself: Depend on it and use in another app or package!

### Install dependencies

```sh
pnpm i
```

Will install dependencies for everything in the monorepo!

## Tests

```bash
pnpm test
```

## Gameplay Logic

I am documenting the gameplay mechanics here, to help us derive the states we need.

### Lobby

We need a place for players to wait in before joining the game. Players can join alphanumeric rooms, if they want to guarantee they play with friends (like room `K234`: 1-9 + JKQ, representing the common card deck). This will likely be obfuscated to the user and not part of our state machines: room codes will be generated at the server and be "kept" in the URL, `/play/[:roomId]`.

### Setup

Players share a community pile of cards.

- The game board has a digital screen keeping track of the current score. This starts at `0` and gets recalculated appropriately every time a card is played.
- At the start of the game, each player draws 3 cards.
- The game board has a Min digital screen, and a Max digital screen. These now get RNG'd to a value, (such as a number between [-10, -20] for Min, or [30, 50] for Max), at the start of the game. These values are the "thresholds" for winning or losing the game.
- The game board has the "Min or Max wheel". The token has two faces: Min and Max. The wheel starts on max, and is automatically spun. We need to keep track of the degrees (or radians, or whatever is convenient). No matter the angle, its gameplay state will either be "Min" or "Max". So, if we are going with degrees, 0-179 derives to "Max", 180-359 derives to "Min".
- 1 is "played" from the community pile, then placed on the discard pile. This is a valid "played" card, so the "score" gets updated appropriately: If the wheel is on Min, the card's value gets subtracted, if we are on Max, the card value gets added!
  -- Number cards add their face value (2-10), face cards add 10. Aces add either 1 or 11, depending on what the player decides when playing it. Aces always count as 11 when drawn from the community pile at the start of the game.
  -- The top card of the discard pile is the card to "beat" on each turn!
  -- If either the Min or Max value are **exactly** reached, the player who's turn it is WINS the game instantly!
  -- If either the Min or Max value are absolutely EXCEEDED (lower than Min, or higher than Max), the player who's turn it is LOSES the game instantly!
  -- You also lose the game if you cannot "beat" the top discard card as per the rules.
  -- There should never be a situation where a player on their turn has no cards to play, but it is likely they will not have a **valid** card to play.

### Gameplay

- At the start of your turn, you draw one card.
- Anytime but only ONCE per turn, you MAY decide to spin the "Min or Max wheel".
- You HAVE to play a single card from your hand.
  -- You may only play a card that "beats" the top discard card. If the wheel is on "Max", you MUST play a card with a value >= than the top discard card. If the wheel is on "Min", you must play a card with a value <= than the top discard card.
  -- An Ace counts as both the lowest, and the highest card! So, it can get you out of any spot, but also gets beat by anything.
  -- Player decides whether to play the Ace as a `1` or `11` value. You may play an Ace as an `11`, even if you play it as a Min card (for example, you may play it on top of a 2 and still count it as `11`!).

  This means that Aces do have "special gameplay logic" needing user input! In the future, we will introduce Jokers which may also have special game-play logic requiring user input. Maybe all face cards will have special logic (Jack: draw the next face card from the community draw pile, or choose what type of face card you want to find).

- After playing your card, you still have the opportunity to spin the "Min or Max" wheel if you haven't already.

There is a time limit for taking actions, although I don't think that should be part of the state machine. You CANNOT skip your turn, so if the time limit is reached, it's likely the server will "decide" to play a card for you. Valid if possible, but something that makes you lose if not! You MUST draw a card on your turn, and you MUST play a card on your turn.

- Player ends their turn, and we loop 🔁 into the next player, until someone insta-wins, or insta-loses!

### Game Over

When a player wins or loses, the game is over. We show a celebratory screen with stats, then an option to "Rematch" which every player need to agree on. (if there's three players in the lobby, two agree to rematch and the third leaves, the game starts again!).

Back to lobby gets you back into the lobby.

It's likely the Game Over state will need to move between the "celebratory / results" state, into the one where you can rematch, or go back to the lobby.

#### NOTES

There is no pausing the game!

**Server concerns (not in state machines):**

- Reconnection grace period for disconnected players
- Bot replacement when players leave (invisible to remaining players)
