import { useMemo } from 'react'
import { GameCard } from './game-card'
import { RoundTimelineCard } from './round-timeline-card'
import { isPlacementCorrect } from './placement-utils'

import type { CardData, GameData, TimelineData } from './types'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface TimelineViewReadonlyProps {
  timeline: TimelineData
  game: GameData
  isActivePlayer: boolean
  /** Current round card data (passed from GameView to avoid extra queries) */
  currentCard?: CardData | null
}

export function TimelineViewReadonly({
  timeline,
  game,
  isActivePlayer,
  currentCard,
}: TimelineViewReadonlyProps) {
  const player = game.players.find((p) => p._id === timeline.playerId)
  const { currentRound, phase } = game

  // Get the placement index if we should show the round placeholder
  const placementIndex =
    isActivePlayer &&
    currentRound?.placementIndex !== undefined &&
    (phase === 'awaitingReveal' || phase === 'revealed')
      ? currentRound.placementIndex
      : undefined

  // Compute correctness when revealed
  const isCorrect = useMemo(() => {
    if (
      phase !== 'revealed' ||
      !currentCard ||
      currentRound?.placementIndex === undefined
    ) {
      return undefined
    }
    // Use the timeline cards as-is (before the round card was placed)
    return isPlacementCorrect(
      timeline.cards.map((c) => ({ releaseYear: c.releaseYear })),
      currentRound.placementIndex,
      currentCard.releaseYear,
    )
  }, [phase, currentCard, currentRound?.placementIndex, timeline.cards])

  // Build the display list with the round placeholder inserted
  const displayCards = useMemo(() => {
    if (placementIndex === undefined) {
      return timeline.cards.map((card) => ({
        type: 'timeline' as const,
        card,
      }))
    }

    const result: Array<
      | { type: 'timeline'; card: TimelineData['cards'][0] }
      | { type: 'round'; placementIndex: number }
    > = []

    // Insert existing cards and the round placeholder at the right position
    for (let i = 0; i <= timeline.cards.length; i++) {
      if (i === placementIndex) {
        result.push({ type: 'round', placementIndex })
      }
      if (i < timeline.cards.length) {
        result.push({ type: 'timeline', card: timeline.cards[i] })
      }
    }

    // Edge case: if placementIndex is at the end
    if (
      placementIndex === timeline.cards.length &&
      !result.some((r) => r.type === 'round')
    ) {
      result.push({ type: 'round', placementIndex })
    }

    return result
  }, [placementIndex, timeline.cards])

  return (
    <Card className={isActivePlayer ? 'border-2 border-primary' : ''}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {timeline.displayName}
            {timeline.isCurrentUser && <Badge className="ml-2">You</Badge>}
            {isActivePlayer && (
              <Badge variant="outline" className="ml-2">
                Active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {timeline.cards.length} cards
            </span>
            {game.useTokens && (
              <Badge variant="secondary">
                {player?.tokenBalance ?? 0} tokens
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2">
        <div className="-m-1 flex gap-2 overflow-x-auto p-1">
          {displayCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cards yet</p>
          ) : (
            displayCards.map((item, index) =>
              item.type === 'timeline' ? (
                <GameCard
                  key={item.card._id}
                  title={item.card.title}
                  releaseYear={item.card.releaseYear}
                  artistName={item.card.artistNames[0]}
                  albumImageUrl={item.card.albumImageUrl}
                />
              ) : (
                <RoundTimelineCard
                  key={`round-placeholder-${index}`}
                  isRevealed={phase === 'revealed'}
                  isCorrect={isCorrect}
                  cardData={
                    currentCard
                      ? {
                          title: currentCard.title,
                          releaseYear: currentCard.releaseYear,
                          artistName: currentCard.artistNames[0],
                          albumImageUrl: currentCard.albumImageUrl,
                        }
                      : undefined
                  }
                />
              ),
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}

