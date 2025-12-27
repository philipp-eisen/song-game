import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// ===========================================
// Playlist queries
// ===========================================

export const listMyPlaylistsQuery = () => convexQuery(api.playlists.listMine, {})

export const getPlaylistQuery = (playlistId: Id<'spotifyPlaylists'>) =>
  convexQuery(api.playlists.get, { playlistId })

// ===========================================
// Game queries
// ===========================================

export const listMyGamesQuery = () => convexQuery(api.games.listMine, {})

export const getGameQuery = (gameId: Id<'games'>) =>
  convexQuery(api.games.get, { gameId })

// ===========================================
// Timeline queries
// ===========================================

export const getPlayerTimelineQuery = (playerId: Id<'gamePlayers'>) =>
  convexQuery(api.timelines.getPlayerTimeline, { playerId })

export const getAllTimelinesQuery = (gameId: Id<'games'>) =>
  convexQuery(api.timelines.getAllTimelines, { gameId })

export const getCurrentRoundCardQuery = (gameId: Id<'games'>) =>
  convexQuery(api.timelines.getCurrentRoundCard, { gameId })

export const getCurrentRoundSongPreviewQuery = (gameId: Id<'games'>) =>
  convexQuery(api.timelines.getCurrentRoundSongPreview, { gameId })

// ===========================================
// Auth queries
// ===========================================

export const getCurrentUserQuery = () => convexQuery(api.auth.getCurrentUser, {})

