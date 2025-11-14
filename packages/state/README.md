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

## State Machines

### Architecture: Separate Actors

The game uses **separate, independent state machines** rather than a parent orchestrator:

1. **lobbyMachine** - Players join and ready up
2. **setupMachine** - Initialize game board and deal cards
3. **playingMachine** - Main gameplay loop
4. **gameOverMachine** - End-of-game flow (not yet implemented)

Each machine receives context from the previous machine's snapshot as input, creating a linear flow: lobby → setup → playing → gameOver.

This follows XState's "start flat, then nest" principle - we avoid unnecessary parent orchestration for a linear game flow.

### Lobby Machine

**States:**

- `waiting` - Waiting for players to join and ready up
- `ready` - All players ready, game can start (transitions to setup)

**Events:**

- `PLAYER_JOINED` - A player joins the lobby
- `PLAYER_DROPPED` - A player leaves the lobby
- `PLAYER_READY` - A player marks themselves as ready
- `PLAYER_UNREADY` - A player unmarks ready
- `SEED` - Initializes the RNG with a seed string (payload: `{seed: string}`)
- `START_GAME` - Attempt to start the game

**Guards:**

- `hasMinimumPlayers` - At least 2 players
- `allPlayersReady` - All players marked ready
- `canAddPlayer` - Not at max players (4)

**Context:**

- `players: Player[]` - List of players with id, name, isReady, hand
- `minPlayers: 2`
- `maxPlayers: 4`
- `rng: Rng | null` - Seeded random number generator, initialized via `SEED` event

### Setup Machine (Child)

Initializes the game board and deals initial cards. Each step is discrete for suspense and clarity.

**States:**

- `shufflingPile` - Shuffle the draw pile at the start of setup
- `dealingCards` - Deal 3 cards to each player
- `generatingThresholds` - RNG min threshold (e.g., -10 to -20) and max threshold (e.g., 30 to 50)
- `spinningInitialWheel` - Wheel starts at 90° (middle of Max), then spins for visual flair
- `playingFirstCard` - Draw first card from community pile, play it (Ace counts as 1), update score
- `complete` - Setup complete, transition to playing

**Events:**

- `SHUFFLE_PILE` - Shuffle a specific pile (payload: `{pile: 'draw' | 'discard'}`)
- `PILE_SHUFFLED` - Pile shuffling complete
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

### Playing Machine

Main gameplay loop where players take turns.

**States:**

```
playing
├─ turnStart (entry: draw card for current player)
├─ playerTurn (compound state)
│  ├─ awaitingAction (wait for SPIN_WHEEL or CHOOSE_CARD)
│  ├─ processingCard (determine if card has effect)
│  ├─ configuringEffect (wait for ADD_EFFECT/SEARCH_AND_DRAW/PLAY_CARD)
│  ├─ readyToPlay (wait for PLAY_CARD)
│  └─ postCardPlay (check win/loss, wait for END_TURN)
└─ gameOver (final state)
```

#### Current Implementation

**`turnStart`**

- Automatically draws one card for current player on `TURN_STARTED`
- Transitions to `playerTurn.awaitingAction`
- **Reshuffling logic:** If draw pile is empty, moves all cards from discard pile (except top card) to draw pile and shuffles
  - Fully tested in playing.test.ts:348-390

**`playerTurn.awaitingAction`**

- Player can:
  - Spin wheel with `SPIN_WHEEL` (updates wheelAngle, stays in awaitingAction)
  - Choose card with `CHOOSE_CARD` (validates with `canBeatTopCard` guard, transitions to processingCard)

**`playerTurn.processingCard`**

- Automatically evaluates if chosen card has effect:
  - If `chosenCardHasEffect`: → `configuringEffect`
  - Else: → `readyToPlay`

**`playerTurn.configuringEffect`**

- Waits for effect configuration events:
  - `ADD_EFFECT` - Adds effect to activeEffects array (e.g., value-adder, value-multiplier)
  - `SEARCH_AND_DRAW` - Searches draw pile for specific rank (J/Q/K) and adds to hand
  - `PLAY_CARD` - Proceeds to postCardPlay
- **Note:** Currently hardcoded in UI demo, needs Dialog for user choices

**`playerTurn.readyToPlay`**

- No effects to configure, wait for `PLAY_CARD`

**`playerTurn.postCardPlay`**

