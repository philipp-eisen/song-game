import { useEffect, useRef } from 'react'
import type { GameData, TimelineData } from '@/components/play/types'
import {
  usePlayGameStore,
  useResetDndState,
} from '@/stores/play-game-store'

/**
 * Syncs React Query game and timeline data to the Zustand store.
 * Also handles phase transitions for DnD state reset.
 */
export function useSyncGameToStore(
  game: GameData | null,
  timelines: Array<TimelineData>,
) {
  const setGame = usePlayGameStore((state) => state.setGame)
  const setTimelines = usePlayGameStore((state) => state.setTimelines)
  const resetDndState = useResetDndState()
  const setIsExiting = usePlayGameStore((state) => state.setIsExiting)

  // Track previous phase for transition detection
  const lastPhaseRef = useRef<GameData['phase'] | null>(null)
  const lastActivePlayerIdRef = useRef<string | null>(null)

  // Sync game data
  useEffect(() => {
    setGame(game)
  }, [game, setGame])

  // Sync timelines
  useEffect(() => {
    setTimelines(timelines)
  }, [timelines, setTimelines])

  // Handle phase transitions - reset DnD state when entering new placement phase
  useEffect(() => {
    if (!game) return

    const prevPhase = lastPhaseRef.current
    lastPhaseRef.current = game.phase

    // Reset DnD state when entering awaitingPlacement from a different phase
    // but only if no card has been placed yet
    if (
      game.phase === 'awaitingPlacement' &&
      prevPhase !== 'awaitingPlacement' &&
      game.currentRound?.placementIndex === undefined
    ) {
      resetDndState()
    }
  }, [game, resetDndState])

  // Reset exit animation when active player changes
  useEffect(() => {
    if (!game) return

    const activePlayer = game.players.find(
      (p) => p.seatIndex === game.currentTurnSeatIndex,
    )
    const activePlayerId = activePlayer?._id ?? null

    if (lastActivePlayerIdRef.current !== activePlayerId) {
      lastActivePlayerIdRef.current = activePlayerId
      setIsExiting(false)
    }
  }, [game, setIsExiting])
}
