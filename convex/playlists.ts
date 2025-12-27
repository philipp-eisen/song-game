import { v } from 'convex/values'
import { query } from './_generated/server'

/**
 * List all playlists owned by the current user
 */
export const listMine = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('spotifyPlaylists'),
      spotifyPlaylistId: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      trackCount: v.number(),
      importedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const playlists = await ctx.db
      .query('spotifyPlaylists')
      .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', identity.subject))
      .collect()

    return playlists.map((p) => ({
      _id: p._id,
      spotifyPlaylistId: p.spotifyPlaylistId,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      trackCount: p.trackCount,
      importedAt: p.importedAt,
    }))
  },
})

/**
 * Get a specific playlist by ID (includes song list)
 */
export const get = query({
  args: { playlistId: v.id('spotifyPlaylists') },
  returns: v.union(
    v.object({
      _id: v.id('spotifyPlaylists'),
      name: v.string(),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      trackCount: v.number(),
      songs: v.array(
        v.object({
          _id: v.id('songs'),
          title: v.string(),
          artistNames: v.array(v.string()),
          releaseYear: v.number(),
          albumName: v.optional(v.string()),
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

    const playlist = await ctx.db.get("spotifyPlaylists", args.playlistId)
    if (!playlist || playlist.ownerUserId !== identity.subject) {
      return null
    }

    // Get all songs in order
    const playlistSongs = await ctx.db
      .query('playlistSongs')
      .withIndex('by_playlistId_and_position', (q) => q.eq('playlistId', args.playlistId))
      .collect()

    // Sort by position (in case index doesn't guarantee order)
    playlistSongs.sort((a, b) => a.position - b.position)

    // Fetch song details
    const songs: Array<{
      _id: typeof playlistSongs[0]['songId']
      title: string
      artistNames: Array<string>
      releaseYear: number
      albumName?: string
      albumImageUrl?: string
    }> = []

    for (const ps of playlistSongs) {
      const song = await ctx.db.get("songs", ps.songId)
      if (song) {
        songs.push({
          _id: song._id,
          title: song.title,
          artistNames: song.artistNames,
          releaseYear: song.releaseYear,
          albumName: song.albumName,
          albumImageUrl: song.albumImageUrl,
        })
      }
    }

    return {
      _id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      imageUrl: playlist.imageUrl,
      trackCount: playlist.trackCount,
      songs,
    }
  },
})