- Card played and score updated
- Applies active effects (value-adder, value-multiplier) and decrements stacksRemaining
- **Automatically checks win/loss conditions:**
  - If `isExactThreshold`: → `gameOver` (player wins!)
  - If `isOverThreshold`: → `gameOver` (player loses!)
- **Post-play wheel spinning:** Can spin wheel if not already spun this turn (guarded by `hasNotSpunThisTurn`)
  - Fully tested in playing.test.ts:392-461
- Waits for `END_TURN` to advance to next player

**`gameOver`**

- Final state - game has ended
- Reached when player wins (exact threshold) or loses (exceeded threshold)
- Context populated with:
  - `winner`: Player who won
  - `losers`: All other players
  - `reason`: 'exact_threshold' (win) or 'exceeded_threshold' (loss)

**Ace Rules (Implemented):**

- **Ace on discard pile:** Any card beats it
- **Ace in hand:** Beats any card on discard pile
- **Ace scoring:** User chooses 1 or 11 via `ADD_EFFECT` with `value: 0` (for 1) or `value: 10` (for 11)
  - Fully tested in playing.test.ts:349-400
  - UI currently hardcodes to 11, needs Dialog for user choice

**Events:**

- `TURN_STARTED` - Draw card for current player
- `SPIN_WHEEL` - Update wheel angle based on force (payload: `{force: number}`)
- `CHOOSE_CARD` - Select card to play (payload: `{cardId: string}`)
- `ADD_EFFECT` - Add active effect (payload: `{effect: ActiveEffect}`)
- `SEARCH_AND_DRAW` - Find and draw specific rank (payload: `{rank: 'J' | 'Q' | 'K'}`)
- `PLAY_CARD` - Play chosen card to discard pile
- `END_TURN` - Complete turn, advance to next player

**Guards:**

- `canBeatTopCard` - Validates chosen card can beat top discard card (Ace rules applied)
- `chosenCardHasEffect` - Checks if chosen card has `effect` property
- `hasNotSpunThisTurn` - Checks if wheel hasn't been spun this turn
- `isExactThreshold` - Checks if score exactly matches min or max threshold (WIN)
- `isOverThreshold` - Checks if score exceeded thresholds (LOSS)

**Context (extends setup context):**

- `currentPlayerIndex: number` - Index of current player
- `hasSpunThisTurn: boolean` - Tracks if wheel spun this turn
- `chosenCard: Card | null` - Currently selected card
- `activeEffects: ActiveEffect[]` - Effects that modify card values
- `winner: Player | null` - The player who won (set when gameOver)
- `losers: Player[]` - All losing players (set when gameOver)
- `reason: 'exact_threshold' | 'exceeded_threshold' | null` - Why the game ended

**Implemented:**

- ✅ Win condition: Transitions to `gameOver` when score exactly matches minThreshold or maxThreshold
  - Winner = current player who hit exact threshold
  - Losers = all other players
  - Tested in playing.test.ts:463-505
- ✅ Loss condition: Transitions to `gameOver` when score exceeds thresholds (< min or > max)
  - Winner = **previous player** (who went right before the player who broke threshold)
  - Losers = all other players (including current player who broke threshold)
  - Tested in playing.test.ts:507-549
- ✅ Complete game story test showing realistic multi-turn gameplay to victory
  - Tested in playing.test.ts:551-618
- ✅ Instant win/loss: Checks happen immediately in `postCardPlay` state via `always` transitions (no waiting for optional wheel spin)

**Not Yet Implemented:**

- Turn timeout handling
- Full gameOver machine (currently just a final state)

### Game Over Machine

**Status:** Not yet implemented

Planned to handle end-of-game flow including results display, rematch voting, and lobby return.

**Planned States:**

```
gameOver
├─ showingResults (celebration/stats)
└─ awaitingRematch
   ├─ voting
   └─ countdown (if all agree)
```

**Planned Events:**

- `SHOW_STATS` - Display game stats
- `VOTE_REMATCH` - Player votes for rematch
- `VOTE_LOBBY` - Player votes to return to lobby
- `PLAYER_LEFT` - Player leaves during voting
- `REMATCH_STARTING` - Countdown complete, transition back to setup
- `RETURN_TO_LOBBY` - Return to lobby

**Planned Context:**

- `winner: Player | null` - The winning player
- `losers: Player[]` - Losing players
- `reason: 'exact_threshold' | 'exceeded_threshold'`
- `rematchVotes: Map<playerId, boolean>`
