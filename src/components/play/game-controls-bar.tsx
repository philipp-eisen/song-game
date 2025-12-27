import { useMutation } from 'convex/react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { TurnControls } from './turn-controls'
import { ActiveTimelineDropzone } from './active-timeline-dropzone'
import type { GameData } from './types'
import {
  getAllTimelinesQuery,
  getCurrentRoundSongPreviewQuery,
} from '@/lib/convex-queries'
import { SpotifyPlayer } from '@/components/spotify-player'
import { Badge } from '@/components/ui/badge'

interface GameControlsBarProps {
  game: GameData
}

export function GameControlsBar({ game }: GameControlsBarProps) {
  const { data: songPreview } = useQuery(
    getCurrentRoundSongPreviewQuery(game._id),
  )
  const { data: timelines } = useSuspenseQuery(getAllTimelinesQuery(game._id))

  const isHost = game.isCurrentUserHost

  const activePlayer = game.players.find(
    (p) => p.seatIndex === game.currentTurnSeatIndex,
  )
  const isActivePlayer =
    activePlayer?.isCurrentUser || (activePlayer?.kind === 'local' && isHost)

  // Get the active player's timeline for the drop zone (only when needed)
  const shouldShowDropzone =
    isActivePlayer && game.phase === 'awaitingPlacement' && activePlayer

  // Find the active player's timeline from the already-loaded timelines
  const activePlayerTimeline = timelines?.find(
    (t) => t.playerId === activePlayer?._id,
  )

  const placeCard = useMutation(api.turns.placeCard)
  const [placementError, setPlacementError] = useState<string | null>(null)
  const [isPlacing, setIsPlacing] = useState(false)

  const handlePlaceCard = async (insertIndex: number) => {
    if (!activePlayer) return

    setPlacementError(null)
    setIsPlacing(true)
    try {
      await placeCard({
        gameId: game._id,
        actingPlayerId: activePlayer._id,
        insertIndex,
      })
    } catch (err) {
      setPlacementError(err instanceof Error ? err.message : 'Placement failed')
    } finally {
      setIsPlacing(false)
    }
  }

  return (
    <div className="sticky bottom-0 z-40 -mx-4 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="space-y-3 p-4">
        {/* Spotify Player - Always rendered */}
        <SpotifyPlayer
          spotifyUri={songPreview?.spotifyUri}
          previewUrl={songPreview?.previewUrl}
        />

        {/* Turn Info & Controls */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              {activePlayer?.displayName}'s Turn
            </span>
            {isActivePlayer && (
              <Badge variant="default" className="text-xs">
                Your Turn
              </Badge>
            )}
            <span className="ml-auto text-muted-foreground">
              {game.phase} • {game.deckRemaining} cards left
            </span>
          </div>

          {/* Drag-and-drop placement UI for active player during awaitingPlacement */}
          {shouldShowDropzone && activePlayerTimeline && (
            <div className="space-y-2">
              <ActiveTimelineDropzone
                timeline={activePlayerTimeline}
                onPlaceCard={handlePlaceCard}
                disabled={isPlacing}
              />
              {placementError && (
                <p className="text-center text-sm text-red-500">
                  {placementError}
                </p>
              )}
            </div>
          )}

          {activePlayer && (
            <TurnControls
              game={game}
              activePlayer={activePlayer}
              isActivePlayer={isActivePlayer}
              isHost={isHost}
            />
          )}
        </div>
      </div>
    </div>
  )
}
