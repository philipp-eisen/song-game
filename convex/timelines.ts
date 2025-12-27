import { v } from 'convex/values'
import { query } from './_generated/server'
import type { Id } from './_generated/dataModel'

// ===========================================
// Timeline Queries
// ===========================================

/**
 * Get a single player's timeline with card details
 */
export const getPlayerTimeline = query({
  args: {
    playerId: v.id('gamePlayers'),
  },
  returns: v.union(
    v.object({
      playerId: v.id('gamePlayers'),
      displayName: v.string(),
      cards: v.array(
        v.object({
          _id: v.id('gameCards'),
          position: v.number(),
          title: v.string(),
          artistNames: v.array(v.string()),
          releaseYear: v.number(),
          albumImageUrl: v.optional(v.string()),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const player = await ctx.db.get("gamePlayers", args.playerId)
    if (!player) {
      return null
    }

    // Verify access to this game
    const game = await ctx.db.get("games", player.gameId)
    if (!game) {
      return null
    }

    const isHost = game.hostUserId === identity.subject
    const isPlayer =
      player.kind === 'user' && player.userId === identity.subject

    // Check if caller is in this game
    if (!isHost && !isPlayer) {
      const callerSeat = await ctx.db
        .query('gamePlayers')
        .withIndex('by_gameId_and_userId', (q) =>
          q.eq('gameId', player.gameId).eq('userId', identity.subject),
        )
        .first()

      if (!callerSeat) {
        return null
      }
    }

    // Get timeline entries
    const entries = await ctx.db
      .query('timelineEntries')
      .withIndex('by_playerId', (q) => q.eq('playerId', args.playerId))
      .collect()

    entries.sort((a, b) => a.position - b.position)

    // Fetch card and song details
    const cards: Array<{
      _id: Id<'gameCards'>
      position: number
      title: string
      artistNames: Array<string>
      releaseYear: number
      albumImageUrl?: string
    }> = []

    for (const entry of entries) {
      const card = await ctx.db.get("gameCards", entry.cardId)
      if (!card) continue

      const song = await ctx.db.get("songs", card.songId)
      if (!song) continue

      cards.push({
        _id: card._id,
        position: entry.position,
        title: song.title,
        artistNames: song.artistNames,
        releaseYear: song.releaseYear,
        albumImageUrl: song.albumImageUrl,
      })
    }

    return {
      playerId: player._id,
      displayName: player.displayName,
      cards,
    }
  },
})

/**
 * Get all player timelines for a game
 */
export const getAllTimelines = query({
  args: {
    gameId: v.id('games'),
  },
  returns: v.union(
    v.array(
      v.object({
        playerId: v.id('gamePlayers'),
        displayName: v.string(),
        seatIndex: v.number(),
        tokenBalance: v.number(),
        isCurrentUser: v.boolean(),
        cards: v.array(
          v.object({
            _id: v.id('gameCards'),
            position: v.number(),
            title: v.string(),
            artistNames: v.array(v.string()),
            releaseYear: v.number(),
            albumImageUrl: v.optional(v.string()),
          }),
        ),
      }),
    ),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const game = await ctx.db.get("games", args.gameId)
    if (!game) {
      return null
    }

    // Verify access
    const isHost = game.hostUserId === identity.subject
    let isPlayer = false

    const allPlayers = await ctx.db
      .query('gamePlayers')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .collect()

    for (const p of allPlayers) {
      if (p.kind === 'user' && p.userId === identity.subject) {
        isPlayer = true
        break
      }
    }

    if (!isHost && !isPlayer) {
      return null
    }

    // Sort players by seat index
    allPlayers.sort((a, b) => a.seatIndex - b.seatIndex)

    const result: Array<{
      playerId: Id<'gamePlayers'>
      displayName: string
      seatIndex: number
      tokenBalance: number
      isCurrentUser: boolean
      cards: Array<{
        _id: Id<'gameCards'>
        position: number
        title: string
        artistNames: Array<string>
        releaseYear: number
        albumImageUrl?: string
      }>
    }> = []

    for (const player of allPlayers) {
      // Get timeline entries
      const entries = await ctx.db
        .query('timelineEntries')
        .withIndex('by_playerId', (q) => q.eq('playerId', player._id))
        .collect()

      entries.sort((a, b) => a.position - b.position)

      // Fetch card and song details
      const cards: Array<{
        _id: Id<'gameCards'>
        position: number
        title: string
        artistNames: Array<string>
        releaseYear: number
        albumImageUrl?: string
      }> = []

      for (const entry of entries) {
        const card = await ctx.db.get("gameCards", entry.cardId)
        if (!card) continue

        const song = await ctx.db.get("songs", card.songId)
        if (!song) continue

        cards.push({
          _id: card._id,
          position: entry.position,
          title: song.title,
          artistNames: song.artistNames,
          releaseYear: song.releaseYear,
          albumImageUrl: song.albumImageUrl,
        })
      }

      result.push({
        playerId: player._id,
        displayName: player.displayName,
        seatIndex: player.seatIndex,
        tokenBalance: player.tokenBalance,
        isCurrentUser: player.kind === 'user' && player.userId === identity.subject,
        cards,
      })
    }

    return result
  },
})

/**
 * Get the current round's song preview for playback
 * Available during awaitingPlacement, awaitingReveal phases (for active player to listen)
 * Does NOT reveal title/artist/year until revealed phase
 */
export const getCurrentRoundSongPreview = query({
  args: {
    gameId: v.id('games'),
  },
  returns: v.union(
    v.object({
      previewUrl: v.optional(v.string()),
      spotifyUri: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const game = await ctx.db.get("games", args.gameId)
    if (!game) {
      return null
    }

    // Available during placement and reveal phases
    if (game.phase !== 'awaitingPlacement' && game.phase !== 'awaitingReveal' && game.phase !== 'revealed') {
      return null
    }

    if (!game.currentRound) {
      return null
    }

    // Verify access
    const isHost = game.hostUserId === identity.subject
    if (!isHost) {
      const playerSeat = await ctx.db
        .query('gamePlayers')
        .withIndex('by_gameId_and_userId', (q) =>
          q.eq('gameId', args.gameId).eq('userId', identity.subject),
        )
        .first()

      if (!playerSeat) {
        return null
      }
    }

    const card = await ctx.db.get("gameCards", game.currentRound.cardId)
    if (!card) {
      return null
    }

    const song = await ctx.db.get("songs", card.songId)
    if (!song) {
      return null
    }

    return {
      previewUrl: song.previewUrl,
      spotifyUri: song.spotifyUri,
    }
  },
})

/**
 * Get the current round's card info (only available after reveal)
 */
export const getCurrentRoundCard = query({
  args: {
    gameId: v.id('games'),
  },
  returns: v.union(
    v.object({
      _id: v.id('gameCards'),
      title: v.string(),
      artistNames: v.array(v.string()),
      releaseYear: v.number(),
      albumName: v.optional(v.string()),
      albumImageUrl: v.optional(v.string()),
      previewUrl: v.optional(v.string()),
      spotifyUri: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const game = await ctx.db.get("games", args.gameId)
    if (!game) {
      return null
    }

    // Only show card after reveal
    if (game.phase !== 'revealed') {
      return null
    }

    if (!game.currentRound) {
      return null
    }

    // Verify access
    const isHost = game.hostUserId === identity.subject
    if (!isHost) {
      const playerSeat = await ctx.db
        .query('gamePlayers')
        .withIndex('by_gameId_and_userId', (q) =>
          q.eq('gameId', args.gameId).eq('userId', identity.subject),
        )
        .first()

      if (!playerSeat) {
        return null
      }
    }

    const card = await ctx.db.get("gameCards", game.currentRound.cardId)
    if (!card) {
      return null
    }

    const song = await ctx.db.get("songs", card.songId)
    if (!song) {
      return null
    }

    return {
      _id: card._id,
      title: song.title,
      artistNames: song.artistNames,
      releaseYear: song.releaseYear,
      albumName: song.albumName,
      albumImageUrl: song.albumImageUrl,
      previewUrl: song.previewUrl,
      spotifyUri: song.spotifyUri,
    }
  },
})

