import {
  CursorClickIcon,
  EyeIcon,
  HourglassIcon,
} from '@phosphor-icons/react'

import { ActionButtons } from './action-zone'
import type { GameData } from './types'
import { cn } from '@/lib/utils'
import { useActivePlayer, useIsActivePlayer } from '@/stores/play-game-store'

interface GameStickyFooterProps {
  game: GameData
  onBeforeResolve?: () => Promise<void>
}

export function GameStickyFooter({
  game,
  onBeforeResolve,
}: GameStickyFooterProps) {
  const activePlayer = useActivePlayer()
  const isActivePlayer = useIsActivePlayer()

  const { phase } = game
  const playerName = activePlayer?.displayName ?? 'Someone'

  const phaseLabel = getPhaseLabel(phase, isActivePlayer, playerName)
  const PhaseIcon = getPhaseIcon(phase)

  return (
    <div className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        {/* Subtle phase indicator */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs',
            isActivePlayer ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <PhaseIcon
            weight="duotone"
            className={cn('size-3.5', isActivePlayer && 'animate-pulse')}
          />
          <span className="font-medium">{phaseLabel}</span>
        </div>

        {/* Action buttons */}
        {activePlayer && (
          <ActionButtons game={game} onBeforeResolve={onBeforeResolve} />
        )}
      </div>
    </div>
  )
}

function getPhaseLabel(
  phase: GameData['phase'],
  isActivePlayer: boolean,
  playerName: string,
): string {
  switch (phase) {
    case 'awaitingPlacement':
      return isActivePlayer ? 'Your turn' : `${playerName}'s turn`
    case 'awaitingReveal':
      return isActivePlayer ? 'Ready to reveal' : `${playerName} revealing...`
    case 'revealed':
      return 'Result'
    default:
      return ''
  }
}

function getPhaseIcon(phase: GameData['phase']) {
  switch (phase) {
    case 'awaitingPlacement':
      return CursorClickIcon
    case 'awaitingReveal':
      return EyeIcon
    case 'revealed':
      return EyeIcon
    default:
      return HourglassIcon
  }
}
