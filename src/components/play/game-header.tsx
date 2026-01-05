import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { GameData } from './types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface GameHeaderProps {
  game: GameData
}

export function GameHeader({ game }: GameHeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    const gameUrl = `${window.location.origin}/play/${game.joinCode}`
    try {
      await navigator.clipboard.writeText(gameUrl)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  // Only show join code for sidecars mode (multi-device games that can be joined)
  const showJoinCode = game.mode === 'sidecars'

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">
          {game.playlistName ?? 'Song Game'}
        </h1>
        {showJoinCode && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>
              Code: <span className="font-mono text-lg">{game.joinCode}</span>
            </span>
            {game.phase === 'lobby' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyLink}
                className="h-7 gap-1 px-2"
              >
                {copied ? (
                  <CheckIcon weight="duotone" className="size-4 text-green-500" />
                ) : (
                  <CopyIcon weight="duotone" className="size-4" />
                )}
                <span className="text-xs">Copy Link</span>
              </Button>
            )}
          </div>
        )}
      </div>
      <Badge
        variant={
          game.phase === 'lobby'
            ? 'secondary'
            : game.phase === 'finished'
              ? 'default'
              : 'outline'
        }
        className="text-sm"
      >
        {game.phase}
      </Badge>
    </div>
  )
}

