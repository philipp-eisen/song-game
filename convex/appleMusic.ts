'use node'

import { ActionCache } from '@convex-dev/action-cache'
import { v } from 'convex/values'
import { action, internalAction } from './_generated/server'
import { components, internal } from './_generated/api'
import { env } from './env'
import type { ActionCtx } from './_generated/server'
import type {
  Artwork,
  PlaylistRelationship,
  SearchResponse,
  Song,
  SongRelationship,
} from '../src/generated/apple-music'

// ===========================================
// Constants
// ===========================================

const APPLE_MUSIC_API_BASE = 'https://api.music.apple.com/v1'
const DEFAULT_STOREFRONT = 'us'

// ===========================================
// JWT Generation for Developer Token (Cached)
// ===========================================

/**
 * Internal action to generate an Apple Music Developer Token (JWT)
 * Uses ES256 algorithm with the MusicKit private key
 * This is wrapped by ActionCache for persistent caching
 */
export const generateDeveloperTokenInternal = internalAction({
  args: {},
  returns: v.string(),
  handler: async (): Promise<string> => {
    // Dynamic import for jsonwebtoken (Node.js module)
    const jwt = await import('jsonwebtoken')

    const token = jwt.default.sign({}, env.APPLE_PRIVATE_KEY, {
      algorithm: 'ES256',
      expiresIn: '14d',
      issuer: env.APPLE_TEAM_ID,
      header: {
        alg: 'ES256',
        kid: env.APPLE_KEY_ID,
      },
    })

    console.log('[Apple Music] Generated new developer token')
    return token
  },
})

/**
 * ActionCache for Apple Music developer token
 * Token is valid for 14 days, we cache for 7 days to allow for periodic refresh
 */
const tokenCache = new ActionCache(components.actionCache, {
  action: internal.appleMusic.generateDeveloperTokenInternal,
  name: 'apple-music-token-v1',
  ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
})

/**
 * Make an authenticated request to the Apple Music API
 */
async function appleMusicFetch<T>(
  ctx: ActionCtx,
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const token = await tokenCache.fetch(ctx, {})

  const response = await fetch(`${APPLE_MUSIC_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Apple Music API error: ${response.status} ${response.statusText} - ${errorText}`,
    )
  }

  return response.json()
}

/**
 * Extract release year from Apple Music's release date string
 * Handles: "YYYY-MM-DD"
 */
function extractReleaseYear(releaseDate: string): number {
  const year = parseInt(releaseDate.substring(0, 4), 10)
  return isNaN(year) ? 2000 : year
}

/**
 * Get the artwork URL at a specific size
 */
function getArtworkUrl(
  artwork: Artwork | undefined,
  size: number = 300,
): string | undefined {
  if (!artwork?.url) return undefined
  return artwork.url.replace('{w}', String(size)).replace('{h}', String(size))
}

// ===========================================
// Internal Actions
// ===========================================

/**
 * Search Apple Music catalog by ISRC (exact match)
 * Returns the first matching song or null
 */
export const searchByISRC = internalAction({
  args: {
    isrc: v.string(),
    storefront: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      appleMusicId: v.string(),
      title: v.string(),
      artistName: v.string(),
      albumName: v.string(),
      releaseDate: v.string(),
      releaseYear: v.number(),
      previewUrl: v.optional(v.string()),
      artworkUrl: v.optional(v.string()),
      isrc: v.string(),
      durationMs: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const storefront = args.storefront ?? DEFAULT_STOREFRONT

    try {
      const response = await appleMusicFetch<SongRelationship>(
        ctx,
        `/catalog/${storefront}/songs?filter[isrc]=${args.isrc}`,
      )

      if (response.data.length === 0) {
        return null
      }

      const song = response.data[0] as Song
      return {
        appleMusicId: song.id,
        title: song.attributes.name,
        artistName: song.attributes.artistName,
        albumName: song.attributes.albumName,
        releaseDate: song.attributes.releaseDate ?? '',
        releaseYear: extractReleaseYear(song.attributes.releaseDate ?? ''),
        previewUrl: song.attributes.previews[0]?.url,
        artworkUrl: getArtworkUrl(song.attributes.artwork),
        isrc: args.isrc,
        durationMs: song.attributes.durationInMillis,
      }
    } catch (error) {
      console.error('[Apple Music] ISRC search error:', error)
      return null
    }
  },
})

/**
 * Search Apple Music catalog by text query
 * Returns up to 10 matching songs
 */
