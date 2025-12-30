import { useMutation } from 'convex/react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { TurnControls } from './turn-controls'
import { TimelineView } from './timeline-view'
import type { GameData } from './types'
import {
  getAllTimelinesQuery,
  getCurrentRoundCardQuery,
  getCurrentRoundSongPreviewQuery,
} from '@/lib/convex-queries'
import { SpotifyPlayer } from '@/components/spotify-player'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface GameControlsBarProps {
  game: GameData
}

export function GameControlsBar({ game }: GameControlsBarProps) {
  const { data: songPreview } = useQuery(
    getCurrentRoundSongPreviewQuery(game._id),
  )
  const { data: timelines } = useSuspenseQuery(getAllTimelinesQuery(game._id))
  const { data: currentCard } = useQuery(getCurrentRoundCardQuery(game._id))

  const isHost = game.isCurrentUserHost

  const activePlayer = game.players.find(
    (p) => p.seatIndex === game.currentTurnSeatIndex,
  )
  const isActivePlayer =
    activePlayer?.isCurrentUser || (activePlayer?.kind === 'local' && isHost)

  // Get the active player's timeline for the drop zone
  // Show during awaitingPlacement AND awaitingReveal (allows repositioning before reveal)
  const shouldShowDropzone =
    isActivePlayer &&
    (game.phase === 'awaitingPlacement' || game.phase === 'awaitingReveal') &&
    !!activePlayer

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
    <div className="space-y-4">
      {/* Card 1: Spotify Player */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Now Playing</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <SpotifyPlayer
            spotifyUri={songPreview?.spotifyUri}
            previewUrl={songPreview?.previewUrl}
          />
        </CardContent>
      </Card>

      {/* Card 2: Timeline (rendered by TimelineView with its own Card wrapper) */}
      {activePlayerTimeline && (
        <TimelineView
          timeline={activePlayerTimeline}
          game={game}
          isActivePlayer={true}
          currentCard={currentCard}
          editable={shouldShowDropzone}
          onPlaceCard={handlePlaceCard}
          dragDisabled={isPlacing}
        />
      )}

      {placementError && (
        <p className="text-center text-sm text-destructive">{placementError}</p>
      )}

      {/* Turn Controls */}
      {activePlayer && (
        <TurnControls
          game={game}
          activePlayer={activePlayer}
          isActivePlayer={isActivePlayer}
          isHost={isHost}
        />
      )}
    </div>
  )
}
