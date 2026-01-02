import { useSuspenseQuery } from '@tanstack/react-query'
import { GameCard } from './game-card'
import type { GameData } from './types'
import { getAllTimelinesQuery } from '@/lib/convex-queries'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface FinishedViewProps {
  game: GameData
}

export function FinishedView({ game }: FinishedViewProps) {
  const winner = game.players.find((p) => p._id === game.winnerId)
  const { data: timelines } = useSuspenseQuery(getAllTimelinesQuery(game._id))

  return (
    <div className="space-y-4">
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="text-2xl">Game Over!</CardTitle>
          <CardDescription>
            {winner
              ? `${winner.displayName} wins with ${game.winCondition}+ cards!`
              : 'The game has ended'}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Final Timelines */}
      {timelines && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Final Timelines</h2>
          {[...timelines]
            .sort((a, b) => b.cards.length - a.cards.length)
            .map((timeline, index) => (
              <Card
                key={timeline.playerId}
                className={index === 0 ? 'border-2 border-primary' : ''}
              >
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {index === 0 && '🏆 '}
                      {timeline.displayName}
                      {timeline.isCurrentUser && (
                        <Badge className="ml-2">You</Badge>
                      )}
                    </CardTitle>
                    <span className="text-lg font-bold">
                      {timeline.cards.length} cards
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="-m-1 flex gap-2 overflow-x-auto p-1">
                    {timeline.cards.map((card) => (
                      <GameCard
                        key={card._id}
                        title={card.title}
                        releaseYear={card.releaseYear}
                        artistName={card.artistNames[0]}
                        imageUrl={card.imageUrl}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
