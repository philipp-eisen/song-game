import { forwardRef, useEffect, useRef } from 'react'
import { CoinIcon, StackIcon } from '@phosphor-icons/react'

import type { GameData, TimelineData } from './types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface PlayerStatusBarProps {
  game: GameData
  timelines?: Array<TimelineData> | null
}

export function PlayerStatusBar({ game, timelines }: PlayerStatusBarProps) {
  const { players, currentTurnSeatIndex, useTokens } = game
  const activePlayerRef = useRef<HTMLDivElement>(null)

  // Sort by seatIndex to maintain consistent turn order
  const sortedPlayers = [...players].sort((a, b) => a.seatIndex - b.seatIndex)

  // Auto-scroll to active player when turn changes
  useEffect(() => {
    if (activePlayerRef.current) {
      activePlayerRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }
  }, [currentTurnSeatIndex])

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 p-2 md:gap-3">
        {sortedPlayers.map((player) => {
          const isActive = player.seatIndex === currentTurnSeatIndex
          const timeline = timelines?.find((t) => t.playerId === player._id)
          const cardCount = timeline?.cards.length ?? 0

          return (
            <PlayerStatusItem
              key={player._id}
              ref={isActive ? activePlayerRef : null}
              player={player}
              cardCount={cardCount}
              isActive={isActive}
              showTokens={useTokens}
            />
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

interface PlayerStatusItemProps {
  player: GameData['players'][0]
  cardCount: number
  isActive: boolean
  showTokens: boolean
}

const PlayerStatusItem = forwardRef<HTMLDivElement, PlayerStatusItemProps>(
  function PlayerStatusItem({ player, cardCount, isActive, showTokens }, ref) {
    // Get initials from display name
    const initials = player.displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    return (
      <div
        ref={ref}
        className={cn(
          'flex min-w-[120px] flex-1 items-center gap-2 rounded-lg border p-2 transition-all duration-[400ms] ease-in-out md:min-w-[140px]',
          isActive && [
            'border-2 border-primary bg-primary/5',
            'shadow-md shadow-primary/20',
            'scale-[1.02]',
          ],
        )}
      >
        <Avatar size="sm">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
          <div className="flex items-center gap-1 truncate">
            <span className="truncate text-sm font-medium">
              {player.displayName}
            </span>
            {player.isCurrentUser && (
              <Badge className="shrink-0 px-1 text-[10px]">You</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger className="flex cursor-default items-center gap-0.5">
                <StackIcon weight="duotone" className="size-3" />
                {cardCount}
              </TooltipTrigger>
              <TooltipContent>Cards in timeline</TooltipContent>
            </Tooltip>
            {showTokens && (
              <Tooltip>
                <TooltipTrigger className="flex cursor-default items-center gap-0.5">
                  <CoinIcon weight="duotone" className="size-3" />
                  {player.tokenBalance}
                </TooltipTrigger>
                <TooltipContent>Tokens</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    )
  },
)
