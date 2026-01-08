import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { GameData, PlayerData, TimelineData } from '@/components/play/types'
import { MYSTERY_CARD_ID } from '@/components/play/mystery-card-stack'

// ============================================
// Types
// ============================================

interface DndState {
  items: Array<string>
  activeId: string | null
  wasExternalDrag: boolean
}

interface ActionState {
  loading: boolean
  error: string | null
}

interface DerivedGameState {
  activePlayer: PlayerData | undefined
  isActivePlayer: boolean
  myPlayer: PlayerData | undefined
  isHost: boolean
  activePlayerTimeline: TimelineData | undefined
}

interface PlayGameState {
  // Source data (synced from React Query)
  game: GameData | null
  timelines: Array<TimelineData>

  // DnD state
  dnd: DndState

  // Action/mutation state
  action: ActionState

  // Animation state
  isExiting: boolean

  // Derived state (computed from game)
  derived: DerivedGameState
}

interface PlayGameActions {
  // Sync actions (called when React Query data changes)
  setGame: (game: GameData | null) => void
  setTimelines: (timelines: Array<TimelineData>) => void

  // DnD actions
  setDndItems: (items: Array<string>) => void
  setDndActiveId: (id: string | null) => void
  setWasExternalDrag: (value: boolean) => void
  resetDndState: () => void
  insertMysteryCard: (index: number) => void
  removeMysteryCard: () => void

  // Action state
  setActionLoading: (loading: boolean) => void
  setActionError: (error: string | null) => void
  clearActionError: () => void
  wrapAction: <T>(action: () => Promise<T>) => Promise<T>

  // Animation
  setIsExiting: (isExiting: boolean) => void
  triggerExitAnimation: () => Promise<void>
}

export type PlayGameStore = PlayGameState & PlayGameActions

// ============================================
// Derived State Computation
// ============================================

const computeDerivedState = (
  game: GameData | null,
  timelines: Array<TimelineData>,
): DerivedGameState => {
  if (!game) {
    return {
      activePlayer: undefined,
      isActivePlayer: false,
      myPlayer: undefined,
      isHost: false,
      activePlayerTimeline: undefined,
    }
  }

  const activePlayer = game.players.find(
    (p) => p.seatIndex === game.currentTurnSeatIndex,
  )
  const isHost = game.isCurrentUserHost
  const isActivePlayer =
    activePlayer?.isCurrentUser ||
    (activePlayer?.kind === 'local' && isHost)
  const myPlayer = game.players.find((p) => p.isCurrentUser)
  const activePlayerTimeline = timelines.find(
    (t) => t.playerId === activePlayer?._id,
  )

  return {
    activePlayer,
    isActivePlayer: !!isActivePlayer,
    myPlayer,
    isHost,
    activePlayerTimeline,
  }
}

// ============================================
// Initial DnD Items Computation
// ============================================

const computeInitialDndItems = (
  game: GameData | null,
  timelines: Array<TimelineData>,
): Array<string> => {
  if (!game) return []

  const activePlayer = game.players.find(
    (p) => p.seatIndex === game.currentTurnSeatIndex,
  )
  const activePlayerTimeline = timelines.find(
    (t) => t.playerId === activePlayer?._id,
  )

  const cardIds = activePlayerTimeline?.cards.map((c) => c._id as string) ?? []
  const placementIdx = game.currentRound?.placementIndex

  // If repositioning (card already placed), include mystery card at placement index
  if (placementIdx !== undefined) {
    const items = [...cardIds]
    items.splice(Math.min(placementIdx, cardIds.length), 0, MYSTERY_CARD_ID)
    return items
  }

  return cardIds
}

// ============================================
// Store
// ============================================

