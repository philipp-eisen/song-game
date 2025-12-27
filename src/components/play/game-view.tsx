import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { TimelineView } from './timeline-view'
import type { GameData } from './types'
import {
  getAllTimelinesQuery,
  getCurrentRoundCardQuery,
} from '@/lib/convex-queries'

interface GameViewProps {
  game: GameData
}

export function GameView({ game }: GameViewProps) {
  const { data: timelines } = useSuspenseQuery(getAllTimelinesQuery(game._id))
  const { data: currentCard } = useQuery(getCurrentRoundCardQuery(game._id))

  const activePlayer = game.players.find(
    (p) => p.seatIndex === game.currentTurnSeatIndex,
  )

  return (
    <div className="space-y-4">
      {/* Timelines */}
      {timelines && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Timelines</h2>
          {timelines.map((timeline) => (
            <TimelineView
              key={timeline.playerId}
              timeline={timeline}
              game={game}
              isActivePlayer={timeline.playerId === activePlayer?._id}
              currentCard={currentCard}
            />
          ))}
        </div>
      )}
    </div>
  )
}