export const searchCatalog = internalAction({
  args: {
    query: v.string(),
    storefront: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      appleMusicId: v.string(),
      title: v.string(),
      artistName: v.string(),
      albumName: v.string(),
      releaseDate: v.string(),
      releaseYear: v.number(),
      previewUrl: v.optional(v.string()),
      artworkUrl: v.optional(v.string()),
      isrc: v.optional(v.string()),
      durationMs: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const storefront = args.storefront ?? DEFAULT_STOREFRONT
    const limit = args.limit ?? 10

    const encodedQuery = encodeURIComponent(args.query)
    const response = await appleMusicFetch<SearchResponse>(
      ctx,
      `/catalog/${storefront}/search?term=${encodedQuery}&types=songs&limit=${limit}`,
    )

    const songs = (response.results.songs?.data ?? []) as Array<Song>

    return songs.map((song) => ({
      appleMusicId: song.id,
      title: song.attributes.name,
      artistName: song.attributes.artistName,
      albumName: song.attributes.albumName,
      releaseDate: song.attributes.releaseDate ?? '',
      releaseYear: extractReleaseYear(song.attributes.releaseDate ?? ''),
      previewUrl: song.attributes.previews[0]?.url,
      artworkUrl: getArtworkUrl(song.attributes.artwork),
      isrc: song.attributes.isrc,
      durationMs: song.attributes.durationInMillis,
    }))
  },
})

/**
 * Get a public Apple Music playlist by ID
 */
export const getPlaylist = internalAction({
  args: {
    playlistId: v.string(),
    storefront: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      artworkUrl: v.optional(v.string()),
      tracks: v.array(
        v.object({
          appleMusicId: v.string(),
          title: v.string(),
          artistName: v.string(),
          albumName: v.string(),
          releaseDate: v.string(),
          releaseYear: v.number(),
          previewUrl: v.optional(v.string()),
          artworkUrl: v.optional(v.string()),
          isrc: v.optional(v.string()),
          durationMs: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const storefront = args.storefront ?? DEFAULT_STOREFRONT

    try {
      const response = await appleMusicFetch<PlaylistRelationship>(
        ctx,
        `/catalog/${storefront}/playlists/${args.playlistId}?include=tracks`,
      )

      if (response.data.length === 0) {
        return null
      }

      const playlist = response.data[0]
      const tracks = (playlist.relationships?.tracks?.data ?? []) as Array<Song>

      return {
        id: playlist.id,
        name: playlist.attributes?.name ?? '',
        description: playlist.attributes?.description?.standard,
        artworkUrl: getArtworkUrl(playlist.attributes?.artwork),
        tracks: tracks.map((song) => ({
          appleMusicId: song.id,
          title: song.attributes.name,
          artistName: song.attributes.artistName,
          albumName: song.attributes.albumName,
          releaseDate: song.attributes.releaseDate ?? '',
          releaseYear: extractReleaseYear(song.attributes.releaseDate ?? ''),
          previewUrl: song.attributes.previews[0]?.url,
          artworkUrl: getArtworkUrl(song.attributes.artwork),
          isrc: song.attributes.isrc,
          durationMs: song.attributes.durationInMillis,
        })),
      }
    } catch (error) {
      console.error('[Apple Music] Get playlist error:', error)
      return null
    }
  },
})

// ===========================================
// Public Actions
// ===========================================

// Type for search results
interface SearchResult {
  appleMusicId: string
  title: string
  artistName: string
  albumName: string
  releaseYear: number
  previewUrl?: string
  artworkUrl?: string
}

/**
 * Search Apple Music catalog (public action for UI)
 */
export const search = action({
  args: {
    query: v.string(),
    storefront: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      appleMusicId: v.string(),
      title: v.string(),
      artistName: v.string(),
      albumName: v.string(),
      releaseYear: v.number(),
      previewUrl: v.optional(v.string()),
      artworkUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args): Promise<Array<SearchResult>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const results = await ctx.runAction(internal.appleMusic.searchCatalog, {
      query: args.query,
      storefront: args.storefront,
      limit: 10,
    })

    return results.map((r: SearchResult) => ({
      appleMusicId: r.appleMusicId,
      title: r.title,
      artistName: r.artistName,
      albumName: r.albumName,
      releaseYear: r.releaseYear,
      previewUrl: r.previewUrl,
      artworkUrl: r.artworkUrl,
    }))
  },
})
