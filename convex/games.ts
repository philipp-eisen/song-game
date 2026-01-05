import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

// ===========================================
// Validators (exported for reuse)
// ===========================================

export const gameModeValidator = v.union(
  v.literal('hostOnly'),
  v.literal('sidecars'),
)

export const gamePhaseValidator = v.union(
  v.literal('lobby'),
  v.literal('awaitingStart'),
  v.literal('awaitingPlacement'),
  v.literal('awaitingReveal'),
  v.literal('revealed'),
  v.literal('finished'),
)

// ===========================================
// Helper functions
// ===========================================

/**
 * Generate a random 6-character alphanumeric join code
 */
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed ambiguous chars (0, O, 1, I)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: Array<T>): Array<T> {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ===========================================
// Game Creation
// ===========================================

/**
 * Create a new game
 *
 * For hostOnly mode: pass player names to create local seats
 * For sidecars mode: host creates the game and shares the join code
 */
export const create = mutation({
  args: {
    playlistId: v.id('playlists'),
    mode: gameModeValidator,
    // For hostOnly mode: array of player names (host is always first)
    playerNames: v.optional(v.array(v.string())),
    // Game options
    useTokens: v.optional(v.boolean()),
    startingTokens: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    winCondition: v.optional(v.number()),
  },
  returns: v.object({
    gameId: v.id('games'),
    joinCode: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject
    const userName = identity.name ?? 'Host'

    // Verify the playlist exists and belongs to the user
    const playlist = await ctx.db.get("playlists", args.playlistId)
    if (!playlist || playlist.ownerUserId !== userId) {
      throw new Error('Playlist not found or not owned by you')
    }

    // Generate a unique join code
    let joinCode = generateJoinCode()
    let attempts = 0
    while (attempts < 10) {
      const existing = await ctx.db
        .query('games')
        .withIndex('by_joinCode', (q) => q.eq('joinCode', joinCode))
        .first()
      if (!existing) break
      joinCode = generateJoinCode()
      attempts++
    }
    if (attempts >= 10) {
      throw new Error('Could not generate unique join code')
    }

    // Create the game
    const gameId = await ctx.db.insert('games', {
      hostUserId: userId,
      joinCode,
      mode: args.mode,
      playlistId: args.playlistId,
      useTokens: args.useTokens ?? true,
      startingTokens: args.startingTokens ?? 2,
      maxTokens: args.maxTokens ?? 5,
      winCondition: args.winCondition ?? 10,
      phase: 'lobby',
      currentTurnSeatIndex: 0,
      createdAt: Date.now(),
    })

    // Create player seats
    if (args.mode === 'hostOnly') {
      // For host-only mode, create local seats from the provided names
      const names =
        args.playerNames && args.playerNames.length > 0
          ? args.playerNames
          : [userName]

      for (let i = 0; i < names.length; i++) {
        await ctx.db.insert('gamePlayers', {
          gameId,
          seatIndex: i,
          displayName: names[i],
          kind: 'local',
          tokenBalance: args.startingTokens ?? 2,
          isHostSeat: i === 0,
        })
      }
    } else {
      // For sidecars mode, create a user seat for the host
      await ctx.db.insert('gamePlayers', {
        gameId,
        seatIndex: 0,
        displayName: userName,
        kind: 'user',
        userId,
        tokenBalance: args.startingTokens ?? 2,
        isHostSeat: true,
      })
    }

    return { gameId, joinCode }
  },
})

/**
 * Add a local player seat to a host-only game (in lobby phase)
 */
export const addLocalPlayer = mutation({
  args: {
    gameId: v.id('games'),
    displayName: v.string(),
  },
  returns: v.id('gamePlayers'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const game = await ctx.db.get("games", args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (game.hostUserId !== identity.subject) {
      throw new Error('Only the host can add local players')
    }

    if (game.mode !== 'hostOnly') {
      throw new Error('Cannot add local players in sidecars mode')
    }

    if (game.phase !== 'lobby') {
      throw new Error('Can only add players in lobby phase')
    }

    // Get current player count
    const players = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .collect()

    const playerId = await ctx.db.insert('gamePlayers', {
      gameId: args.gameId,
      seatIndex: players.length,
      displayName: args.displayName,
      kind: 'local',
      tokenBalance: game.startingTokens,
      isHostSeat: false,
    })

    return playerId
  },
})

/**
 * Remove a local player seat from a host-only game (in lobby phase)
 */
export const removeLocalPlayer = mutation({
  args: {
    playerId: v.id('gamePlayers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const player = await ctx.db.get("gamePlayers", args.playerId)
    if (!player) {
      throw new Error('Player not found')
    }

    const game = await ctx.db.get("games", player.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (game.hostUserId !== identity.subject) {
      throw new Error('Only the host can remove players')
    }

    if (game.mode !== 'hostOnly') {
      throw new Error('Cannot remove local players in sidecars mode')
    }

    if (game.phase !== 'lobby') {
      throw new Error('Can only remove players in lobby phase')
    }

    if (player.isHostSeat) {
      throw new Error('Cannot remove the host seat')
    }

    // Delete the player
    await ctx.db.delete("gamePlayers", args.playerId)

    // Re-index remaining players
    const remainingPlayers = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId', (q) => q.eq('gameId', player.gameId))
      .collect()

    // Sort by current seatIndex
    remainingPlayers.sort((a, b) => a.seatIndex - b.seatIndex)

    // Update seat indices
    for (let i = 0; i < remainingPlayers.length; i++) {
      if (remainingPlayers[i].seatIndex !== i) {
        await ctx.db.patch("gamePlayers", remainingPlayers[i]._id, {
          seatIndex: i,
        })
      }
    }

    return null
  },
})

/**
 * Join a game by code (sidecars mode only)
 */
export const joinByCode = mutation({
  args: {
    joinCode: v.string(),
    displayName: v.optional(v.string()),
  },
  returns: v.object({
    gameId: v.id('games'),
    playerId: v.id('gamePlayers'),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated. Please sign in or continue as guest.')
    }

    const userId = identity.subject
    const userName = args.displayName ?? identity.name ?? 'Player'

    // Find the game by join code
    const game = await ctx.db
      .query('games')
      .withIndex('by_joinCode', (q) =>
        q.eq('joinCode', args.joinCode.toUpperCase()),
      )
      .first()

    if (!game) {
      throw new Error('Game not found. Check the join code.')
    }

    if (game.mode !== 'sidecars') {
      throw new Error('This game does not accept remote players')
    }

    if (game.phase !== 'lobby') {
      throw new Error('Game has already started')
    }

    // Check if user is already in the game
    const existingPlayer = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId_and_userId', (q) =>
        q.eq('gameId', game._id).eq('userId', userId),
      )
      .first()

    if (existingPlayer) {
      return { gameId: game._id, playerId: existingPlayer._id }
    }

    // Get current player count
    const players = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId', (q) => q.eq('gameId', game._id))
      .collect()

    // Create user seat
    const playerId = await ctx.db.insert('gamePlayers', {
      gameId: game._id,
      seatIndex: players.length,
      displayName: userName,
      kind: 'user',
      userId,
      tokenBalance: game.startingTokens,
      isHostSeat: false,
    })

    return { gameId: game._id, playerId }
  },
})

/**
 * Leave a game (sidecars mode only, in lobby phase)
 */
export const leave = mutation({
  args: {
    gameId: v.id('games'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const game = await ctx.db.get("games", args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (game.phase !== 'lobby') {
      throw new Error('Cannot leave after game has started')
    }

    // Find the player's seat
    const player = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId_and_userId', (q) =>
        q.eq('gameId', args.gameId).eq('userId', identity.subject),
      )
      .first()

    if (!player) {
      throw new Error('You are not in this game')
    }

    if (player.isHostSeat) {
      throw new Error('Host cannot leave. Delete the game instead.')
    }

    // Delete the player
    await ctx.db.delete("gamePlayers", player._id)

    // Re-index remaining players
    const remainingPlayers = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .collect()

    remainingPlayers.sort((a, b) => a.seatIndex - b.seatIndex)

    for (let i = 0; i < remainingPlayers.length; i++) {
      if (remainingPlayers[i].seatIndex !== i) {
        await ctx.db.patch("gamePlayers", remainingPlayers[i]._id, {
          seatIndex: i,
        })
      }
    }

    return null
  },
})

/**
 * Delete a game (host only, in lobby phase)
 */
export const deleteGame = mutation({
  args: {
    gameId: v.id('games'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const game = await ctx.db.get("games", args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (game.hostUserId !== identity.subject) {
      throw new Error('Only the host can delete the game')
    }

    if (game.phase !== 'lobby') {
      throw new Error('Cannot delete a game that has started')
    }

    // Delete all players
    const players = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .collect()

    for (const player of players) {
      await ctx.db.delete("gamePlayers", player._id)
    }

    // Delete the game
    await ctx.db.delete("games", args.gameId)

    return null
  },
})

// ===========================================
// Game Start
// ===========================================

/**
 * Start the game (host only)
 * - Materializes gameCards from playlist (ready tracks only)
 * - Shuffles the deck
 * - Deals 1 starting card to each player's timeline
 */
export const start = mutation({
  args: {
    gameId: v.id('games'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const game = await ctx.db.get("games", args.gameId)
    if (!game) {
      throw new Error('Game not found')
    }

    if (game.hostUserId !== identity.subject) {
      throw new Error('Only the host can start the game')
    }

    if (game.phase !== 'lobby') {
      throw new Error('Game has already started')
    }

    // Verify playlist is ready
    const playlist = await ctx.db.get("playlists", game.playlistId)
    if (!playlist) {
      throw new Error('Playlist not found')
    }

    if (playlist.status !== 'ready') {
      throw new Error(
        'Playlist is still processing. Please wait until all tracks are matched.',
      )
    }

    // Get all players
    const players = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .collect()

    if (players.length < 1) {
      throw new Error('Need at least 1 player to start')
    }

    // Sort by seat index
    players.sort((a, b) => a.seatIndex - b.seatIndex)

    // Get ready tracks from playlist
    const readyTracks = await ctx.db
      .query('playlistTracks')
      .withIndex('by_playlistId_and_status', (q) =>
        q.eq('playlistId', game.playlistId).eq('status', 'ready'),
      )
      .collect()

    if (readyTracks.length < players.length + 10) {
      throw new Error(
        `Playlist needs at least ${players.length + 10} ready tracks for a good game (has ${readyTracks.length})`,
      )
    }

    // Build track data with release years (filter out tracks without releaseYear)
    const trackData = readyTracks
      .filter((t) => t.releaseYear !== undefined)
      .map((t) => ({
        trackId: t._id,
        releaseYear: t.releaseYear!,
      }))

    if (trackData.length < players.length + 10) {
      throw new Error(
        `Not enough tracks with release years for a good game`,
      )
    }

    // Shuffle the tracks
    const shuffledTracks = shuffleArray(trackData)

    // Create gameCards in shuffled order
    const gameCardIds: Array<Id<'gameCards'>> = []
    for (let i = 0; i < shuffledTracks.length; i++) {
      const cardId = await ctx.db.insert('gameCards', {
        gameId: args.gameId,
        trackId: shuffledTracks[i].trackId,
        releaseYear: shuffledTracks[i].releaseYear,
        state: 'deck',
        deckOrder: i,
      })
      gameCardIds.push(cardId)
    }

    // Deal 1 starting card to each player's timeline
    for (let i = 0; i < players.length; i++) {
      const cardId = gameCardIds[i]

      // Update card state
      await ctx.db.patch("gameCards", cardId, {
        state: 'timeline',
        ownerPlayerId: players[i]._id,
        deckOrder: undefined,
      })

      // Create timeline entry
      await ctx.db.insert('timelineEntries', {
        gameId: args.gameId,
        playerId: players[i]._id,
        cardId,
        position: 0,
      })
    }

    // Update remaining deck cards' deckOrder (they shift down by players.length)
    for (let i = players.length; i < gameCardIds.length; i++) {
      await ctx.db.patch("gameCards", gameCardIds[i], {
        deckOrder: i - players.length,
      })
    }

    // Update game state
    await ctx.db.patch("games", args.gameId, {
      phase: 'awaitingStart',
      currentTurnSeatIndex: 0,
      startedAt: Date.now(),
    })

    return null
  },
})

// ===========================================
// Game Queries
// ===========================================

// Shared return type validator for game queries
const gameResponseValidator = v.object({
  _id: v.id('games'),
  hostUserId: v.string(),
  isCurrentUserHost: v.boolean(),
  joinCode: v.string(),
  mode: gameModeValidator,
  playlistId: v.id('playlists'),
  playlistName: v.optional(v.string()),
  useTokens: v.boolean(),
  startingTokens: v.number(),
  maxTokens: v.number(),
  winCondition: v.number(),
  phase: gamePhaseValidator,
  currentTurnSeatIndex: v.number(),
  endgameState: v.optional(
    v.union(
      v.object({
        type: v.literal('finalRound'),
        endsAtSeatIndex: v.number(),
      }),
      v.object({
        type: v.literal('tiebreak'),
        contenderPlayerIds: v.array(v.id('gamePlayers')),
      }),
    ),
  ),
  winnerId: v.optional(v.id('gamePlayers')),
  createdAt: v.number(),
  startedAt: v.optional(v.number()),
  finishedAt: v.optional(v.number()),
  players: v.array(
    v.object({
      _id: v.id('gamePlayers'),
      seatIndex: v.number(),
      displayName: v.string(),
      kind: v.union(v.literal('local'), v.literal('user')),
      userId: v.optional(v.string()),
      tokenBalance: v.number(),
      isHostSeat: v.boolean(),
      isCurrentUser: v.boolean(),
    }),
  ),
  currentRound: v.optional(
    v.object({
      activePlayerId: v.id('gamePlayers'),
      placementIndex: v.optional(v.number()),
      bets: v.array(
        v.object({
          bettorPlayerId: v.id('gamePlayers'),
          slotIndex: v.number(),
        }),
      ),
      card: v.optional(
        v.object({
          _id: v.id('gameCards'),
          title: v.string(),
          artistNames: v.array(v.string()),
          releaseYear: v.number(),
          imageUrl: v.optional(v.string()),
        }),
      ),
    }),
  ),
  deckRemaining: v.number(),
})

// Type for current round info
type CurrentRoundInfo = {
  activePlayerId: Id<'gamePlayers'>
  placementIndex?: number
  bets: Array<{ bettorPlayerId: Id<'gamePlayers'>; slotIndex: number }>
  card?: {
    _id: Id<'gameCards'>
    title: string
    artistNames: Array<string>
    releaseYear: number
    imageUrl?: string
  }
}

/**
 * Helper to build game response data from a game document.
 * Used by both `get` and `getByJoinCode` queries.
 */
async function buildGameResponse(
  ctx: QueryCtx,
  game: Doc<'games'>,
  identity: { subject: string },
) {
  // Get playlist name
  const playlist = await ctx.db.get('playlists', game.playlistId)

  // Get all players
  const players = await ctx.db
    .query('gamePlayers')
    .withIndex('by_gameId', (q) => q.eq('gameId', game._id))
    .collect()

  players.sort((a, b) => a.seatIndex - b.seatIndex)

  // Check if the current user is the host or a player
  const isHost = game.hostUserId === identity.subject
  const isPlayer = players.some(
    (p) => p.kind === 'user' && p.userId === identity.subject,
  )

  // For host-only mode, host can always see everything
  // For sidecars mode, need to be host or a player
  if (!isHost && !isPlayer) {
    return null
  }

  // Count remaining deck cards
  const deckCards = await ctx.db
    .query('gameCards')
    .withIndex('by_gameId_and_state', (q) =>
      q.eq('gameId', game._id).eq('state', 'deck'),
    )
    .collect()

  // Build current round info
  let currentRound: CurrentRoundInfo | undefined = undefined

  if (game.currentRound) {
    currentRound = {
      activePlayerId: game.currentRound.activePlayerId,
      placementIndex: game.currentRound.placementIndex,
      bets: game.currentRound.bets.map((b) => ({
        bettorPlayerId: b.bettorPlayerId,
        slotIndex: b.slotIndex,
      })),
    }

    // Only show card details after reveal
    if (game.phase === 'revealed') {
      const card = await ctx.db.get('gameCards', game.currentRound.cardId)
      if (card) {
        const track = await ctx.db.get('playlistTracks', card.trackId)
        if (track) {
          currentRound.card = {
            _id: card._id,
            title: track.title,
            artistNames: track.artistNames,
            releaseYear: track.releaseYear!,
            imageUrl: track.imageUrl,
          }
        }
      }
    }
  }

  return {
    _id: game._id,
    hostUserId: game.hostUserId,
    isCurrentUserHost: isHost,
    joinCode: game.joinCode,
    mode: game.mode,
    playlistId: game.playlistId,
    playlistName: playlist?.name,
    useTokens: game.useTokens,
    startingTokens: game.startingTokens,
    maxTokens: game.maxTokens,
    winCondition: game.winCondition,
    phase: game.phase,
    currentTurnSeatIndex: game.currentTurnSeatIndex,
    endgameState: game.endgameState,
    winnerId: game.winnerId,
    createdAt: game.createdAt,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
    players: players.map((p) => ({
      _id: p._id,
      seatIndex: p.seatIndex,
      displayName: p.displayName,
      kind: p.kind,
      userId: p.userId,
      tokenBalance: p.tokenBalance,
      isHostSeat: p.isHostSeat,
      isCurrentUser: p.kind === 'user' && p.userId === identity.subject,
    })),
    currentRound,
    deckRemaining: deckCards.length,
  }
}

/**
 * Get game by join code (for players in the game)
 */
export const getByJoinCode = query({
  args: { joinCode: v.string() },
  returns: v.union(gameResponseValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    // Find game by join code
    const game = await ctx.db
      .query('games')
      .withIndex('by_joinCode', (q) =>
        q.eq('joinCode', args.joinCode.toUpperCase()),
      )
      .first()

    if (!game) {
      return null
    }

    return buildGameResponse(ctx, game, identity)
  },
})

/**
 * Get game by ID (for players in the game)
 */
export const get = query({
  args: { gameId: v.id('games') },
  returns: v.union(gameResponseValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const game = await ctx.db.get('games', args.gameId)
    if (!game) {
      return null
    }

    return buildGameResponse(ctx, game, identity)
  },
})

/**
 * List games the current user is host of or participating in
 */
export const listMine = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('games'),
      joinCode: v.string(),
      mode: gameModeValidator,
      phase: gamePhaseValidator,
      playlistName: v.optional(v.string()),
      playerCount: v.number(),
      createdAt: v.number(),
      isHost: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    // Get games where user is host
    const hostedGames = await ctx.db
      .query('games')
      .withIndex('by_hostUserId', (q) => q.eq('hostUserId', identity.subject))
      .collect()

    // Get games where user is a player (but not host)
    const playerSeats = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId_and_userId')
      .filter((q) => q.eq(q.field('userId'), identity.subject))
      .collect()

    const joinedGameIds = new Set(playerSeats.map((p) => p.gameId))

    const result: Array<{
      _id: Id<'games'>
      joinCode: string
      mode: 'hostOnly' | 'sidecars'
      phase: Doc<'games'>['phase']
      playlistName?: string
      playerCount: number
      createdAt: number
      isHost: boolean
    }> = []

    // Add hosted games
    for (const game of hostedGames) {
      const playlist = await ctx.db.get("playlists", game.playlistId)
      const players = await ctx.db
        .query('gamePlayers')
        .withIndex('by_gameId', (q) => q.eq('gameId', game._id))
        .collect()

      result.push({
        _id: game._id,
        joinCode: game.joinCode,
        mode: game.mode,
        phase: game.phase,
        playlistName: playlist?.name,
        playerCount: players.length,
        createdAt: game.createdAt,
        isHost: true,
      })

      joinedGameIds.delete(game._id) // Remove from joined set to avoid duplicates
    }

    // Add joined games (where not host)
    for (const gameId of joinedGameIds) {
      const game = await ctx.db.get("games", gameId)
      if (!game) continue

      const playlist = await ctx.db.get("playlists", game.playlistId)
      const players = await ctx.db
        .query('gamePlayers')
        .withIndex('by_gameId', (q) => q.eq('gameId', game._id))
        .collect()

      result.push({
        _id: game._id,
        joinCode: game.joinCode,
        mode: game.mode,
        phase: game.phase,
        playlistName: playlist?.name,
        playerCount: players.length,
        createdAt: game.createdAt,
        isHost: false,
      })
    }

    // Sort by creation date (newest first)
    result.sort((a, b) => b.createdAt - a.createdAt)

    return result
  },
})
