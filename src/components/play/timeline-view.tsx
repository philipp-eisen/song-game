import {
  TimelineViewEditable,
  type TimelineViewEditableProps,
} from './timeline-view-editable'
import {
  TimelineViewReadonly,
  type TimelineViewReadonlyProps,
} from './timeline-view-readonly'

import type { CardData, GameData, TimelineData } from './types'

export interface TimelineViewProps {
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

/**
 * TimelineView renders a player's timeline of cards.
 *
 * When `editable` is true, it renders the drag-and-drop editable version.
 * Otherwise, it renders the read-only version that shows placed cards and
 * the current round placeholder.
 */
export function TimelineView({
  timeline,
  game,
  isActivePlayer,
  currentCard,
  editable = false,
  onPlaceCard,
  dragDisabled = false,
}: TimelineViewProps) {
  if (editable) {
    return (
      <TimelineViewEditable
        timeline={timeline}
        game={game}
        isActivePlayer={isActivePlayer}
        onPlaceCard={onPlaceCard}
        dragDisabled={dragDisabled}
      />
    )
  }

  return (
    <TimelineViewReadonly
      timeline={timeline}
      game={game}
      isActivePlayer={isActivePlayer}
      currentCard={currentCard}
    />
  )
}

// Re-export the sub-components and their prop types for direct use if needed
export { TimelineViewEditable, TimelineViewReadonly }
export type { TimelineViewEditableProps, TimelineViewReadonlyProps }
