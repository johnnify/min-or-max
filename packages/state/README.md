# Min or Max State

Web app for Min or Max, implemented with XState!

## Notable tech

- State Machine framework: [XState](https://xstate.js.org/)
- Tests: [Vitest](https://vitest.dev/)
- [TypeScript](https://www.typescriptlang.org/) for static type checking

## Local development

This package is not to be used by itself: Use it in either `/apps/web` or `/apps/server`!

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

At any time, players can "react" by tapping a selection of emojis like 😂, 🧡, 😁, 😱. I propose a `PLAYER_REACTED`, with an emoji payload.

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

There will need to be a reconnection grace period. If a player leaves, we'll need to get a bot to replace them (however, no need for the user to know it's a bot: to them, it's just like a new replacement player joined)

## State Machines

### Game Machine (Root)

The main state machine coordinating the entire game flow.

#### Top-Level States

```
game
├─ lobby
├─ setup
├─ playing
└─ gameOver
```

### Lobby Machine (Child)

**States:**

- `waiting` - Waiting for players to join and ready up
- `ready` - All players ready, game can start (transitions to setup)

**Events:**

- `PLAYER_JOINED` - A player joins the lobby
- `PLAYER_DROPPED` - A player leaves the lobby
- `PLAYER_READY` - A player marks themselves as ready
- `PLAYER_UNREADY` - A player unmarks ready
- `START_GAME` - Attempt to start the game

**Guards:**

- `hasMinimumPlayers` - At least 2 players
- `allPlayersReady` - All players marked ready
- `canAddPlayer` - Not at max players (4)

**Context:**

- `players: Player[]` - List of players with id, name, isReady, hand
- `minPlayers: 2`
- `maxPlayers: 4`

### Setup Machine (Child)

Initializes the game board and deals initial cards. Each step is discrete for suspense and clarity.

**States:**

- `dealingCards` - Deal 3 cards to each player
- `generatingThresholds` - RNG min threshold (e.g., -10 to -20) and max threshold (e.g., 30 to 50)
- `spinningInitialWheel` - Wheel starts at 90° (middle of Max), then spins for visual flair
- `playingFirstCard` - Draw first card from community pile, play it (Ace counts as 1), update score
- `complete` - Setup complete, transition to playing

**Events:**

- `CARDS_DEALT`
- `THRESHOLDS_SET`
- `WHEEL_SPUN` - Includes final angle after animation
- `FIRST_CARD_PLAYED`
- `SETUP_COMPLETE`

**Context:**

- `drawPile: Card[]` - Remaining cards to draw from
- `discardPile: Card[]` - Played cards
- `currentScore: number` - After first card, will be -10 to 11 (During setup, Ace=1 if wheel is on Min, Ace=11 if wheel is on Max)
- `minThreshold: number` - RNG'd value (e.g., -10 to -20)
- `maxThreshold: number` - RNG'd value (e.g., 30 to 50)
- `wheelAngle: number` - Current wheel angle (0-359), starts at 90

**Derived State:**

- `wheelMode: 'min' | 'max'` - **ALWAYS derived from wheelAngle**
  - `wheelAngle >= 0 && wheelAngle < 180` → `'max'`
  - `wheelAngle >= 180 && wheelAngle < 360` → `'min'`
  - Never stored separately to prevent desync!

### Playing Machine (Child)

Main gameplay loop where players take turns.

**States:**

```
playing
└─ round (repeating until game over)
   ├─ turnStart
   ├─ playerTurn (nested compound state)
   │  ├─ awaitingAction
   │  ├─ spinningWheel
   │  ├─ choosingCard
   │  ├─ choosingCardEffect
   │  ├─ processingCard
   │  └─ postCardPlay
   └─ evaluatingOutcome
```

#### Sub-states Detail:

**`turnStart`**

- Auto-draw one card for current player
- Transition to `playerTurn.awaitingAction`

**`playerTurn.awaitingAction`**

- Player can choose to: spin wheel OR choose card to play
- Wait for `SPIN_WHEEL` or `CHOOSE_CARD` event

**`playerTurn.spinningWheel`**

- Wheel animation playing based on `force` parameter (subtle vs hard spin)
- On `WHEEL_SPIN_COMPLETE`: update wheelAngle, mark hasSpunThisTurn
- **Important:** Spinning does NOT recalculate current score - only affects next card played
- Return to `awaitingAction` if no card chosen yet

**`playerTurn.choosingCard`**

- Player chooses which card to play
- On `CHOOSE_CARD`: validate card beats top discard (see Ace rules below)
- If card has special effect (e.g., Ace, future Jokers/face cards): transition to `choosingCardEffect`
- Else: transition to `processingCard`

**`playerTurn.choosingCardEffect`**

- Player must choose card-specific effects
- For Ace: choose to play as 1 or 11
- For future cards: other effects (e.g., Jack: draw next face card, etc.)
- On `CHOOSE_CARD_EFFECT`: transition to `processingCard`

**`playerTurn.processingCard`**

- Card is played to discard pile and score is calculated
- Check immediate win/loss conditions:
  - Score === minThreshold OR score === maxThreshold → transition directly to `gameOver.showingResults` (winner)
  - Score < minThreshold OR score > maxThreshold → transition directly to `gameOver.showingResults` (loser)
- If no insta-win/loss: transition to `postCardPlay`

**`playerTurn.postCardPlay`**

- Card has been played without triggering game over
- If wheel not spun this turn: can still spin (back to `spinningWheel`)
- Else: transition to `evaluatingOutcome`

**`evaluatingOutcome`**

- Final evaluation after turn is complete
- **Note:** Most win/loss conditions are already evaluated in `processingCard`
- This state primarily handles any remaining edge cases and transitions to next player's `turnStart`
- **No auto-loss for having no valid cards** - player had chance to spin wheel first

**Ace Rules:**

- **Ace on discard pile:** Any card beats it (Ace is both lowest and highest)
- **Ace in hand:** Beats any card on discard pile (regardless of wheel mode)
- **Ace scoring:** Player chooses 1 or 11 when played (except setup where Ace is dependent on wheel mode)

**Events:**

- `TURN_STARTED` - Auto-draw card
- `SPIN_WHEEL` - Player initiates wheel spin with `force: number` (0-1, subtle to hard)
- `WHEEL_SPIN_COMPLETE` - Wheel animation finished, includes final `angle: number`
- `CHOOSE_CARD` - Player chooses card with `cardId: string`
- `CHOOSE_CARD_EFFECT` - Player chooses card-specific effect (e.g., `aceValue: 1 | 11` for Ace)
- `PLAY_CARD` - Card is played to discard pile (internal event)
- `SKIP_SPIN` - Player chooses not to spin after playing card
- `END_TURN` - Turn complete, move to next player (internal event)
- `PLAYER_WON` - Player hit exact threshold (internal event)
- `PLAYER_LOST` - Player exceeded threshold (internal event)
- `TIMEOUT` - Turn time limit reached, server auto-plays or forces loss

**Guards:**

- `canBeatTopCard` - Chosen card beats discard pile top card
  - If chosen card is Ace: always true
  - If top card is Ace: always true
  - If wheelMode === 'max': chosenCardValue >= topCardValue
  - If wheelMode === 'min': chosenCardValue <= topCardValue
- `isExactThreshold` - Score exactly matches min or max threshold
- `isOverThreshold` - Score exceeded limits (< min or > max)
- `hasSpunThisTurn` - Wheel already spun this turn
- `hasCardEffect` - Chosen card has special effect requiring player choice (Ace, future Jokers/face cards)

**Context (in addition to setup context):**

- `currentPlayerIndex: number`
- `hasSpunThisTurn: boolean` - Reset each turn
- `chosenCard: Card | null`
- `chosenCardEffect: {aceValue?: 1 | 11} | null` - Extensible for future card effects

### Game Over Machine (Child)

Handles end-of-game flow.

**States:**

```
gameOver
├─ showingResults (celebration/stats)
└─ awaitingRematch
   ├─ voting
   └─ countdown (if all agree)
```

**Events:**

- `SHOW_STATS` - Display game stats
- `VOTE_REMATCH` - Player votes for rematch
- `VOTE_LOBBY` - Player votes to return to lobby
- `PLAYER_LEFT` - Player leaves during voting
- `ALL_VOTED_REMATCH` - All remaining players voted rematch
- `REMATCH_STARTING` - Countdown complete, transition back to setup
- `RETURN_TO_LOBBY` - At least one player voted lobby or insufficient players

**Guards:**

- `allHumansVotedRematch` - All remaining human players voted rematch
- `hasMinimumPlayers` - At least 2 human players remain

**Context:**

- `winner: Player | null` - The winning player (only one winner per game)
- `losers: Player[]` - Array of losing players (at least one, potentially multiple in edge cases)
- `reason: 'exact_threshold' | 'exceeded_threshold'`
- `rematchVotes: Map<playerId, boolean>`

**Notes:**

- Bots automatically leave if 2+ human players remain
- Rematch proceeds with remaining human players only (minimum 2)
- If player leaves during voting and <2 humans remain, return to lobby

### Parallel States (Global)

These run concurrently with the main game flow.

**`reactions` (parallel)**

- Handles `PLAYER_REACTED` events at any time
- Event: `PLAYER_REACTED` with structure:
  - `playerId: string` - ID of player who reacted
  - `type: 'emoji'` - Type of reaction (only emoji for now, extensible for future)
  - `value: string` - The emoji string (e.g., '😂', '🧡', '😁', '😱')
- Updates reaction UI (emoji animations)
- No state transitions, just actions

**`connection` (parallel)**

- Tracks player connection status per player
- States: `connected` | `reconnecting` | `disconnected`
- Events:
  - `PLAYER_DISCONNECTED` - Player lost connection
  - `PLAYER_RECONNECTED` - Player reconnected
  - `GRACE_PERIOD_EXPIRED` - Reconnection window closed
- On disconnect → grace period → backend replaces with bot (state machine agnostic)
- On reconnect within grace period → restore player state
- Bot replacement is backend implementation detail (not in state machine)