export const usePlayGameStore = create<PlayGameStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    game: null,
    timelines: [],
    dnd: {
      items: [],
      activeId: null,
      wasExternalDrag: false,
    },
    action: {
      loading: false,
      error: null,
    },
    isExiting: false,
    derived: {
      activePlayer: undefined,
      isActivePlayer: false,
      myPlayer: undefined,
      isHost: false,
      activePlayerTimeline: undefined,
    },

    // Sync actions - only update game/timelines and derived state
    // DnD state is managed by effects in GameControlsBar to avoid circular updates
    setGame: (game) => {
      const { timelines } = get()
      set({
        game,
        derived: computeDerivedState(game, timelines),
      })
    },

    setTimelines: (timelines) => {
      const { game } = get()
      set({
        timelines,
        derived: computeDerivedState(game, timelines),
      })
    },

    // DnD actions
    setDndItems: (items) => {
      set({ dnd: { ...get().dnd, items } })
    },

    setDndActiveId: (activeId) => {
      set({ dnd: { ...get().dnd, activeId } })
    },

    setWasExternalDrag: (wasExternalDrag) => {
      set({ dnd: { ...get().dnd, wasExternalDrag } })
    },

    resetDndState: () => {
      const { game, timelines } = get()
      set({
        dnd: {
          items: computeInitialDndItems(game, timelines),
          activeId: null,
          wasExternalDrag: false,
        },
      })
    },

    insertMysteryCard: (index) => {
      const { dnd } = get()
      if (dnd.items.includes(MYSTERY_CARD_ID)) return

      const newItems = [...dnd.items]
      newItems.splice(index, 0, MYSTERY_CARD_ID)
      set({
        dnd: {
          ...dnd,
          items: newItems,
          wasExternalDrag: true,
        },
      })
    },

    removeMysteryCard: () => {
      const { dnd } = get()
      const newItems = dnd.items.filter((id) => id !== MYSTERY_CARD_ID)
      set({
        dnd: {
          ...dnd,
          items: newItems,
        },
      })
    },

    // Action state
    setActionLoading: (loading) => {
      set({ action: { ...get().action, loading } })
    },

    setActionError: (error) => {
      set({ action: { ...get().action, error } })
    },

    clearActionError: () => {
      set({ action: { ...get().action, error: null } })
    },

    wrapAction: async (action) => {
      const { setActionLoading, setActionError } = get()
      setActionError(null)
      setActionLoading(true)
      try {
        const result = await action()
        return result
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Action failed')
        throw err
      } finally {
        setActionLoading(false)
      }
    },

    // Animation
    setIsExiting: (isExiting) => {
      set({ isExiting })
    },

    triggerExitAnimation: async () => {
      set({ isExiting: true })
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 400)
      })
    },
  })),
)

// ============================================
// Selector Hooks
// ============================================

// Derived state selectors
export const useActivePlayer = () =>
  usePlayGameStore((state) => state.derived.activePlayer)

export const useIsActivePlayer = () =>
  usePlayGameStore((state) => state.derived.isActivePlayer)

export const useMyPlayer = () =>
  usePlayGameStore((state) => state.derived.myPlayer)

export const useIsHost = () =>
  usePlayGameStore((state) => state.derived.isHost)

export const useActivePlayerTimeline = () =>
  usePlayGameStore((state) => state.derived.activePlayerTimeline)

// Game/timelines selectors
export const useGame = () => usePlayGameStore((state) => state.game)

export const useTimelines = () => usePlayGameStore((state) => state.timelines)

// DnD selectors
export const useDndState = () => usePlayGameStore((state) => state.dnd)

// Individual DnD action selectors to avoid creating new objects
export const useSetDndItems = () =>
  usePlayGameStore((state) => state.setDndItems)

export const useSetDndActiveId = () =>
  usePlayGameStore((state) => state.setDndActiveId)

export const useSetWasExternalDrag = () =>
  usePlayGameStore((state) => state.setWasExternalDrag)

export const useResetDndState = () =>
  usePlayGameStore((state) => state.resetDndState)

// Action state selectors
export const useActionState = () => usePlayGameStore((state) => state.action)

export const useWrapAction = () => usePlayGameStore((state) => state.wrapAction)

// Animation selectors
export const useIsExiting = () => usePlayGameStore((state) => state.isExiting)

export const useTriggerExitAnimation = () =>
  usePlayGameStore((state) => state.triggerExitAnimation)

