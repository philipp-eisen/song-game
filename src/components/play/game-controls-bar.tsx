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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MusicNoteIcon } from '@phosphor-icons/react'

import { api } from '../../../convex/_generated/api'
import { ActionButtons } from './action-zone'
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

  const isHost = game.isCurrentUserHost

  const activePlayer = game.players.find(
    (p) => p.seatIndex === game.currentTurnSeatIndex,
  )
  const isActivePlayer =
    activePlayer?.isCurrentUser || (activePlayer?.kind === 'local' && isHost)

  const shouldShowDropzone =
    isActivePlayer &&
    (game.phase === 'awaitingPlacement' || game.phase === 'awaitingReveal') &&
    !!activePlayer

  const activePlayerTimeline = timelines.find(
    (t) => t.playerId === activePlayer?._id,
  )

  const placeCard = useMutation(api.turns.placeCard)
  const [placementError, setPlacementError] = useState<string | null>(null)
  const [isPlacing, setIsPlacing] = useState(false)

  // Drag-and-drop state management
  const { currentRound } = game
  const isRepositioning = currentRound?.placementIndex !== undefined

  const initialItems = useMemo(() => {
    const cardIds = activePlayerTimeline?.cards.map((c) => c._id as string) ?? []
    const placementIdx = currentRound?.placementIndex
    if (isRepositioning && placementIdx !== undefined) {
      const items = [...cardIds]
      items.splice(placementIdx, 0, MYSTERY_CARD_ID)
      return items
    }
    return cardIds
  }, [activePlayerTimeline?.cards, currentRound?.placementIndex, isRepositioning])

  const [items, setItems] = useState<Array<string>>(initialItems)
  const [activeId, setActiveId] = useState<string | null>(null)
  const wasExternalDragRef = useRef(false)
  const itemsRef = useRef(items)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Reset state when entering placement phase
  const lastPhaseRef = useRef<GameData['phase']>(game.phase)
  useEffect(() => {
    const prevPhase = lastPhaseRef.current
    lastPhaseRef.current = game.phase

    if (game.phase !== 'awaitingPlacement') return
    if (prevPhase === 'awaitingPlacement') return
    if (game.currentRound?.placementIndex !== undefined) return

    const cardIds = activePlayerTimeline?.cards.map((c) => c._id as string) ?? []
    itemsRef.current = cardIds
    setItems(cardIds)
    setActiveId(null)
    wasExternalDragRef.current = false
  }, [game.phase, game.currentRound?.placementIndex, activePlayerTimeline?.cards])

  // Ensure mystery card is in list during repositioning
  useEffect(() => {
    const placementIdx = game.currentRound?.placementIndex
    if (placementIdx === undefined) return
    if (items.includes(MYSTERY_CARD_ID)) return

    const cardIds = activePlayerTimeline?.cards.map((c) => c._id as string) ?? []
    const newItems = [...cardIds]
    newItems.splice(Math.min(placementIdx, cardIds.length), 0, MYSTERY_CARD_ID)
    setItems(newItems)
  }, [game.currentRound?.placementIndex, items, activePlayerTimeline?.cards])

  // Sync items when timeline cards change
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
        setItems(cardIds)
        return
      }

      const mysteryIndex = items.indexOf(MYSTERY_CARD_ID)
      const newItems = [...cardIds]
      const insertAt = Math.min(mysteryIndex, cardIds.length)
      newItems.splice(insertAt, 0, MYSTERY_CARD_ID)
      setItems(newItems)
    }
  }, [activePlayerTimeline?.cards, items, game.currentRound?.placementIndex])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const handlePlaceCard = useCallback(async (insertIndex: number) => {
    if (!activePlayer) return

    setPlacementError(null)
    setIsPlacing(true)
    try {
      await placeCard({
        gameId: game._id,
        actingPlayerId: activePlayer._id,
        insertIndex,
      })
    } catch (err) {
      setPlacementError(err instanceof Error ? err.message : 'Placement failed')
    } finally {
      setIsPlacing(false)
    }
  }, [activePlayer, game._id, placeCard])

  const handleDragStart = useCallback(
    (event: { active: { id: string | number } }) => {
      setActiveId(String(event.active.id))
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
      currentItems.length === 0 && overId === 'timeline-empty-slot'
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

      if (isPlacing) {
        if (activeItemId === MYSTERY_CARD_ID && wasExternalDragRef.current) {
          const newItems = itemsRef.current.filter((id) => id !== MYSTERY_CARD_ID)
          itemsRef.current = newItems
          setItems(newItems)
        }
        wasExternalDragRef.current = false
        return
      }

      if (!over) {
        if (activeItemId === MYSTERY_CARD_ID && wasExternalDragRef.current) {
          const newItems = itemsRef.current.filter((id) => id !== MYSTERY_CARD_ID)
          itemsRef.current = newItems
          setItems(newItems)
        }
        wasExternalDragRef.current = false
        return
      }

      const overId = String(over.id)

      // Handle drop into empty timeline
      if (activeItemId === MYSTERY_CARD_ID && overId === 'timeline-empty-slot') {
        let newItems = itemsRef.current
        if (!newItems.includes(MYSTERY_CARD_ID)) {
          newItems = [MYSTERY_CARD_ID]
          itemsRef.current = newItems
          setItems(newItems)
        }
        const newMysteryIndex = newItems.indexOf(MYSTERY_CARD_ID)
        if (newMysteryIndex !== -1) {
          handlePlaceCard(newMysteryIndex)
        }
        wasExternalDragRef.current = false
        return
      }

      const currentItems = itemsRef.current
      const oldIndex = currentItems.indexOf(activeItemId)
      const overIndex = currentItems.indexOf(overId)

      if (oldIndex === -1 || overIndex === -1) {
        wasExternalDragRef.current = false
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
        setItems(newItems)
      }

      const newMysteryIndex = newItems.indexOf(MYSTERY_CARD_ID)
      if (
        activeItemId === MYSTERY_CARD_ID &&
        newMysteryIndex !== -1 &&
        (didMove || wasExternalDragRef.current)
      ) {
        handlePlaceCard(newMysteryIndex)
      }

      wasExternalDragRef.current = false
    },
    [isPlacing, handlePlaceCard],
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

  // Find current user's player for betting controls
  const myPlayer = game.players.find((p) => p.isCurrentUser)

  // Transition state for player changes
  const [isExiting, setIsExiting] = useState(false)

  const handleBeforeResolve = useCallback(async () => {
    // Start the exit animation
    setIsExiting(true)

    // Wait for exit animation to complete (match the transition duration)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 400)
    })
  }, [])

  // Reset exit state when player changes
  useEffect(() => {
    setIsExiting(false)
  }, [activePlayer?._id])

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

      {/* Action buttons - below timeline */}
      {activePlayer && (
        <div className="flex justify-center">
          <ActionButtons
            game={game}
            activePlayer={activePlayer}
            isActivePlayer={isActivePlayer}
            isHost={isHost}
            onBeforeResolve={handleBeforeResolve}
          />
        </div>
      )}

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
            <BetControls game={game} myPlayer={myPlayer} />
          </div>
        )}

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {isDragging && <DraggableMysteryCard />}
      </DragOverlay>
    </DndContext>
  )
}
