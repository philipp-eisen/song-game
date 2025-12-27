'use node'

import { SpotifyApi } from '@spotify/web-api-ts-sdk'
import { v } from 'convex/values'
import { action } from './_generated/server'
import { internal } from './_generated/api'
import type { AccessToken, PlaylistedTrack } from '@spotify/web-api-ts-sdk'
import type { Id } from './_generated/dataModel'

// ===========================================
// Helper functions
// ===========================================

/**
 * Extract release year from Spotify's release_date string
 * Handles: "YYYY", "YYYY-MM", "YYYY-MM-DD"
 */
function extractReleaseYear(releaseDate: string): number {
  const year = parseInt(releaseDate.substring(0, 4), 10)
  return isNaN(year) ? 2000 : year // Fallback to 2000 if parsing fails
}

/**
 * Parse a Spotify playlist URL/ID to extract just the playlist ID
 * Handles:
 * - "spotify:playlist:xxxxx"
 * - "https://open.spotify.com/playlist/xxxxx"
 * - "https://open.spotify.com/playlist/xxxxx?si=yyyyy"
 * - "xxxxx" (raw ID)
 */
function parseSpotifyPlaylistId(input: string): string {
  // URI format
  if (input.startsWith('spotify:playlist:')) {
    return input.replace('spotify:playlist:', '')
  }

  // URL format
  const urlMatch = input.match(/playlist\/([a-zA-Z0-9]+)/)
  if (urlMatch) {
    return urlMatch[1]
  }

  // Assume it's already just the ID
  return input
}

/**
 * Refresh Spotify access token using the refresh token
 */
