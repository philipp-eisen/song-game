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
import { useMutation } from 'convex/react'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { MusicNoteIcon } from '@phosphor-icons/react'

import { api } from '../../../convex/_generated/api'
import { BetControls } from './bet-controls'
import { MYSTERY_CARD_ID, MysteryCardStack } from './mystery-card-stack'
import { PlayerStatusBar } from './player-status-bar'
import { DraggableMysteryCard } from './round-timeline-card'
import { TimelineDropArea } from './timeline-drop-area'
import { TimelineViewReadonly } from './timeline-view-readonly'

import type { DragEndEvent, DragOverEvent, Modifier } from '@dnd-kit/core'
import type { GameData, TimelineData } from './types'
import {
  getCurrentRoundCardQuery,
  getCurrentRoundSongPreviewQuery,
} from '@/lib/convex-queries'
import { PreviewPlayer } from '@/components/preview-player'
import {
  useActionState,
  useActivePlayer,
  useActivePlayerTimeline,
  useDndState,
  useIsActivePlayer,
  useIsExiting,
  useMyPlayer,
  usePlayGameStore,
  useSetDndActiveId,
  useSetDndItems,
  useSetWasExternalDrag,
} from '@/stores/play-game-store'

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

interface GameControlsBarProps {
  game: GameData
  timelines: Array<TimelineData>
}

