import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDownIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useMemo } from 'react'

import { GameCard } from './game-card'
import { MYSTERY_CARD_ID } from './mystery-card-stack'
import { DraggableMysteryCard } from './round-timeline-card'
import { TimelineCardWrapper } from './timeline-card-wrapper'
import { TimelineRail } from './timeline-rail'
import type { ReactNode } from 'react'
import type { TimelineData } from './types'
import { Card, CardContent } from '@/components/ui/card'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

const TIMELINE_EMPTY_SLOT_ID = 'timeline-empty-slot'

interface TimelineDropAreaProps {
  timeline: TimelineData
  /** Current items in the timeline (including mystery card if placed) */
  items: Array<string>
  isActivePlayer: boolean
  /** Whether the mystery card is currently being dragged */
  isDragging: boolean
  /** Whether the mystery card has been placed in the timeline */
  isCardPlaced: boolean
  /** Disable dragging */
  dragDisabled?: boolean
  /** Card stack to render inside the card */
  cardStack?: ReactNode
}

export function TimelineDropArea({
  timeline,
  items,
  isActivePlayer,
  isDragging,
  isCardPlaced,
  dragDisabled,
  cardStack,
}: TimelineDropAreaProps) {
  const isMobile = useIsMobile()

  // Create a map of card data for quick lookup
  const cardDataMap = useMemo(() => {
    const map = new Map<string, TimelineData['cards'][0]>()
    for (const card of timeline.cards) {
      map.set(card._id as string, card)
    }
    return map
  }, [timeline.cards])

  const showExternalMysteryCard = !isCardPlaced
  const sortingStrategy = isMobile
    ? verticalListSortingStrategy
    : horizontalListSortingStrategy

  return (
    <SortableContext items={items} strategy={sortingStrategy}>
      <Card
        className={cn(
          'overflow-visible',
          isActivePlayer && 'border-2 border-primary',
        )}
      >
        <CardContent className="overflow-visible py-3">
          {/* Card stack inside the card */}
          {cardStack && (
            <div className="mb-8 flex justify-center">{cardStack}</div>
          )}
          <div className="overflow-hidden md:overflow-x-auto">
            <motion.div
              className={cn(
                'relative',
                // Mobile: vertical layout, cards centered
                'flex flex-col items-center gap-3 py-2',
                // Desktop: horizontal layout with bottom padding for year labels
                'md:flex-row md:items-start md:justify-center md:gap-2 md:min-w-full md:w-max md:pb-16 md:pt-4 md:px-2',
                // Subtle highlight while dragging toward the timeline
                isDragging &&
                  showExternalMysteryCard &&
                  'rounded-md ring-1 ring-primary/30',
              )}
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {/* Timeline rail */}
              <TimelineRail />

              {items.length === 0 ? (
                <TimelineEmptyDropSlot disabled={dragDisabled} />
              ) : (
                items.map((id) => {
                  if (id === MYSTERY_CARD_ID) {
                    return (
                      <SortableMysteryCard
                        key={id}
                        disabled={dragDisabled}
                        isDragging={isDragging}
                      />
                    )
                  }

                  const card = cardDataMap.get(id)
                  if (!card) return null

                  return <SortableTimelineCard key={id} id={id} card={card} />
                })
              )}
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </SortableContext>
  )
}

function TimelineEmptyDropSlot({ disabled }: { disabled?: boolean }) {
  const { isOver, setNodeRef } = useDroppable({
    id: TIMELINE_EMPTY_SLOT_ID,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-all',
        // Mobile: wider drop zone, shorter height
        'h-32 w-full',
        // Desktop: standard card size
        'md:h-40 md:w-28',
        isOver
          ? 'scale-105 border-primary bg-primary/10'
          : 'border-muted-foreground/30 bg-muted/30',
        disabled && 'opacity-50',
      )}
    >
      <ArrowDownIcon
        weight="duotone"
        className={cn(
          'size-6 text-muted-foreground',
          !disabled && 'animate-bounce',
        )}
      />
      <span className="px-2 text-xs text-muted-foreground">
        Drop your first card here
      </span>
    </div>
  )
}

interface SortableMysteryCardProps {
  disabled?: boolean
  isDragging?: boolean
}

function SortableMysteryCard({
  disabled,
  isDragging,
}: SortableMysteryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: MYSTERY_CARD_ID,
      disabled,
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'shrink-0 touch-none cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <DraggableMysteryCard />
    </div>
  )
}

interface SortableTimelineCardProps {
  id: string
  card: TimelineData['cards'][0]
}

function SortableTimelineCard({ id, card }: SortableTimelineCardProps) {
  const { setNodeRef, transform, transition } = useSortable({
    id,
    // Timeline cards are not draggable - only the mystery card can be dragged
    disabled: true,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TimelineCardWrapper releaseYear={card.releaseYear}>
        <GameCard
          title={card.title}
          artistName={card.artistNames[0]}
          imageUrl={card.imageUrl}
        />
      </TimelineCardWrapper>
    </div>
  )
}
