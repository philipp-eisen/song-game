import { v } from 'convex/values'
import { query } from './_generated/server'

/**
 * List all playlists owned by the current user
 * Includes processing status and track counts
 */
export const listMine = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('playlists'),
      source: v.union(v.literal('spotify'), v.literal('appleMusic')),
      sourcePlaylistId: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      importedAt: v.number(),
      // Processing status
      status: v.union(
        v.literal('importing'),
        v.literal('processing'),
        v.literal('ready'),
        v.literal('failed'),
      ),
      totalTracks: v.number(),
      readyTracks: v.number(),
      unmatchedTracks: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const playlists = await ctx.db
      .query('playlists')
      .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', identity.subject))
      .collect()

    return playlists.map((p) => ({
      _id: p._id,
      source: p.source,
      sourcePlaylistId: p.sourcePlaylistId,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      importedAt: p.importedAt,
      status: p.status,
      totalTracks: p.totalTracks,
      readyTracks: p.readyTracks,
      unmatchedTracks: p.unmatchedTracks,
    }))
  },
})

/**
 * Get a specific playlist by ID with its tracks
 * Returns only 'ready' tracks by default for the playable view
 */
export const get = query({
  args: {
    playlistId: v.id('playlists'),
    includeAllTracks: v.optional(v.boolean()), // Include pending/unmatched for debugging
  },
  returns: v.union(
    v.object({
      _id: v.id('playlists'),
      source: v.union(v.literal('spotify'), v.literal('appleMusic')),
      name: v.string(),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      status: v.union(
        v.literal('importing'),
        v.literal('processing'),
        v.literal('ready'),
        v.literal('failed'),
      ),
      totalTracks: v.number(),
      readyTracks: v.number(),
      unmatchedTracks: v.number(),
      tracks: v.array(
        v.object({
          _id: v.id('playlistTracks'),
          position: v.number(),
          status: v.union(
            v.literal('pending'),
            v.literal('ready'),
            v.literal('unmatched'),
          ),
          title: v.string(),
          artistNames: v.array(v.string()),
          releaseYear: v.optional(v.number()),
          previewUrl: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
          spotifyTrackId: v.optional(v.string()),
          unmatchedReason: v.optional(v.string()),
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

    const playlist = await ctx.db.get("playlists", args.playlistId)
    if (!playlist || playlist.ownerUserId !== identity.subject) {
      return null
    }

    // Get tracks in order
    const allTracks = await ctx.db
      .query('playlistTracks')
      .withIndex('by_playlistId_and_position', (q) =>
        q.eq('playlistId', args.playlistId),
      )
      .collect()

    // Sort by position (in case index doesn't guarantee order)
    allTracks.sort((a, b) => a.position - b.position)

    // Filter to ready tracks unless includeAllTracks is true
    const tracks = args.includeAllTracks
      ? allTracks
      : allTracks.filter((t) => t.status === 'ready')

    return {
      _id: playlist._id,
      source: playlist.source,
      name: playlist.name,
      description: playlist.description,
      imageUrl: playlist.imageUrl,
      status: playlist.status,
      totalTracks: playlist.totalTracks,
      readyTracks: playlist.readyTracks,
      unmatchedTracks: playlist.unmatchedTracks,
      tracks: tracks.map((t) => ({
        _id: t._id,
        position: t.position,
        status: t.status,
        title: t.title,
        artistNames: t.artistNames,
        releaseYear: t.releaseYear,
        previewUrl: t.previewUrl,
        imageUrl: t.imageUrl,
        spotifyTrackId: t.spotifyTrackId,
        unmatchedReason: t.unmatchedReason,
      })),
    }
  },
})
