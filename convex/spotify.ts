'use node'

import { SpotifyApi } from '@spotify/web-api-ts-sdk'
import { v } from 'convex/values'
import { action } from './_generated/server'
import { internal } from './_generated/api'
import { env } from './env'
import type { PlaylistedTrack } from '@spotify/web-api-ts-sdk'
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
 * Get an access token using Spotify's Client Credentials flow.
 * This allows accessing public resources (like public playlists) without user authorization.
 * @see https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow
 */
async function getClientCredentialsToken(): Promise<string> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to get Spotify client credentials token: ${response.status} ${errorText}`,
    )
  }

  const data = await response.json()
  return data.access_token
}

/**
 * Create an authenticated Spotify SDK instance using an access token
 */
function createSpotifySdk(accessToken: string): SpotifyApi {
  // Create SDK with the access token
  return SpotifyApi.withAccessToken(env.SPOTIFY_CLIENT_ID, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: '',
  })
}

/**
 * Fetch all tracks from a playlist (handles pagination)
 * Now includes external_ids for ISRC
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
      'items(track(id,name,artists(name),album(name,release_date,images),preview_url,uri,external_ids)),next,total',
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
// Public action: Import Spotify Playlist
// ===========================================

export const importSpotifyPlaylist = action({
  args: {
    playlistUrlOrId: v.string(),
  },
  returns: v.object({
    playlistId: v.id('playlists'),
    trackCount: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ playlistId: Id<'playlists'>; trackCount: number }> => {
    // Get the current user (needed to set playlist ownership)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    // Get an app-level access token using Client Credentials flow
    // This allows importing any public playlist without requiring user's Spotify login
    const accessToken = await getClientCredentialsToken()

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

    // Build track data for insertion
    const tracks = validTracks.map((item, index) => {
      const track = item.track as {
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
        external_ids?: { isrc?: string }
      }

      return {
        position: index,
        title: track.name,
        artistNames: track.artists.map((a) => a.name),
        releaseYear: extractReleaseYear(track.album.release_date),
        imageUrl: track.album.images[0]?.url,
        spotifyTrackId: track.id,
        isrc: track.external_ids?.isrc,
      }
    })

    // Upsert the playlist and replace its tracks
    const playlistId = await ctx.runMutation(
      internal.spotifyInternal.upsertPlaylistWithTracks,
      {
        ownerUserId: userId,
        source: 'spotify',
        sourcePlaylistId: playlistMeta.id,
        name: playlistMeta.name,
        description: playlistMeta.description || undefined,
        imageUrl: playlistMeta.images[0]?.url,
        tracks,
      },
    )

    // Schedule background Apple Music matching
    await ctx.scheduler.runAfter(0, internal.playlistImport.processPlaylistBatch, {
      playlistId,
    })

    return {
      playlistId,
      trackCount: validTracks.length,
    }
  },
})
