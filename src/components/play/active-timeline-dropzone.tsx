import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useMemo, useState } from 'react'
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
import { GameCard } from './game-card'
import { DraggableMysteryCard } from './round-timeline-card'

import type { DragEndEvent, Modifier } from '@dnd-kit/core'
import type { TimelineData } from './types'
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

interface ActiveTimelineDropzoneProps {
  timeline: TimelineData
  onPlaceCard: (insertIndex: number) => void
  disabled?: boolean
  /** Current placement index (for repositioning during awaitingReveal) */
  currentPlacementIndex?: number
}

export function ActiveTimelineDropzone({
  timeline,
  onPlaceCard,
  disabled,
  currentPlacementIndex,
}: ActiveTimelineDropzoneProps) {
  const isRepositioning = currentPlacementIndex !== undefined

  // Build the sortable items list:
  // - Timeline card IDs (as strings for sortable)
  // - Plus the mystery card at the appropriate position
  const initialItems = useMemo(() => {
    const cardIds = timeline.cards.map((c) => c._id as string)

    if (isRepositioning) {
      // Insert mystery card at its current placement position
      const items = [...cardIds]
      items.splice(currentPlacementIndex, 0, MYSTERY_CARD_ID)
      return items
    }

    // Not repositioning - mystery card starts at the end
    return [...cardIds, MYSTERY_CARD_ID]
  }, [timeline.cards, currentPlacementIndex, isRepositioning])

  const [items, setItems] = useState<Array<string>>(initialItems)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sync items when timeline cards change externally
  useMemo(() => {
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
      setActiveId(String(event.active.id))
    },
    [],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || disabled) return

      const oldIndex = items.indexOf(String(active.id))
      const overIndex = items.indexOf(String(over.id))

      if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
        const newItems = arrayMove(items, oldIndex, overIndex)
        setItems(newItems)

        // Calculate the new position of the mystery card
        const newMysteryIndex = newItems.indexOf(MYSTERY_CARD_ID)
        if (newMysteryIndex !== -1) {
          onPlaceCard(newMysteryIndex)
        }
      }
    },
    [items, disabled, onPlaceCard],
  )

  const isDragging = activeId === MYSTERY_CARD_ID

  // Create a map of card data for quick lookup
  const cardDataMap = useMemo(() => {
    const map = new Map<string, TimelineData['cards'][0]>()
    for (const card of timeline.cards) {
      map.set(card._id as string, card)
    }
    return map
  }, [timeline.cards])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[snapCenterToCursor]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3">
        {/* Timeline sortable area */}
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-3">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            {isRepositioning
              ? 'Drag the mystery card to reposition it before reveal'
              : 'Drag the mystery card to the correct spot in your timeline'}
          </p>

          <SortableContext
            items={items}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
              {items.map((id) => {
                if (id === MYSTERY_CARD_ID) {
                  return (
                    <SortableMysteryCard
                      key={id}
                      disabled={disabled}
                      isDragging={isDragging}
                    />
                  )
                }

                const card = cardDataMap.get(id)
                if (!card) return null

                return <SortableTimelineCard key={id} id={id} card={card} />
              })}
            </div>
          </SortableContext>
        </div>
      </div>

      {/* Drag overlay - follows cursor during drag */}
      <DragOverlay dropAnimation={null}>
        {isDragging && <DraggableMysteryCard />}
      </DragOverlay>
    </DndContext>
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
