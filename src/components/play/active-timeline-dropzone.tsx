import {
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useState } from 'react'
import type { Modifier } from '@dnd-kit/core'
import { GameCard } from './game-card'
import { DraggableMysteryCard } from './round-timeline-card'
import type { DragEndEvent } from '@dnd-kit/core'
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
}

export function ActiveTimelineDropzone({
  timeline,
  onPlaceCard,
  disabled,
}: ActiveTimelineDropzoneProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event
    setActiveId(null)

    if (over && !disabled) {
      // Parse the drop target index from the droppable ID
      const dropId = String(over.id)
      if (dropId.startsWith('drop-slot-')) {
        const insertIndex = parseInt(dropId.replace('drop-slot-', ''), 10)
        if (!isNaN(insertIndex)) {
          onPlaceCard(insertIndex)
        }
      }
    }
  }

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveId(String(event.active.id))
  }

  const isDragging = activeId === MYSTERY_CARD_ID

  return (
    <DndContext
      sensors={sensors}
      modifiers={[snapCenterToCursor]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3">
        {/* Timeline drop target area */}
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-3">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Drag the mystery card to your timeline
          </p>
          <TimelineDropArea
            cards={timeline.cards}
            isDragging={isDragging}
            disabled={disabled}
          />
        </div>

        {/* Draggable mystery card */}
        <div className="flex justify-center">
          <DraggableMysteryCardWrapper
            disabled={disabled}
            isDragging={isDragging}
          />
        </div>
      </div>

      {/* Drag overlay - follows cursor during drag */}
      <DragOverlay dropAnimation={null}>
        {isDragging && <DraggableMysteryCard />}
      </DragOverlay>
    </DndContext>
  )
}

interface DraggableMysteryCardWrapperProps {
  disabled?: boolean
  isDragging?: boolean
}

function DraggableMysteryCardWrapper({
  disabled,
  isDragging,
}: DraggableMysteryCardWrapperProps) {
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
        'touch-none cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <DraggableMysteryCard />
    </div>
  )
}

interface TimelineDropAreaProps {
  cards: TimelineData['cards']
  isDragging: boolean
  disabled?: boolean
}

function TimelineDropArea({
  cards,
  isDragging,
  disabled,
}: TimelineDropAreaProps) {
  // If no cards, show a single drop zone for index 0
  if (cards.length === 0) {
    return (
      <div className="flex justify-center">
        <DropSlot index={0} isActive={isDragging} disabled={disabled} isEmpty />
      </div>
    )
  }

  // Render cards with drop slots between them
  return (
    <div className="flex items-center overflow-x-auto py-1">
      {/* Drop slot before first card */}
      <DropSlot index={0} isActive={isDragging} disabled={disabled} />

      {cards.map((card, cardIndex) => (
        <div key={card._id} className="flex shrink-0 items-center">
          <GameCard
            title={card.title}
            releaseYear={card.releaseYear}
            artistName={card.artistNames[0]}
            albumImageUrl={card.albumImageUrl}
            className="pointer-events-none"
          />
          {/* Drop slot after this card */}
          <DropSlot
            index={cardIndex + 1}
            isActive={isDragging}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  )
}

interface DropSlotProps {
  index: number
  isActive: boolean
  disabled?: boolean
  isEmpty?: boolean
}

function DropSlot({ index, isActive, disabled, isEmpty }: DropSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `drop-slot-${index}`,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200',
        // Size: larger when empty timeline, medium when dragging, visible otherwise
        isEmpty ? 'h-40 w-28' : isActive ? 'mx-1 h-36 w-10' : 'mx-0.5 h-28 w-4',
        // Colors: show target when dragging
        isActive
          ? 'border-primary/60 bg-primary/10'
          : 'border-muted-foreground/30 bg-muted/30',
        // Hover/over state - expand and highlight
        isOver && 'border-primary bg-primary/25 w-14! scale-105',
      )}
    >
      {isEmpty && (
        <span className="text-xs text-muted-foreground">
          {isActive ? 'Drop here' : 'Empty timeline'}
        </span>
      )}
    </div>
  )
}