export function GameControlsBar({ game, timelines }: GameControlsBarProps) {
  const { data: songPreview } = useQuery(
    getCurrentRoundSongPreviewQuery(game._id),
  )
  const { data: currentCard } = useQuery(getCurrentRoundCardQuery(game._id))

  // Get derived state from store
  const activePlayer = useActivePlayer()
  const isActivePlayer = useIsActivePlayer()
  const myPlayer = useMyPlayer()
  const activePlayerTimeline = useActivePlayerTimeline()

  // Get DnD state from store
  const { items, activeId, wasExternalDrag } = useDndState()
  const setDndItems = useSetDndItems()
  const setDndActiveId = useSetDndActiveId()
  const setWasExternalDrag = useSetWasExternalDrag()

  // Get action state from store
  const { loading: isPlacing, error: placementError } = useActionState()

  // Get animation state from store
  const isExiting = useIsExiting()

  const shouldShowDropzone =
    isActivePlayer &&
    (game.phase === 'awaitingPlacement' || game.phase === 'awaitingReveal') &&
    !!activePlayer

  const placeCard = useMutation(api.turns.placeCard)

  // We need a ref to access current items in DnD callbacks without stale closures
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // DnD Sync Effects - Two coordinated effects handle timeline synchronization:
  //
  // Effect 1 (below): Syncs DnD items when timeline cards change from server.
  //   - Filters out mystery card before comparing to detect actual card changes
  //   - Preserves mystery card position during repositioning (placementIndex set)
  //
  // Effect 2 (further below): Ensures mystery card exists during repositioning.
  //   - Only runs when placementIndex is defined but mystery card is missing
  //   - Handles the case where repositioning starts after cards are already synced

  // Effect 1: Sync DnD items when timeline cards change (handle external server updates)
  useEffect(() => {
    const cardIds = activePlayerTimeline?.cards.map((c) => c._id as string) ?? []
    const currentCardIds = items.filter((id) => id !== MYSTERY_CARD_ID)
    const cardsChanged =
      currentCardIds.length !== cardIds.length ||
      currentCardIds.some((id, i) => id !== cardIds[i])

    if (cardsChanged) {
      // Only preserve mystery card position if we're repositioning an already-placed card
      const shouldPreserveMystery =
        items.includes(MYSTERY_CARD_ID) &&
        game.currentRound?.placementIndex !== undefined

      if (!shouldPreserveMystery) {
        setDndItems(cardIds)
        return
      }

      const mysteryIndex = items.indexOf(MYSTERY_CARD_ID)
      const newItems = [...cardIds]
      const insertAt = Math.min(mysteryIndex, cardIds.length)
      newItems.splice(insertAt, 0, MYSTERY_CARD_ID)
      setDndItems(newItems)
    }
  }, [activePlayerTimeline?.cards, items, game.currentRound?.placementIndex, setDndItems])

  // Effect 2: Ensure mystery card is in list during repositioning
  // This handles the case when placementIndex becomes defined after Effect 1 has run
  useEffect(() => {
    const placementIdx = game.currentRound?.placementIndex
    if (placementIdx === undefined) return
    if (items.includes(MYSTERY_CARD_ID)) return

    const cardIds = activePlayerTimeline?.cards.map((c) => c._id as string) ?? []
    const newItems = [...cardIds]
    newItems.splice(Math.min(placementIdx, cardIds.length), 0, MYSTERY_CARD_ID)
    setDndItems(newItems)
  }, [game.currentRound?.placementIndex, items, activePlayerTimeline?.cards, setDndItems])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  // Get wrapAction from store for placement
  const wrapAction = usePlayGameStore((state) => state.wrapAction)

  const handlePlaceCard = useCallback(async (insertIndex: number) => {
    if (!activePlayer) return

    try {
      await wrapAction(async () => {
        await placeCard({
          gameId: game._id,
          actingPlayerId: activePlayer._id,
          insertIndex,
        })
      })
    } catch {
      // Error is already handled by wrapAction
    }
  }, [activePlayer, game._id, placeCard, wrapAction])

  const handleDragStart = useCallback(
    (event: { active: { id: string | number } }) => {
      setDndActiveId(String(event.active.id))
      setWasExternalDrag(false)
    },
    [setDndActiveId, setWasExternalDrag],
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
      currentItems.length === 0 && overId === 'timeline-empty-slot'
        ? 0
        : currentItems.indexOf(overId)

    if (insertAt === -1) return

    const newItems = [...currentItems]
    newItems.splice(insertAt, 0, MYSTERY_CARD_ID)
    itemsRef.current = newItems
    setWasExternalDrag(true)
    setDndItems(newItems)
  }, [setWasExternalDrag, setDndItems])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      const activeItemId = String(active.id)
      setDndActiveId(null)

      if (isPlacing) {
        if (activeItemId === MYSTERY_CARD_ID && wasExternalDrag) {
          const newItems = itemsRef.current.filter((id) => id !== MYSTERY_CARD_ID)
          itemsRef.current = newItems
          setDndItems(newItems)
        }
        setWasExternalDrag(false)
        return
      }

      if (!over) {
        if (activeItemId === MYSTERY_CARD_ID && wasExternalDrag) {
          const newItems = itemsRef.current.filter((id) => id !== MYSTERY_CARD_ID)
          itemsRef.current = newItems
          setDndItems(newItems)
        }
        setWasExternalDrag(false)
        return
      }

      const overId = String(over.id)

      // Handle drop into empty timeline
      if (activeItemId === MYSTERY_CARD_ID && overId === 'timeline-empty-slot') {
        let newItems = itemsRef.current
        if (!newItems.includes(MYSTERY_CARD_ID)) {
          newItems = [MYSTERY_CARD_ID]
          itemsRef.current = newItems
          setDndItems(newItems)
        }
        const newMysteryIndex = newItems.indexOf(MYSTERY_CARD_ID)
        if (newMysteryIndex !== -1) {
          handlePlaceCard(newMysteryIndex)
        }
        setWasExternalDrag(false)
        return
      }

      const currentItems = itemsRef.current
      const oldIndex = currentItems.indexOf(activeItemId)
      const overIndex = currentItems.indexOf(overId)

      if (oldIndex === -1 || overIndex === -1) {
        setWasExternalDrag(false)
        return
      }

      let newItems = currentItems
      const didMove = oldIndex !== overIndex

      if (didMove) {
        // arrayMove logic inline
        const result = [...currentItems]
        const [removed] = result.splice(oldIndex, 1)
        result.splice(overIndex, 0, removed)
        newItems = result
        itemsRef.current = newItems
        setDndItems(newItems)
      }

      const newMysteryIndex = newItems.indexOf(MYSTERY_CARD_ID)
      if (
        activeItemId === MYSTERY_CARD_ID &&
        newMysteryIndex !== -1 &&
        (didMove || wasExternalDrag)
      ) {
        handlePlaceCard(newMysteryIndex)
      }

      setWasExternalDrag(false)
    },
    [isPlacing, wasExternalDrag, handlePlaceCard, setDndActiveId, setDndItems, setWasExternalDrag],
  )

  const isDragging = activeId === MYSTERY_CARD_ID
  const isCardPlaced = items.includes(MYSTERY_CARD_ID)

  // Card stack is only draggable during placement phases when it's the active player's turn
  const canDragCard =
    isActivePlayer &&
    (game.phase === 'awaitingPlacement' || game.phase === 'awaitingReveal') &&
    !isCardPlaced &&
    !isPlacing

  // Cards remaining in the deck
  const cardsRemaining = game.deckRemaining

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[snapCenterToCursor]}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Audio Player - outside animation to preserve playback */}
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-primary/15 p-4">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/20">
              <MusicNoteIcon
                weight="duotone"
                className="size-7 animate-pulse text-primary"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-primary">Mystery Song</p>
              <p className="truncate text-sm text-muted-foreground">
                Listen and place it on your timeline
              </p>
            </div>
          </div>
          <div className="mt-3">
            <PreviewPlayer
              previewUrl={songPreview?.previewUrl}
              appleMusicId={songPreview?.appleMusicId}
              autoPlay
            />
          </div>
        </div>
      </div>

      {/* Player status bar - stays in place, highlight animates between players */}
      <PlayerStatusBar game={game} timelines={timelines} />

      {/* Play area card - card and stack stay in place, only timeline animates */}
      {activePlayerTimeline && shouldShowDropzone ? (
        <TimelineDropArea
          timeline={activePlayerTimeline}
          items={items}
          isActivePlayer={true}
          isDragging={isDragging}
          isCardPlaced={isCardPlaced}
          dragDisabled={isPlacing}
          cardStack={
            <MysteryCardStack
              key={`${canDragCard}-${game.currentRound?.card?.title ?? 'none'}`}
              cardsRemaining={cardsRemaining}
              disabled={!canDragCard}
            />
          }
        />
      ) : activePlayerTimeline ? (
        <TimelineViewReadonly
          timeline={activePlayerTimeline}
          game={game}
          isActivePlayer={true}
          currentCard={currentCard}
          cardStack={
            <MysteryCardStack
              key={`${canDragCard}-${game.currentRound?.card?.title ?? 'none'}`}
              cardsRemaining={cardsRemaining}
              disabled={!canDragCard}
            />
          }
          isExiting={isExiting}
        />
      ) : null}

      {placementError && (
        <p className="text-center text-sm text-destructive">
          {placementError}
        </p>
      )}

      {/* Betting controls for non-active players */}
      {!isActivePlayer &&
        game.useTokens &&
        myPlayer &&
        myPlayer.tokenBalance >= 1 &&
        (game.phase === 'awaitingPlacement' ||
          game.phase === 'awaitingReveal') && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {game.phase === 'awaitingReveal'
                ? 'Last chance to place your bet!'
                : 'Bet on where the card should go (costs 1 token)'}
            </p>
            <BetControls game={game} />
          </div>
        )}

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {isDragging && <DraggableMysteryCard />}
      </DragOverlay>
    </DndContext>
  )
}
