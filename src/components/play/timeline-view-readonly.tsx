import { motion } from 'motion/react'
import { useMemo } from 'react'
import { GameCard } from './game-card'
import { RoundTimelineCard } from './round-timeline-card'
import { TimelineCardWrapper } from './timeline-card-wrapper'
import { TimelineRail } from './timeline-rail'
import { isPlacementCorrect } from './placement-utils'

import type { ReactNode } from 'react'
import type { CardData, GameData, TimelineData } from './types'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface TimelineViewReadonlyProps {
  timeline: TimelineData
  game: GameData
  isActivePlayer: boolean
  /** Current round card data (passed from GameView to avoid extra queries) */
  currentCard?: CardData | null
  /** Card stack to render inside the card */
  cardStack?: ReactNode
  /** Whether the timeline is exiting (for animation) */
  isExiting?: boolean
}

export function TimelineViewReadonly({
  timeline,
  game,
  isActivePlayer,
  currentCard,
  cardStack,
  isExiting = false,
}: TimelineViewReadonlyProps) {
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
      <CardContent className="py-3">
        {/* Card stack inside the card - stays in place */}
        {cardStack && (
          <div className="mb-8 flex justify-center">{cardStack}</div>
        )}
        {/* Timeline row - animates on player change (exit only) */}
        <div className="overflow-hidden md:overflow-x-auto">
          <motion.div
            className={cn(
              'relative',
              // Mobile: vertical layout, cards centered
              'flex flex-col items-center gap-3 py-2',
              // Desktop: horizontal layout with bottom padding for year labels
              'md:flex-row md:items-start md:justify-center md:gap-2 md:min-w-full md:w-max md:pb-16 md:pt-4 md:px-2',
            )}
            initial={false}
            animate={isExiting ? { x: 300, opacity: 0 } : { x: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {/* Timeline rail */}
            <TimelineRail />

            {displayCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cards yet</p>
            ) : (
              displayCards.map((item, index) =>
                item.type === 'timeline' ? (
                  <TimelineCardWrapper
                    key={item.card._id}
                    releaseYear={item.card.releaseYear}
                  >
                    <GameCard
                      title={item.card.title}
                      artistName={item.card.artistNames[0]}
                      imageUrl={item.card.imageUrl}
                    />
                  </TimelineCardWrapper>
                ) : (
                  <TimelineCardWrapper
                    key={`round-placeholder-${index}`}
                    releaseYear={currentCard?.releaseYear ?? 0}
                    isRevealed={phase === 'revealed'}
                    isCorrect={isCorrect}
                  >
                    <RoundTimelineCard
                      isRevealed={phase === 'revealed'}
                      isCorrect={isCorrect}
                      cardData={
                        currentCard
                          ? {
                              title: currentCard.title,
                              releaseYear: currentCard.releaseYear,
                              artistName: currentCard.artistNames[0],
                              imageUrl: currentCard.imageUrl,
                            }
                          : undefined
                      }
                    />
                  </TimelineCardWrapper>
                ),
              )
            )}
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}
