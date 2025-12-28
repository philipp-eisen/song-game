import {
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameCard } from './game-card'
import { DraggableMysteryCard } from './round-timeline-card'

import type { DragEndEvent, DragOverEvent, Modifier } from '@dnd-kit/core'
import type { GameData, TimelineData } from './types'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const MYSTERY_CARD_ID = 'mystery-card'
const TIMELINE_EMPTY_SLOT_ID = 'timeline-empty-slot'

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

export interface TimelineViewEditableProps {
  timeline: TimelineData
  game: GameData
  isActivePlayer: boolean
  /** Called when the mystery card is placed */
  onPlaceCard?: (insertIndex: number) => void
  /** Disable dragging (e.g. while placing) */
  dragDisabled?: boolean
}

export function TimelineViewEditable({
  timeline,
  game,
  isActivePlayer,
  onPlaceCard,
  dragDisabled = false,
}: TimelineViewEditableProps) {
  const player = game.players.find((p) => p._id === timeline.playerId)
  const { currentRound } = game

  const isRepositioning = currentRound?.placementIndex !== undefined

  // Build the sortable items list
  const initialItems = useMemo(() => {
    const cardIds = timeline.cards.map((c) => c._id as string)

    const placementIdx = currentRound?.placementIndex
    if (isRepositioning && placementIdx !== undefined) {
      // Insert mystery card at its current placement position
      const items = [...cardIds]
      items.splice(placementIdx, 0, MYSTERY_CARD_ID)
      return items
    }

    // Not repositioning (new draw) - mystery card starts OUTSIDE the timeline.
    // It'll be inserted when the user drags it into the timeline.
    return cardIds
  }, [timeline.cards, currentRound?.placementIndex, isRepositioning])

  const [items, setItems] = useState<Array<string>>(initialItems)
  const [activeId, setActiveId] = useState<string | null>(null)
  const wasExternalDragRef = useRef(false)
  const itemsRef = useRef(items)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // TimelineView stays mounted across rounds. Reset local drag state when we enter the
  // placement phase (new round started) so the mystery card is back "outside".
  const lastPhaseRef = useRef<GameData['phase']>(game.phase)
  useEffect(() => {
    const prevPhase = lastPhaseRef.current
    lastPhaseRef.current = game.phase

    if (game.phase !== 'awaitingPlacement') return
    if (prevPhase === 'awaitingPlacement') return

    // Only reset at the start of placement (not while repositioning an already-placed card).
    if (game.currentRound?.placementIndex !== undefined) return

    const cardIds = timeline.cards.map((c) => c._id as string)
    itemsRef.current = cardIds
    setItems(cardIds)
    setActiveId(null)
    wasExternalDragRef.current = false
  }, [game.phase, game.currentRound?.placementIndex, timeline.cards])

  // If we're in repositioning mode and somehow don't have the mystery card in the list,
  // ensure it exists so it can be dragged/sorted.
  useEffect(() => {
    const placementIdx = game.currentRound?.placementIndex
    if (placementIdx === undefined) return
    if (items.includes(MYSTERY_CARD_ID)) return

    const cardIds = timeline.cards.map((c) => c._id as string)
    const newItems = [...cardIds]
    newItems.splice(Math.min(placementIdx, cardIds.length), 0, MYSTERY_CARD_ID)
    setItems(newItems)
  }, [game.currentRound?.placementIndex, items, timeline.cards])

  // Sync items when timeline cards change externally (preserving mystery position if present)
  useEffect(() => {
    const cardIds = timeline.cards.map((c) => c._id as string)
    const hasMystery = items.includes(MYSTERY_CARD_ID)
    const mysteryIndex = hasMystery ? items.indexOf(MYSTERY_CARD_ID) : -1

    // Check if card IDs have changed
    const currentCardIds = items.filter((id) => id !== MYSTERY_CARD_ID)
    const cardsChanged =
      currentCardIds.length !== cardIds.length ||
      currentCardIds.some((id, i) => id !== cardIds[i])

    if (cardsChanged) {
      // Rebuild items, preserving the mystery card if it is currently in the list.
      if (!hasMystery) {
        setItems(cardIds)
        return
      }

      const newItems = [...cardIds]
      const insertAt = Math.min(mysteryIndex, cardIds.length)
      newItems.splice(insertAt, 0, MYSTERY_CARD_ID)
      setItems(newItems)
    }
  }, [timeline.cards, items])

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
      const id = String(event.active.id)
      setActiveId(id)
      wasExternalDragRef.current = false
    },
    [],
  )

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    const activeItemId = String(active.id)
    const overId = over ? String(over.id) : null

    if (activeItemId !== MYSTERY_CARD_ID) return
    if (!overId) return

    const currentItems = itemsRef.current
    if (currentItems.includes(MYSTERY_CARD_ID)) return

    const insertAt =
      currentItems.length === 0 && overId === TIMELINE_EMPTY_SLOT_ID
        ? 0
        : currentItems.indexOf(overId)

    if (insertAt === -1) return

    const newItems = [...currentItems]
    newItems.splice(insertAt, 0, MYSTERY_CARD_ID)

    itemsRef.current = newItems
    wasExternalDragRef.current = true
    setItems(newItems)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      const activeItemId = String(active.id)
      setActiveId(null)

      if (dragDisabled) {
        // If we inserted the mystery card from outside but placement is disabled,
        // revert it back outside.
        if (
          activeItemId === MYSTERY_CARD_ID &&
          wasExternalDragRef.current === true
        ) {
          const newItems = itemsRef.current.filter(
            (id) => id !== MYSTERY_CARD_ID,
          )
          itemsRef.current = newItems
          setItems(newItems)
        }
        wasExternalDragRef.current = false
        return
      }

      // Dropped outside any droppable: if this was an "external insert" attempt,
      // put the card back outside.
      if (!over) {
        if (
          activeItemId === MYSTERY_CARD_ID &&
          wasExternalDragRef.current === true
        ) {
          const newItems = itemsRef.current.filter(
            (id) => id !== MYSTERY_CARD_ID,
          )
          itemsRef.current = newItems
          setItems(newItems)
        }
        wasExternalDragRef.current = false
        return
      }

      const overId = String(over.id)

      // Special-case: allow dropping into an empty timeline.
      if (
        activeItemId === MYSTERY_CARD_ID &&
        overId === TIMELINE_EMPTY_SLOT_ID
      ) {
        let newItems = itemsRef.current
        if (!newItems.includes(MYSTERY_CARD_ID)) {
          newItems = [...newItems]
          newItems.splice(0, 0, MYSTERY_CARD_ID)
          itemsRef.current = newItems
          setItems(newItems)
        }

        const newMysteryIndex = newItems.indexOf(MYSTERY_CARD_ID)
        if (newMysteryIndex !== -1 && onPlaceCard) {
          onPlaceCard(newMysteryIndex)
        }

        wasExternalDragRef.current = false
        return
      }

      const currentItems = itemsRef.current
      const oldIndex = currentItems.indexOf(activeItemId)
      const overIndex = currentItems.indexOf(overId)

      // Only handle drops over sortable items
      if (oldIndex === -1 || overIndex === -1) {
        wasExternalDragRef.current = false
        return
      }

      let newItems = currentItems
      const didMove = oldIndex !== overIndex

      if (didMove) {
        newItems = arrayMove(currentItems, oldIndex, overIndex)
        itemsRef.current = newItems
        setItems(newItems)
      }

      // Calculate the new position of the mystery card
      const newMysteryIndex = newItems.indexOf(MYSTERY_CARD_ID)
      if (
        activeItemId === MYSTERY_CARD_ID &&
        newMysteryIndex !== -1 &&
        onPlaceCard &&
        (didMove || wasExternalDragRef.current === true)
      ) {
        onPlaceCard(newMysteryIndex)
      }

      wasExternalDragRef.current = false
    },
    [dragDisabled, onPlaceCard],
  )

  const isDragging = activeId === MYSTERY_CARD_ID
  const showExternalMysteryCard = !items.includes(MYSTERY_CARD_ID)

  // Create a map of card data for quick lookup
  const cardDataMap = useMemo(() => {
    const map = new Map<string, TimelineData['cards'][0]>()
    for (const card of timeline.cards) {
      map.set(card._id as string, card)
    }
    return map
  }, [timeline.cards])

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[snapCenterToCursor]}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items}
            strategy={horizontalListSortingStrategy}
          >
            <div className="space-y-2">
              {showExternalMysteryCard && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    To place
                  </Badge>
                  <ExternalMysteryCard disabled={dragDisabled} />
                  <span className="text-xs text-muted-foreground">
                    Drag into timeline
                  </span>
                </div>
              )}

              <div
                className={cn(
                  '-m-1 flex gap-2 overflow-x-auto p-1',
                  // Subtle highlight while dragging the (external) mystery card toward the timeline.
                  isDragging &&
                    showExternalMysteryCard &&
                    'rounded-md ring-1 ring-primary/30',
                )}
              >
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

                    return (
                      <SortableTimelineCard key={id} id={id} card={card} />
                    )
                  })
                )}
              </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Sortable components for editable mode
// ─────────────────────────────────────────────────────────────────────────────

function TimelineEmptyDropSlot({ disabled }: { disabled?: boolean }) {
  const { isOver, setNodeRef } = useDroppable({
    id: TIMELINE_EMPTY_SLOT_ID,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-40 w-28 shrink-0 items-center justify-center rounded-md border-2 border-dashed text-center',
        isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
        disabled && 'opacity-50',
      )}
    >
      <span className="px-2 text-xs text-muted-foreground">Drop here</span>
    </div>
  )
}

function ExternalMysteryCard({ disabled }: { disabled?: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: MYSTERY_CARD_ID,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'shrink-0 touch-none cursor-grab active:cursor-grabbing',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <DraggableMysteryCard />
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

