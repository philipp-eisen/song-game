import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Game phases for the state machine
const gamePhaseValidator = v.union(
  v.literal('lobby'),
  v.literal('awaitingStart'),
  v.literal('awaitingPlacement'),
  v.literal('awaitingReveal'),
  v.literal('revealed'),
  v.literal('finished'),
)

// Game modes
const gameModeValidator = v.union(v.literal('hostOnly'), v.literal('sidecars'))

// Card states in the deck
const cardStateValidator = v.union(
  v.literal('deck'), // In the draw pile
  v.literal('inRound'), // Currently being played this round
  v.literal('timeline'), // Placed in a player's timeline
  v.literal('discarded'), // Removed from play
)

// Player seat types
const playerKindValidator = v.union(
  v.literal('local'), // Host-controlled local seat
  v.literal('user'), // Authenticated user (Spotify or guest)
)

// Bet record for current round
const betValidator = v.object({
  bettorPlayerId: v.id('gamePlayers'),
  slotIndex: v.number(), // Where the bettor thinks the card should go
  timestamp: v.number(), // For resolving ties (earliest wins)
})

// Current round state stored on the game
const currentRoundValidator = v.object({
  cardId: v.id('gameCards'),
  activePlayerId: v.id('gamePlayers'),
  placementIndex: v.optional(v.number()), // Where the active player placed the card
  bets: v.array(betValidator),
  tokenClaimers: v.array(v.id('gamePlayers')), // Players who claimed a guess token this round
})

export default defineSchema({
  // ============================================
  // Spotify Playlist Import Tables
  // ============================================

  // Imported Spotify playlists owned by authenticated users
  spotifyPlaylists: defineTable({
    ownerUserId: v.string(), // Better Auth user ID
    spotifyPlaylistId: v.string(), // Spotify's playlist ID
    name: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    trackCount: v.number(),
    snapshotId: v.string(), // Spotify's version identifier
    importedAt: v.number(), // Timestamp
  })
    .index('by_ownerUserId', ['ownerUserId'])
    .index('by_ownerUserId_and_spotifyPlaylistId', [
      'ownerUserId',
      'spotifyPlaylistId',
    ]),

  // Unique Spotify tracks (deduplicated across playlists)
  songs: defineTable({
    spotifyTrackId: v.string(),
    title: v.string(),
    artistNames: v.array(v.string()),
    releaseYear: v.number(),
    previewUrl: v.optional(v.string()), // 30s preview if available
    spotifyUri: v.optional(v.string()), // spotify:track:xxx
    albumName: v.optional(v.string()),
    albumImageUrl: v.optional(v.string()),
  }).index('by_spotifyTrackId', ['spotifyTrackId']),

  // Many-to-many: playlist → songs with ordering
  playlistSongs: defineTable({
    playlistId: v.id('spotifyPlaylists'),
    songId: v.id('songs'),
    position: v.number(), // Order in the playlist
  })
    .index('by_playlistId', ['playlistId'])
    .index('by_playlistId_and_position', ['playlistId', 'position'])
    .index('by_playlistId_and_songId', ['playlistId', 'songId']),

  // ============================================
  // Game Engine Tables
  // ============================================

  // Game sessions (lobby + in-progress)
  games: defineTable({
    // Ownership
    hostUserId: v.string(), // Better Auth user ID of the host

    // Game configuration
    joinCode: v.string(), // 6-char code for joining
    mode: gameModeValidator,
    playlistId: v.id('spotifyPlaylists'),

    // Game options
    useTokens: v.boolean(), // Whether HITSTER tokens are enabled
    startingTokens: v.number(), // Tokens each player starts with (default 2)
    maxTokens: v.number(), // Max tokens a player can hold (default 5)
    winCondition: v.number(), // Timeline cards needed to win (default 10)

    // Game state
    phase: gamePhaseValidator,
    currentTurnSeatIndex: v.number(), // Which seat is active (0-indexed)
    currentRound: v.optional(currentRoundValidator),
    winnerId: v.optional(v.id('gamePlayers')), // Set when game is finished

    // Metadata
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index('by_joinCode', ['joinCode'])
    .index('by_hostUserId', ['hostUserId'])
    .index('by_hostUserId_and_phase', ['hostUserId', 'phase']),

  // Player seats in a game
  gamePlayers: defineTable({
    gameId: v.id('games'),
    seatIndex: v.number(), // 0-indexed seat position (turn order)
    displayName: v.string(),
    kind: playerKindValidator,
    userId: v.optional(v.string()), // Better Auth user ID (for kind: "user")
    tokenBalance: v.number(),
    isHostSeat: v.boolean(), // First seat is always the host's
  })
    .index('by_gameId', ['gameId'])
    .index('by_gameId_and_seatIndex', ['gameId', 'seatIndex'])
    .index('by_gameId_and_userId', ['gameId', 'userId']),

  // Card instances for a game (materialized from playlist songs)
  gameCards: defineTable({
    gameId: v.id('games'),
    songId: v.id('songs'),
    releaseYear: v.number(), // Denormalized for fast validation
    state: cardStateValidator,
    ownerPlayerId: v.optional(v.id('gamePlayers')), // Set when in timeline
    deckOrder: v.optional(v.number()), // Order in draw pile (for deterministic shuffling)
  })
    .index('by_gameId', ['gameId'])
    .index('by_gameId_and_state', ['gameId', 'state'])
    .index('by_gameId_and_ownerPlayerId', ['gameId', 'ownerPlayerId']),

  // Timeline entries: ordered cards in a player's timeline
  timelineEntries: defineTable({
    gameId: v.id('games'),
    playerId: v.id('gamePlayers'),
    cardId: v.id('gameCards'),
    position: v.number(), // 0-indexed position in the timeline
  })
    .index('by_playerId', ['playerId'])
    .index('by_playerId_and_position', ['playerId', 'position'])
    .index('by_cardId', ['cardId']),
})
