import { v } from 'convex/values'
import { mutation } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

// ===========================================
// Types
// ===========================================

type GamePlayer = Doc<'gamePlayers'>
type Game = Doc<'games'>
type GameCard = Doc<'gameCards'>
type TimelineEntry = Doc<'timelineEntries'>

// ===========================================
// Authorization helpers
// ===========================================

/**
 * Verify the caller can act for the given player seat
 * - For kind:"user" -> caller's userId must match the seat's userId
 * - For kind:"local" -> caller must be the game host
 */
async function verifyCanActForPlayer(
  ctx: MutationCtx,
  game: Game,
  player: GamePlayer,
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Not authenticated')
  }

  if (player.kind === 'user') {
    if (player.userId !== identity.subject) {
      throw new Error('You cannot act for this player')
    }
  } else {
    // Local seat - only host can act
    if (game.hostUserId !== identity.subject) {
      throw new Error('Only the host can act for local players')
    }
  }
}

/**
 * Get the active player for the current turn
 */
async function getActivePlayer(
  ctx: MutationCtx,
  game: Game,
): Promise<GamePlayer> {
  const player = await ctx.db
    .query('gamePlayers')
    .withIndex('by_gameId_and_seatIndex', (q) =>
      q.eq('gameId', game._id).eq('seatIndex', game.currentTurnSeatIndex),
    )
    .unique()

  if (!player) {
    throw new Error('Active player not found')
  }

  return player
}

// ===========================================
// Timeline helpers
// ===========================================

/**
 * Get a player's timeline cards in order, with their release years
 */
async function getPlayerTimeline(
  ctx: MutationCtx,
  playerId: Id<'gamePlayers'>,
): Promise<Array<{ entry: TimelineEntry; card: GameCard }>> {
  const entries = await ctx.db
    .query('timelineEntries')
    .withIndex('by_playerId', (q) => q.eq('playerId', playerId))
    .collect()

  entries.sort((a, b) => a.position - b.position)

  const result: Array<{ entry: TimelineEntry; card: GameCard }> = []
  for (const entry of entries) {
    const card = await ctx.db.get('gameCards', entry.cardId)
    if (card) {
      result.push({ entry, card })
    }
  }

  return result
}

/**
 * Compute valid insertion indices for a card with the given year.
 * Returns all valid indices where the card can be placed.
 *
 * Rules:
 * - Timeline is sorted by release year (ascending)
 * - A card can go before any card with year >= its year
 * - A card can go after any card with year <= its year
 * - If years are equal, adjacent placement is valid
 */
function computeValidInsertionIndices(
  timeline: Array<{ releaseYear: number }>,
  newCardYear: number,
): Array<number> {
  const validIndices: Array<number> = []

  // Check each possible insertion point (0 to timeline.length inclusive)
  for (let i = 0; i <= timeline.length; i++) {
    const yearBefore = i > 0 ? timeline[i - 1].releaseYear : -Infinity
    const yearAfter = i < timeline.length ? timeline[i].releaseYear : Infinity

    // Valid if: yearBefore <= newCardYear <= yearAfter
    if (yearBefore <= newCardYear && newCardYear <= yearAfter) {
      validIndices.push(i)
    }
  }

  return validIndices
}

/**
 * Find the correct insertion index for a card (for auto-placement)
 * Uses binary search to find the right position
 */
function findCorrectInsertionIndex(
  timeline: Array<{ releaseYear: number }>,
  newCardYear: number,
): number {
  // Find the first position where the card fits
  let low = 0
  let high = timeline.length

  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (timeline[mid].releaseYear <= newCardYear) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  return low
}

/**
 * Insert a card into a player's timeline at the given position
 */
async function insertCardIntoTimeline(
  ctx: MutationCtx,
  gameId: Id<'games'>,
  playerId: Id<'gamePlayers'>,
  cardId: Id<'gameCards'>,
  insertIndex: number,
): Promise<void> {
  // Get current timeline
  const entries = await ctx.db
    .query('timelineEntries')
    .withIndex('by_playerId', (q) => q.eq('playerId', playerId))
    .collect()

  entries.sort((a, b) => a.position - b.position)

  // Shift entries at and after insertIndex
  for (const entry of entries) {
    if (entry.position >= insertIndex) {
      await ctx.db.patch('timelineEntries', entry._id, {
        position: entry.position + 1,
      })
    }
  }

  // Insert the new entry
  await ctx.db.insert('timelineEntries', {
    gameId,
    playerId,
    cardId,
    position: insertIndex,
  })

  // Update card state
  await ctx.db.patch('gameCards', cardId, {
    state: 'timeline',
    ownerPlayerId: playerId,
    deckOrder: undefined,
  })
}

