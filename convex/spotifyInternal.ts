import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'
import { components } from './_generated/api'
import type { Id } from './_generated/dataModel'

// ===========================================
// Internal queries/mutations for Spotify Import
// ===========================================

/**
 * Get the Spotify account for a user (to retrieve access token for importing)
 */
export const getSpotifyAccount = internalQuery({
  args: { userId: v.string() },
  returns: v.union(
    v.object({
      accessToken: v.union(v.string(), v.null()),
      refreshToken: v.union(v.string(), v.null()),
      accessTokenExpiresAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // Query the Better Auth account table for the Spotify provider
    const result = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'account',
      where: [
        { field: 'userId', value: args.userId },
        { field: 'providerId', value: 'spotify' },
      ],
    })

    if (!result) {
      return null
    }

    return {
      accessToken: result.accessToken ?? null,
      refreshToken: result.refreshToken ?? null,
      accessTokenExpiresAt: result.accessTokenExpiresAt ?? null,
    }
  },
})

/**
 * Update the Spotify account tokens after a refresh
 */
export const updateSpotifyTokens = internalMutation({
  args: {
    userId: v.string(),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
    refreshToken: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find the account first
    const result = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'account',
      where: [
        { field: 'userId', value: args.userId },
        { field: 'providerId', value: 'spotify' },
      ],
    })

    if (!result || !result._id) {
      throw new Error('Spotify account not found')
    }

    // Update using the Better Auth component
    const updateData: Record<string, unknown> = {
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      updatedAt: Date.now(),
    }

    if (args.refreshToken) {
      updateData.refreshToken = args.refreshToken
    }

    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'account',
        update: updateData,
        where: [{ field: '_id', value: result._id }],
      },
    })

    return null
  },
})

/**
 * Upsert a playlist and replace all its tracks with new ones.
 * Tracks start in 'pending' status for Apple Music matching.
 */
export const upsertPlaylistWithTracks = internalMutation({
  args: {
    ownerUserId: v.string(),
    source: v.union(v.literal('spotify'), v.literal('appleMusic')),
    sourcePlaylistId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    tracks: v.array(
      v.object({
        position: v.number(),
        title: v.string(),
        artistNames: v.array(v.string()),
        releaseYear: v.optional(v.number()),
        imageUrl: v.optional(v.string()),
        spotifyTrackId: v.optional(v.string()),
        isrc: v.optional(v.string()),
        // For Apple Music imports that are ready immediately
        appleMusicId: v.optional(v.string()),
        previewUrl: v.optional(v.string()),
      }),
    ),
  },
  returns: v.id('playlists'),
  handler: async (ctx, args) => {
    const now = Date.now()

    // Check if playlist already exists for this user
    const existing = await ctx.db
      .query('playlists')
      .withIndex('by_ownerUserId_and_sourcePlaylistId', (q) =>
        q
          .eq('ownerUserId', args.ownerUserId)
          .eq('sourcePlaylistId', args.sourcePlaylistId),
      )
      .unique()

    let playlistId: Id<'playlists'>

    if (existing) {
      playlistId = existing._id

      // Delete all existing tracks
      const existingTracks = await ctx.db
        .query('playlistTracks')
        .withIndex('by_playlistId', (q) => q.eq('playlistId', playlistId))
        .collect()

      for (const track of existingTracks) {
        await ctx.db.delete("playlistTracks", track._id)
      }

      // Update playlist metadata
      await ctx.db.patch("playlists", playlistId, {
        name: args.name,
        description: args.description,
        imageUrl: args.imageUrl,
        importedAt: now,
        status: args.source === 'appleMusic' ? 'ready' : 'processing',
        totalTracks: args.tracks.length,
        readyTracks: 0,
        unmatchedTracks: 0,
      })
    } else {
      // Create new playlist
      playlistId = await ctx.db.insert('playlists', {
        ownerUserId: args.ownerUserId,
        source: args.source,
        sourcePlaylistId: args.sourcePlaylistId,
        name: args.name,
        description: args.description,
        imageUrl: args.imageUrl,
        importedAt: now,
        status: args.source === 'appleMusic' ? 'ready' : 'processing',
        totalTracks: args.tracks.length,
        readyTracks: 0,
        unmatchedTracks: 0,
      })
    }

    // Insert all tracks
    for (const track of args.tracks) {
      // Apple Music imports are ready immediately, Spotify imports are pending
      const isReady =
        args.source === 'appleMusic' ||
        (track.appleMusicId && track.previewUrl && track.releaseYear)

      await ctx.db.insert('playlistTracks', {
        playlistId,
        position: track.position,
        status: isReady ? 'ready' : 'pending',
        title: track.title,
        artistNames: track.artistNames,
        releaseYear: track.releaseYear,
        imageUrl: track.imageUrl,
        spotifyTrackId: track.spotifyTrackId,
        isrc: track.isrc,
        appleMusicId: track.appleMusicId,
        previewUrl: track.previewUrl,
      })
    }

    // If Apple Music import, update readyTracks count
    if (args.source === 'appleMusic') {
      await ctx.db.patch("playlists", playlistId, {
        readyTracks: args.tracks.length,
      })
    }

    return playlistId
  },
})
