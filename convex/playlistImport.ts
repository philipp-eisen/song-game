'use node'

import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'

// ===========================================
// Constants
// ===========================================

const BATCH_SIZE = 10 // Process 10 tracks at a time
const RATE_LIMIT_DELAY_MS = 100 // Delay between Apple Music API calls

// ===========================================
// Apple Music Resolution Action
// ===========================================

/**
 * Resolve a single track to Apple Music
 * Attempts ISRC lookup first, then falls back to text search
 */
export const resolveTrackToAppleMusic = internalAction({
  args: {
    trackId: v.id('playlistTracks'),
    isrc: v.optional(v.string()),
    title: v.string(),
    artist: v.string(),
    storefront: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      matched: v.literal(true),
      appleMusicId: v.string(),
      title: v.string(),
      artistName: v.string(),
      albumName: v.string(),
      releaseYear: v.number(),
      releaseDate: v.optional(v.string()),
      previewUrl: v.optional(v.string()),
      artworkUrl: v.optional(v.string()),
      isrc: v.optional(v.string()),
    }),
    v.object({
      matched: v.literal(false),
      reason: v.string(),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        matched: true
        appleMusicId: string
        title: string
        artistName: string
        albumName: string
        releaseYear: number
        releaseDate?: string
        previewUrl?: string
        artworkUrl?: string
        isrc?: string
      }
    | { matched: false; reason: string }
  > => {
    const storefront = args.storefront ?? 'us'

    // Step 1: Try ISRC lookup (most reliable)
    if (args.isrc) {
      try {
        const isrcResult = await ctx.runAction(
          internal.appleMusic.searchByISRC,
          {
            isrc: args.isrc,
            storefront,
          },
        )

        if (isrcResult) {
          return {
            matched: true,
            appleMusicId: isrcResult.appleMusicId,
            title: isrcResult.title,
            artistName: isrcResult.artistName,
            albumName: isrcResult.albumName,
            releaseYear: isrcResult.releaseYear,
            releaseDate: isrcResult.releaseDate,
            previewUrl: isrcResult.previewUrl,
            artworkUrl: isrcResult.artworkUrl,
            isrc: isrcResult.isrc,
          }
        }
      } catch (error) {
        console.warn(
          '[Resolution] ISRC lookup failed, trying text search:',
          error,
        )
      }
    }

    // Step 2: Fall back to text search
    try {
      const searchQuery = `${args.title} ${args.artist}`
      const searchResults = await ctx.runAction(
        internal.appleMusic.searchCatalog,
        {
          query: searchQuery,
          storefront,
          limit: 5,
        },
      )

      if (searchResults.length === 0) {
        return { matched: false, reason: 'No results found' }
      }

      // Find the best match by comparing title and artist
      const normalizedTitle = normalizeString(args.title)
      const normalizedArtist = normalizeString(args.artist)

      for (const result of searchResults) {
        const resultTitle = normalizeString(result.title)
        const resultArtist = normalizeString(result.artistName)

        // Check if title and artist are similar enough
        if (
          stringsSimilar(normalizedTitle, resultTitle) &&
          stringsSimilar(normalizedArtist, resultArtist)
        ) {
          return {
            matched: true,
            appleMusicId: result.appleMusicId,
            title: result.title,
            artistName: result.artistName,
            albumName: result.albumName,
            releaseYear: result.releaseYear,
            releaseDate: result.releaseDate,
            previewUrl: result.previewUrl,
            artworkUrl: result.artworkUrl,
            isrc: result.isrc,
          }
        }
      }

      // If no exact match, take the first result as a best guess
      const firstResult = searchResults[0]
      return {
        matched: true,
        appleMusicId: firstResult.appleMusicId,
        title: firstResult.title,
        artistName: firstResult.artistName,
        albumName: firstResult.albumName,
        releaseYear: firstResult.releaseYear,
        releaseDate: firstResult.releaseDate,
        previewUrl: firstResult.previewUrl,
        artworkUrl: firstResult.artworkUrl,
        isrc: firstResult.isrc,
      }
    } catch (error) {
      console.error('[Resolution] Text search failed:', error)
      return { matched: false, reason: 'Search failed' }
    }
  },
})

// ===========================================
// Batch Processing Action
// ===========================================

/**
 * Process a batch of pending tracks for a playlist.
 * Re-schedules itself if there are more pending tracks.
 */
export const processPlaylistBatch = internalAction({
  args: {
    playlistId: v.id('playlists'),
    storefront: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const storefront = args.storefront ?? 'us'

    // Get a batch of pending tracks
    const pendingTracks = await ctx.runQuery(
      internal.playlistImportInternal.getPendingTracks,
      {
        playlistId: args.playlistId,
        limit: BATCH_SIZE,
      },
    )

    if (pendingTracks.length === 0) {
      // No more pending tracks, update final status
      await ctx.runMutation(
        internal.playlistImportInternal.updatePlaylistCounts,
        {
          playlistId: args.playlistId,
        },
      )
      console.log(`[Processing] Playlist ${args.playlistId} complete`)
      return null
    }

    console.log(
      `[Processing] Processing ${pendingTracks.length} tracks for playlist ${args.playlistId}`,
    )

    // Process each track in the batch
    for (const track of pendingTracks) {
      const result = await ctx.runAction(
        internal.playlistImport.resolveTrackToAppleMusic,
        {
          trackId: track._id,
          isrc: track.isrc,
          title: track.title,
          artist: track.artistNames[0] ?? 'Unknown Artist',
          storefront,
        },
      )

      if (result.matched) {
        await ctx.runMutation(internal.playlistImportInternal.markTrackReady, {
          trackId: track._id,
          appleMusicId: result.appleMusicId,
          title: result.title,
          artistNames: [result.artistName],
          releaseYear: result.releaseYear,
          previewUrl: result.previewUrl,
          imageUrl: result.artworkUrl,
          isrc: result.isrc,
        })
      } else {
        await ctx.runMutation(
          internal.playlistImportInternal.markTrackUnmatched,
          {
            trackId: track._id,
            reason: result.reason,
          },
        )
        console.warn(
          `[Processing] Failed to match: "${track.title}" by ${track.artistNames.join(', ')} - ${result.reason}`,
        )
      }

      // Rate limit delay
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS))
    }

    // Update counts after processing this batch
    const counts = await ctx.runMutation(
      internal.playlistImportInternal.updatePlaylistCounts,
      {
        playlistId: args.playlistId,
      },
    )

    // If there are more pending tracks, schedule the next batch
    if (counts.pendingCount > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.playlistImport.processPlaylistBatch,
        {
          playlistId: args.playlistId,
          storefront,
        },
      )
    } else {
      console.log(`[Processing] Playlist ${args.playlistId} complete`)
    }

    return null
  },
})

// ===========================================
// Helper Functions
// ===========================================

/**
 * Normalize a string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Check if two strings are similar enough (simple comparison)
 */
function stringsSimilar(a: string, b: string): boolean {
  // Exact match
  if (a === b) return true

  // One contains the other
  if (a.includes(b) || b.includes(a)) return true

  // Check if at least 80% of words match
  const wordsA = new Set(a.split(' '))
  const wordsB = new Set(b.split(' '))
  const intersection = [...wordsA].filter((w) => wordsB.has(w))
  const matchRatio = intersection.length / Math.max(wordsA.size, wordsB.size)

  return matchRatio >= 0.8
}
