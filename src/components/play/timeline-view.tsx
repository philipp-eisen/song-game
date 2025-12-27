import {
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useMemo, useState } from 'react'
import { GameCard } from './game-card'
import { DraggableMysteryCard, RoundTimelineCard } from './round-timeline-card'
import { isPlacementCorrect } from './placement-utils'

import type { DragEndEvent, Modifier } from '@dnd-kit/core'
import type { CardData, GameData, TimelineData } from './types'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const MYSTERY_CARD_ID = 'mystery-card'

// Custom modifier to snap the drag overlay so the cursor is at the center of the card
const snapCenterToCursor: Modifier = ({
  transform,
  activatorEvent,
  draggingNodeRect,
}) => {
  if (!draggingNodeRect || !activatorEvent) {
    return transform
  }

  const activatorCoordinates =
    activatorEvent instanceof MouseEvent ||
    activatorEvent instanceof PointerEvent
      ? { x: activatorEvent.clientX, y: activatorEvent.clientY }
      : null

  if (!activatorCoordinates) {
    return transform
  }

  // Calculate the offset from where the user clicked to the center of the card
  const offsetX =
    activatorCoordinates.x -
    (draggingNodeRect.left + draggingNodeRect.width / 2)
  const offsetY =
    activatorCoordinates.y -
    (draggingNodeRect.top + draggingNodeRect.height / 2)

  return {
    ...transform,
    x: transform.x + offsetX,
    y: transform.y + offsetY,
  }
}

interface TimelineViewProps {
  timeline: TimelineData
  game: GameData
  isActivePlayer: boolean
  /** Current round card data (passed from GameView to avoid extra queries) */
  currentCard?: CardData | null
  /** Enable drag-and-drop editing mode */
  editable?: boolean
  /** Called when the mystery card is placed (only in editable mode) */
  onPlaceCard?: (insertIndex: number) => void
  /** Disable dragging (e.g. while placing) */
  dragDisabled?: boolean
}

export function TimelineView({
  timeline,
  game,
  isActivePlayer,
  currentCard,
  editable = false,
  onPlaceCard,
  dragDisabled = false,
}: TimelineViewProps) {
  const player = game.players.find((p) => p._id === timeline.playerId)
  const { currentRound, phase } = game

  // Get the placement index if we should show the round placeholder (non-editable mode)
  const placementIndex =
    !editable &&
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

  // Build the display list with the round placeholder inserted (non-editable mode)
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Editable mode: dnd-kit sortable timeline
  // ─────────────────────────────────────────────────────────────────────────────

  const isRepositioning = currentRound?.placementIndex !== undefined

  // Build the sortable items list for editable mode
  const initialItems = useMemo(() => {
    if (!editable) return []
    const cardIds = timeline.cards.map((c) => c._id as string)

    const placementIdx = currentRound?.placementIndex
    if (isRepositioning && placementIdx !== undefined) {
      // Insert mystery card at its current placement position
      const items = [...cardIds]
      items.splice(placementIdx, 0, MYSTERY_CARD_ID)
      return items
    }

    // Not repositioning - mystery card starts at the end
    return [...cardIds, MYSTERY_CARD_ID]
  }, [timeline.cards, currentRound?.placementIndex, isRepositioning, editable])

  const [items, setItems] = useState<Array<string>>(initialItems)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sync items when timeline cards change externally or when initialItems change
  useMemo(() => {
    if (!editable) return

    const cardIds = timeline.cards.map((c) => c._id as string)
    const mysteryIndex = items.indexOf(MYSTERY_CARD_ID)

    // Check if card IDs have changed
    const currentCardIds = items.filter((id) => id !== MYSTERY_CARD_ID)
    const cardsChanged =
      currentCardIds.length !== cardIds.length ||
      currentCardIds.some((id, i) => id !== cardIds[i])

    if (cardsChanged) {
      // Rebuild items with mystery card at its current relative position
      const newItems = [...cardIds]
      const insertAt = Math.min(
        mysteryIndex >= 0 ? mysteryIndex : cardIds.length,
        cardIds.length,
      )
      newItems.splice(insertAt, 0, MYSTERY_CARD_ID)
      setItems(newItems)
    }
  }, [timeline.cards, items, editable])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
  )

  const handleDragStart = useCallback(
    (event: { active: { id: string | number } }) => {
      setActiveId(String(event.active.id))
    },
    [],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || dragDisabled) return

      const oldIndex = items.indexOf(String(active.id))
      const overIndex = items.indexOf(String(over.id))

      if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
        const newItems = arrayMove(items, oldIndex, overIndex)
        setItems(newItems)

        // Calculate the new position of the mystery card
        const newMysteryIndex = newItems.indexOf(MYSTERY_CARD_ID)
        if (newMysteryIndex !== -1 && onPlaceCard) {
          onPlaceCard(newMysteryIndex)
        }
      }
    },
    [items, dragDisabled, onPlaceCard],
  )

  const isDragging = activeId === MYSTERY_CARD_ID

  // Create a map of card data for quick lookup (editable mode)
  const cardDataMap = useMemo(() => {
    const map = new Map<string, TimelineData['cards'][0]>()
    for (const card of timeline.cards) {
      map.set(card._id as string, card)
    }
    return map
  }, [timeline.cards])

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  const cardHeader = (
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
  )

  // Editable mode with dnd-kit
  if (editable) {
    return (
      <Card className={isActivePlayer ? 'border-2 border-primary' : ''}>
        {cardHeader}
        <CardContent className="py-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[snapCenterToCursor]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items}
              strategy={horizontalListSortingStrategy}
            >
              <div className="-m-1 flex gap-2 overflow-x-auto p-1">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cards yet</p>
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
              </div>
            </SortableContext>

            {/* Drag overlay - follows cursor during drag */}
            <DragOverlay dropAnimation={null}>
              {isDragging && <DraggableMysteryCard />}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>
    )
  }

  // Non-editable mode (original behavior)
  return (
    <Card className={isActivePlayer ? 'border-2 border-primary' : ''}>
      {cardHeader}
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

// ─────────────────────────────────────────────────────────────────────────────
// Sortable components for editable mode
// ─────────────────────────────────────────────────────────────────────────────

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
    <div ref={setNodeRef} style={style} className="shrink-0">
      <GameCard
        title={card.title}
        releaseYear={card.releaseYear}
        artistName={card.artistNames[0]}
        albumImageUrl={card.albumImageUrl}
      />
    </div>
  )
}
