import { useMutation } from 'convex/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { MusicNoteIcon } from '@phosphor-icons/react'

import { api } from '../../../convex/_generated/api'
import { TurnControls } from './turn-controls'
import { TimelineView } from './timeline-view'
import type { GameData, TimelineData } from './types'
import {
  getCurrentRoundCardQuery,
  getCurrentRoundSongPreviewQuery,
} from '@/lib/convex-queries'
import { PreviewPlayer } from '@/components/preview-player'

interface GameControlsBarProps {
  game: GameData
  timelines: Array<TimelineData>
}

export function GameControlsBar({ game, timelines }: GameControlsBarProps) {
  const { data: songPreview } = useQuery(
    getCurrentRoundSongPreviewQuery(game._id),
  )
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
  const activePlayerTimeline = timelines.find(
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
      {/* Audio Player */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-primary/15 p-4">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/20">
            <MusicNoteIcon
              weight="duotone"
              className="size-7 animate-pulse text-primary"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-primary">Mystery Song</p>
            <p className="truncate text-sm text-muted-foreground">
              Listen and place it on your timeline
            </p>
          </div>
        </div>
        <div className="mt-3">
          <PreviewPlayer
            previewUrl={songPreview?.previewUrl}
            appleMusicId={songPreview?.appleMusicId}
            autoPlay
          />
        </div>
      </div>

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
