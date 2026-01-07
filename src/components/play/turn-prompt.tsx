import {
  CardsIcon,
  CursorClickIcon,
  EyeIcon,
  HourglassIcon,
} from '@phosphor-icons/react'

import type { GameData, PlayerData } from './types'
import { cn } from '@/lib/utils'

interface TurnPromptProps {
  game: GameData
  activePlayer: PlayerData | undefined
  isActivePlayer: boolean
}

export function TurnPrompt({
  game,
  activePlayer,
  isActivePlayer,
}: TurnPromptProps) {
  const { phase } = game
  const playerName = activePlayer?.displayName ?? 'Someone'

  const { message, icon: Icon } = getPromptContent(
    phase,
    isActivePlayer,
    playerName,
  )

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-center',
        isActivePlayer
          ? 'bg-primary/10 text-primary'
          : 'bg-muted/50 text-muted-foreground',
      )}
    >
      <Icon
        weight="duotone"
        className={cn('size-5 shrink-0', isActivePlayer && 'animate-pulse')}
      />
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

function getPromptContent(
  phase: GameData['phase'],
  isActivePlayer: boolean,
  playerName: string,
): { message: string; icon: typeof HourglassIcon } {
  switch (phase) {
    case 'awaitingPlacement':
      return isActivePlayer
        ? { message: 'Place your card in the timeline!', icon: CursorClickIcon }
        : { message: `${playerName} is deciding...`, icon: HourglassIcon }

    case 'awaitingReveal':
      return isActivePlayer
        ? { message: 'Ready to reveal the answer?', icon: EyeIcon }
        : { message: `${playerName} is about to reveal...`, icon: EyeIcon }

    case 'revealed':
      return { message: "Let's see the result!", icon: CardsIcon }

    default:
      return { message: 'Get ready...', icon: HourglassIcon }
  }
}