/**
 * Draw the next card from the deck
 * Cards are drawn in ascending deckOrder to maintain deterministic shuffling
 */
async function drawNextCard(
  ctx: MutationCtx,
  gameId: Id<'games'>,
): Promise<GameCard | null> {
  // Collect all deck cards and sort by deckOrder to get the next card
  const deckCards = await ctx.db
    .query('gameCards')
    .withIndex('by_gameId_and_state', (q) =>
      q.eq('gameId', gameId).eq('state', 'deck'),
    )
    .collect()

  if (deckCards.length === 0) {
    return null
  }

  // Sort by deckOrder ascending (lower numbers drawn first)
  // Cards without deckOrder should be last (shouldn't happen in normal flow)
  deckCards.sort((a, b) => {
    if (a.deckOrder === undefined && b.deckOrder === undefined) return 0
    if (a.deckOrder === undefined) return 1
    if (b.deckOrder === undefined) return -1
    return a.deckOrder - b.deckOrder
  })

  return deckCards[0]
}

/**
 * Advance to the next player's turn
 */
async function advanceTurn(ctx: MutationCtx, game: Game): Promise<number> {
  const players = await ctx.db
    .query('gamePlayers')
    .withIndex('by_gameId', (q) => q.eq('gameId', game._id))
    .collect()

  const nextSeatIndex = (game.currentTurnSeatIndex + 1) % players.length
  return nextSeatIndex
}

// ===========================================
// Turn Mutations
// ===========================================

/**
 * Start a new round: draw a card and begin placement phase
 */
export const startRound = mutation({
  args: {
    gameId: v.id('games'),
    actingPlayerId: v.id('gamePlayers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const game = await ctx.db.get('games', args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (game.phase !== 'awaitingStart') {
      throw new Error('Cannot start round in current phase')
    }

    const activePlayer = await getActivePlayer(ctx, game)
    if (activePlayer._id !== args.actingPlayerId) {
      throw new Error('Not your turn')
    }

    await verifyCanActForPlayer(ctx, game, activePlayer)

    // Draw next card
    const card = await drawNextCard(ctx, game._id)
    if (!card) {
      // No more cards - game ends in a draw (or we could end based on highest timeline)
      await ctx.db.patch('games', args.gameId, {
        phase: 'finished',
        finishedAt: Date.now(),
      })
      return null
    }

    // Update card state
    await ctx.db.patch('gameCards', card._id, { state: 'inRound' })

    // Update game state
    await ctx.db.patch('games', args.gameId, {
      phase: 'awaitingPlacement',
      currentRound: {
        cardId: card._id,
        activePlayerId: activePlayer._id,
        placementIndex: undefined,
        bets: [],
        tokenClaimers: [],
      },
    })

    return null
  },
})

/**
 * Skip the current round (costs 1 token)
 * Discards current card and draws a new one
 */
export const skipRound = mutation({
  args: {
    gameId: v.id('games'),
    actingPlayerId: v.id('gamePlayers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const game = await ctx.db.get('games', args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (!game.useTokens) {
      throw new Error('Tokens are not enabled for this game')
    }

    if (game.phase !== 'awaitingPlacement') {
      throw new Error('Cannot skip in current phase')
    }

    if (!game.currentRound) {
      throw new Error('No active round')
    }

    const activePlayer = await ctx.db.get('gamePlayers', args.actingPlayerId)
    if (
      !activePlayer ||
      activePlayer._id !== game.currentRound.activePlayerId
    ) {
      throw new Error('Not your turn')
    }

    await verifyCanActForPlayer(ctx, game, activePlayer)

    if (activePlayer.tokenBalance < 1) {
      throw new Error('Not enough tokens to skip')
    }

    // Deduct token
    await ctx.db.patch('gamePlayers', activePlayer._id, {
      tokenBalance: activePlayer.tokenBalance - 1,
    })

    // Discard current card
    await ctx.db.patch('gameCards', game.currentRound.cardId, {
      state: 'discarded',
    })

    // Draw new card
    const newCard = await drawNextCard(ctx, game._id)
    if (!newCard) {
      // No more cards - end game
      await ctx.db.patch('games', args.gameId, {
        phase: 'finished',
        finishedAt: Date.now(),
      })
      return null
    }

    // Update new card state
    await ctx.db.patch('gameCards', newCard._id, { state: 'inRound' })

    // Update round with new card (keep same active player, clear bets)
    await ctx.db.patch('games', args.gameId, {
      currentRound: {
        cardId: newCard._id,
        activePlayerId: activePlayer._id,
        placementIndex: undefined,
        bets: [],
        tokenClaimers: [],
      },
    })

    return null
  },
})