async function refreshSpotifyToken(refreshToken: string): Promise<AccessToken> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify client credentials in environment')
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to refresh Spotify token: ${response.status} ${errorText}`,
    )
  }

  const data = await response.json()

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token ?? refreshToken,
  }
}

/**
 * Create an authenticated Spotify SDK instance using an access token
 */
function createSpotifySdk(accessToken: string): SpotifyApi {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  if (!clientId) {
    throw new Error('Missing SPOTIFY_CLIENT_ID environment variable')
  }

  // Create SDK with the existing access token
  return SpotifyApi.withAccessToken(clientId, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600, // We handle refresh separately
    refresh_token: '', // Not needed for API calls
  })
}

/**
 * Fetch all tracks from a playlist (handles pagination)
 */
async function fetchAllPlaylistTracks(
  sdk: SpotifyApi,
  playlistId: string,
): Promise<Array<PlaylistedTrack>> {
  const tracks: Array<PlaylistedTrack> = []
  let offset = 0
  const limit = 50 // Max allowed by Spotify API

  let hasMore = true
  while (hasMore) {
    const page = await sdk.playlists.getPlaylistItems(
      playlistId,
      undefined, // market
      'items(track(id,name,artists(name),album(name,release_date,images),preview_url,uri)),next,total',
      limit as 50,
      offset,
    )

    tracks.push(...page.items)
    hasMore = !!page.next
    offset += limit
  }

  return tracks
}

// ===========================================
// Public action: Get Spotify Access Token for Playback
// ===========================================

/**
 * Get a valid Spotify access token for the current user.
 * Refreshes the token if expired.
 * Used by the client for Web Playback SDK.
 */
export const getAccessToken = action({
  args: {},
  returns: v.union(
    v.object({
      accessToken: v.string(),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (
    ctx,
  ): Promise<{ accessToken: string; expiresAt: number } | null> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const userId = identity.subject

    // Get the Spotify account tokens
    const account = await ctx.runQuery(
      internal.spotifyInternal.getSpotifyAccount,
      { userId },
    )

    if (!account || !account.accessToken || !account.refreshToken) {
      return null
    }

    let accessToken = account.accessToken
    let expiresAt = account.accessTokenExpiresAt ?? 0

    // Check if token is expired and refresh if needed
    const now = Date.now()
    if (expiresAt < now) {
      console.log('Spotify token expired, refreshing...')
      const newTokens = await refreshSpotifyToken(account.refreshToken)

      accessToken = newTokens.access_token
      expiresAt = now + newTokens.expires_in * 1000

      // Update stored tokens
      await ctx.runMutation(internal.spotifyInternal.updateSpotifyTokens, {
        userId,
        accessToken: newTokens.access_token,
        accessTokenExpiresAt: expiresAt,
        refreshToken: newTokens.refresh_token,
      })
    }

    return {
      accessToken,
      expiresAt,
    }
  },
})

// ===========================================
// Public action: Import Spotify Playlist
// ===========================================

export const importSpotifyPlaylist = action({
  args: {
    playlistUrlOrId: v.string(),
  },
  returns: v.object({
    playlistId: v.id('spotifyPlaylists'),
    trackCount: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ playlistId: Id<'spotifyPlaylists'>; trackCount: number }> => {
    // Get the current user
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    // Get the Spotify account tokens
    const account = await ctx.runQuery(
      internal.spotifyInternal.getSpotifyAccount,
      { userId },
    )
    if (!account || !account.accessToken || !account.refreshToken) {
      throw new Error('No Spotify account linked. Please sign in with Spotify.')
    }

    let accessToken = account.accessToken

    // Check if token is expired and refresh if needed
    const now = Date.now()
    if (account.accessTokenExpiresAt && account.accessTokenExpiresAt < now) {
      console.log('Spotify token expired, refreshing...')
      const newTokens = await refreshSpotifyToken(account.refreshToken)

      accessToken = newTokens.access_token
      const expiresAt = now + newTokens.expires_in * 1000

      // Update stored tokens
      await ctx.runMutation(internal.spotifyInternal.updateSpotifyTokens, {
        userId,
        accessToken: newTokens.access_token,
        accessTokenExpiresAt: expiresAt,
        refreshToken: newTokens.refresh_token,
      })
    }

    // Create authenticated Spotify SDK
    const sdk = createSpotifySdk(accessToken)

    // Parse the playlist ID from the input
    const spotifyPlaylistId = parseSpotifyPlaylistId(args.playlistUrlOrId)

    // Fetch playlist metadata using SDK
    const playlistMeta = await sdk.playlists.getPlaylist(
      spotifyPlaylistId,
      undefined, // market
      'id,name,description,images,tracks(total),snapshot_id',
    )

    // Fetch all tracks using SDK (handles pagination)
    const playlistTracks = await fetchAllPlaylistTracks(sdk, spotifyPlaylistId)

    // Filter valid tracks (skip local files, episodes, and unavailable tracks)
    const validTracks = playlistTracks.filter(
      (item) => 'id' in item.track && item.track.id && 'album' in item.track,
    )

    // Upsert the playlist
    const playlistId = await ctx.runMutation(
      internal.spotifyInternal.upsertPlaylist,
      {
        ownerUserId: userId,
        spotifyPlaylistId: playlistMeta.id,
        name: playlistMeta.name,
        description: playlistMeta.description || undefined,
        imageUrl: playlistMeta.images[0]?.url,
        trackCount: validTracks.length,
        snapshotId: playlistMeta.snapshot_id,
      },
    )

    // Upsert each song and create playlist mappings
    for (let i = 0; i < validTracks.length; i++) {
      // We've already filtered to only include tracks with albums
      const track = validTracks[i].track as {
        id: string
        name: string
        artists: Array<{ name: string }>
        album: {
          name: string
          release_date: string
          images: Array<{ url: string }>
        }
        preview_url: string | null
        uri: string
      }

      const songId = await ctx.runMutation(
        internal.spotifyInternal.upsertSong,
        {
          spotifyTrackId: track.id,
          title: track.name,
          artistNames: track.artists.map((a) => a.name),
          releaseYear: extractReleaseYear(track.album.release_date),
          previewUrl: track.preview_url ?? undefined,
          spotifyUri: track.uri,
          albumName: track.album.name,
          albumImageUrl: track.album.images[0]?.url,
        },
      )

      await ctx.runMutation(internal.spotifyInternal.addPlaylistSong, {
        playlistId,
        songId,
        position: i,
      })
    }

    return {
      playlistId,
      trackCount: validTracks.length,
    }
  },
})