/**
 * Place the current card on the active player's timeline
 * Can also be used during awaitingReveal to reposition before reveal
 */
export const placeCard = mutation({
  args: {
    gameId: v.id('games'),
    actingPlayerId: v.id('gamePlayers'),
    insertIndex: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const game = await ctx.db.get('games', args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    // Allow placement during both awaitingPlacement and awaitingReveal (for repositioning)
    if (game.phase !== 'awaitingPlacement' && game.phase !== 'awaitingReveal') {
      throw new Error('Cannot place card in current phase')
    }

    if (!game.currentRound) {
      throw new Error('No active round')
    }

    const activePlayer = await ctx.db.get('gamePlayers', args.actingPlayerId)
    if (
      !activePlayer ||
      activePlayer._id !== game.currentRound.activePlayerId
    ) {
      throw new Error('Not your turn')
    }

    await verifyCanActForPlayer(ctx, game, activePlayer)

    // Validate insert index is within bounds
    const timeline = await getPlayerTimeline(ctx, activePlayer._id)
    if (args.insertIndex < 0 || args.insertIndex > timeline.length) {
      throw new Error('Invalid insertion index')
    }

    // Store placement and move to reveal phase
    await ctx.db.patch('games', args.gameId, {
      phase: 'awaitingReveal',
      currentRound: {
        ...game.currentRound,
        placementIndex: args.insertIndex,
      },
    })

    return null
  },
})

/**
 * Place a bet that the active player placed the card incorrectly
 * (costs 1 token)
 */
export const placeBet = mutation({
  args: {
    gameId: v.id('games'),
    actingPlayerId: v.id('gamePlayers'),
    slotIndex: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const game = await ctx.db.get('games', args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (!game.useTokens) {
      throw new Error('Tokens are not enabled for this game')
    }

    // Can bet during placement or before reveal
    if (game.phase !== 'awaitingPlacement' && game.phase !== 'awaitingReveal') {
      throw new Error('Cannot bet in current phase')
    }

    if (!game.currentRound) {
      throw new Error('No active round')
    }

    const bettorPlayer = await ctx.db.get('gamePlayers', args.actingPlayerId)
    if (!bettorPlayer) {
      throw new Error('Player not found')
    }

    await verifyCanActForPlayer(ctx, game, bettorPlayer)

    // Cannot bet on your own turn
    if (bettorPlayer._id === game.currentRound.activePlayerId) {
      throw new Error('Cannot bet on your own turn')
    }

    if (bettorPlayer.tokenBalance < 1) {
      throw new Error('Not enough tokens to bet')
    }

    // Check if this player already bet
    if (
      game.currentRound.bets.some((b) => b.bettorPlayerId === bettorPlayer._id)
    ) {
      throw new Error('You already placed a bet this round')
    }

    // Get active player's timeline to validate slot index
    const activePlayer = await ctx.db.get(
      'gamePlayers',
      game.currentRound.activePlayerId,
    )
    if (!activePlayer) {
      throw new Error('Active player not found')
    }

    const timeline = await getPlayerTimeline(ctx, activePlayer._id)

    // Slot index represents where the bettor thinks the card should go
    if (args.slotIndex < 0 || args.slotIndex > timeline.length) {
      throw new Error('Invalid slot index')
    }

    // Check if another bettor already claimed this slot
    if (game.currentRound.bets.some((b) => b.slotIndex === args.slotIndex)) {
      throw new Error('Another player already bet on this slot')
    }

    // Deduct token
    await ctx.db.patch('gamePlayers', bettorPlayer._id, {
      tokenBalance: bettorPlayer.tokenBalance - 1,
    })

    // Add bet
    const newBets = [
      ...game.currentRound.bets,
      {
        bettorPlayerId: bettorPlayer._id,
        slotIndex: args.slotIndex,
        timestamp: Date.now(),
      },
    ]

    await ctx.db.patch('games', args.gameId, {
      currentRound: {
        ...game.currentRound,
        bets: newBets,
      },
    })

    return null
  },
})

/**
 * Reveal the card (shows title/artist/year to all players)
 */
export const revealCard = mutation({
  args: {
    gameId: v.id('games'),
    actingPlayerId: v.id('gamePlayers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const game = await ctx.db.get('games', args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (game.phase !== 'awaitingReveal') {
      throw new Error('Cannot reveal in current phase')
    }

    if (!game.currentRound) {
      throw new Error('No active round')
    }

    // Either active player or host can trigger reveal
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const isHost = game.hostUserId === identity.subject
    const activePlayer = await ctx.db.get(
      'gamePlayers',
      game.currentRound.activePlayerId,
    )

    if (!isHost) {
      if (!activePlayer) {
        throw new Error('Active player not found')
      }
      await verifyCanActForPlayer(ctx, game, activePlayer)
    }

    // Move to revealed phase
    await ctx.db.patch('games', args.gameId, {
      phase: 'revealed',
    })

    return null
  },
})

/**
 * Claim a token for correctly guessing the song (during revealed phase)
 * Capped at maxTokens per player, once per round
 */
export const claimGuessToken = mutation({
  args: {
    gameId: v.id('games'),
    actingPlayerId: v.id('gamePlayers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const game = await ctx.db.get('games', args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (!game.useTokens) {
      throw new Error('Tokens are not enabled for this game')
    }

    if (game.phase !== 'revealed') {
      throw new Error('Can only claim tokens during revealed phase')
    }

    if (!game.currentRound) {
      throw new Error('No active round')
    }

    const player = await ctx.db.get('gamePlayers', args.actingPlayerId)
    if (!player) {
      throw new Error('Player not found')
    }

    await verifyCanActForPlayer(ctx, game, player)

    // Check if already claimed this round
    if (game.currentRound.tokenClaimers.includes(player._id)) {
      throw new Error('You already claimed a token this round')
    }

    // Check token cap
    if (player.tokenBalance >= game.maxTokens) {
      throw new Error('You are at the maximum token limit')
    }

    // Grant token
    await ctx.db.patch('gamePlayers', player._id, {
      tokenBalance: player.tokenBalance + 1,
    })

    // Record the claim
    await ctx.db.patch('games', args.gameId, {
      currentRound: {
        ...game.currentRound,
        tokenClaimers: [...game.currentRound.tokenClaimers, player._id],
      },
    })

    return null
  },
})

/**
 * Resolve the round: validate placement, handle bets, advance turn
 */
export const resolveRound = mutation({
  args: {
    gameId: v.id('games'),
    actingPlayerId: v.id('gamePlayers'),
  },
  returns: v.object({
    placementCorrect: v.boolean(),
    cardWentTo: v.union(
      v.literal('activePlayer'),
      v.literal('bettor'),
      v.literal('discard'),
    ),
    winningBettorId: v.optional(v.id('gamePlayers')),
    winnerId: v.optional(v.id('gamePlayers')),
  }),
  handler: async (ctx, args) => {
    const game = await ctx.db.get('games', args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (game.phase !== 'revealed') {
      throw new Error('Cannot resolve in current phase')
    }

    if (!game.currentRound || game.currentRound.placementIndex === undefined) {
      throw new Error('No active round or placement')
    }

    // Either active player or host can trigger resolve
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const isHost = game.hostUserId === identity.subject
    const activePlayer = await ctx.db.get(
      'gamePlayers',
      game.currentRound.activePlayerId,
    )

    if (!isHost && activePlayer) {
      await verifyCanActForPlayer(ctx, game, activePlayer)
    }

    if (!activePlayer) {
      throw new Error('Active player not found')
    }

    const card = await ctx.db.get('gameCards', game.currentRound.cardId)
    if (!card) {
      throw new Error('Card not found')
    }

    // Get active player's timeline
    const timeline = await getPlayerTimeline(ctx, activePlayer._id)

    // Compute valid insertion indices for this card
    const validIndices = computeValidInsertionIndices(
      timeline.map((t) => ({ releaseYear: t.card.releaseYear })),
      card.releaseYear,
    )

    const placementIndex = game.currentRound.placementIndex
    const placementCorrect = validIndices.includes(placementIndex)

    let cardWentTo: 'activePlayer' | 'bettor' | 'discard' = 'discard'
    let winningBettorId: Id<'gamePlayers'> | undefined

    if (placementCorrect) {
      // Correct placement - card goes to active player's timeline
      await insertCardIntoTimeline(
        ctx,
        game._id,
        activePlayer._id,
        card._id,
        placementIndex,
      )
      cardWentTo = 'activePlayer'
    } else {
      // Incorrect placement - check for winning bettor
      // Sort bets by timestamp (earliest wins)
      const sortedBets = [...game.currentRound.bets].sort(
        (a, b) => a.timestamp - b.timestamp,
      )

      // Find the first bettor who bet on a correct slot
      for (const bet of sortedBets) {
        if (validIndices.includes(bet.slotIndex)) {
          // This bettor wins the card
          winningBettorId = bet.bettorPlayerId
          const winningBettor = await ctx.db.get(
            'gamePlayers',
            bet.bettorPlayerId,
          )

          if (winningBettor) {
            // Refund the winner's token
            await ctx.db.patch('gamePlayers', winningBettor._id, {
              tokenBalance: winningBettor.tokenBalance + 1,
            })

            // Insert card into the bettor's timeline at the correct position
            const bettorTimeline = await getPlayerTimeline(
              ctx,
              winningBettor._id,
            )
            const correctIndex = findCorrectInsertionIndex(
              bettorTimeline.map((t) => ({ releaseYear: t.card.releaseYear })),
              card.releaseYear,
            )

            await insertCardIntoTimeline(
              ctx,
              game._id,
              winningBettor._id,
              card._id,
              correctIndex,
            )
            cardWentTo = 'bettor'
          }
          break
        }
      }

      // If no winning bettor, card is discarded
      if (cardWentTo === 'discard') {
        await ctx.db.patch('gameCards', card._id, { state: 'discarded' })
      }
    }

    // Check win condition
    let winnerId: Id<'gamePlayers'> | undefined

    // Get all players and check timeline sizes
    const allPlayers = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId', (q) => q.eq('gameId', game._id))
      .collect()

    for (const player of allPlayers) {
      const playerTimeline = await ctx.db
        .query('timelineEntries')
        .withIndex('by_playerId', (q) => q.eq('playerId', player._id))
        .collect()

      if (playerTimeline.length >= game.winCondition) {
        winnerId = player._id
        break
      }
    }

    // Advance turn
    const nextSeatIndex = await advanceTurn(ctx, game)

    if (winnerId) {
      // Game over
      await ctx.db.patch('games', args.gameId, {
        phase: 'finished',
        currentRound: undefined,
        winnerId,
        finishedAt: Date.now(),
      })
    } else {
      // Continue to next turn
      await ctx.db.patch('games', args.gameId, {
        phase: 'awaitingStart',
        currentTurnSeatIndex: nextSeatIndex,
        currentRound: undefined,
      })
    }

    return {
      placementCorrect,
      cardWentTo,
      winningBettorId,
      winnerId,
    }
  },
})

/**
 * Trade 3 tokens for a card that is auto-inserted correctly
 * (only during awaitingStart phase, before starting your turn)
 */
export const tradeTokensForCard = mutation({
  args: {
    gameId: v.id('games'),
    actingPlayerId: v.id('gamePlayers'),
  },
  returns: v.object({
    cardId: v.id('gameCards'),
    insertedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const game = await ctx.db.get('games', args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (!game.useTokens) {
      throw new Error('Tokens are not enabled for this game')
    }

    if (game.phase !== 'awaitingStart') {
      throw new Error('Can only trade tokens before starting your turn')
    }

    const activePlayer = await getActivePlayer(ctx, game)
    if (activePlayer._id !== args.actingPlayerId) {
      throw new Error('Not your turn')
    }

    await verifyCanActForPlayer(ctx, game, activePlayer)

    if (activePlayer.tokenBalance < 3) {
      throw new Error('Need 3 tokens to trade for a card')
    }

    // Draw a card
    const card = await drawNextCard(ctx, game._id)
    if (!card) {
      throw new Error('No cards remaining')
    }

    // Deduct 3 tokens
    await ctx.db.patch('gamePlayers', activePlayer._id, {
      tokenBalance: activePlayer.tokenBalance - 3,
    })

    // Get player's timeline and find correct insertion point
    const timeline = await getPlayerTimeline(ctx, activePlayer._id)
    const insertIndex = findCorrectInsertionIndex(
      timeline.map((t) => ({ releaseYear: t.card.releaseYear })),
      card.releaseYear,
    )

    // Insert the card
    await insertCardIntoTimeline(
      ctx,
      game._id,
      activePlayer._id,
      card._id,
      insertIndex,
    )

    // Check win condition
    const newTimeline = await ctx.db
      .query('timelineEntries')
      .withIndex('by_playerId', (q) => q.eq('playerId', activePlayer._id))
      .collect()

    if (newTimeline.length >= game.winCondition) {
      await ctx.db.patch('games', args.gameId, {
        phase: 'finished',
        winnerId: activePlayer._id,
        finishedAt: Date.now(),
      })
    }

    return {
      cardId: card._id,
      insertedAt: insertIndex,
    }
  },
})
