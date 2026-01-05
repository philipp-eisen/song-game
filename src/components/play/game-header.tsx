import { useState } from 'react'
import { CheckIcon, LinkIcon } from '@phosphor-icons/react'
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
    const url = `${window.location.origin}/play/${game.joinCode}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">
          {game.playlistName ?? 'Song Game'}
        </h1>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground">
            Code: <span className="font-mono text-lg">{game.joinCode}</span>
          </p>
          {game.phase === 'lobby' && game.mode === 'sidecars' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="h-7 gap-1.5 px-2"
            >
              {copied ? (
                <CheckIcon weight="duotone" className="size-4 text-green-500" />
              ) : (
                <LinkIcon weight="duotone" className="size-4" />
              )}
              <span className="text-xs">{copied ? 'Copied!' : 'Copy Link'}</span>
            </Button>
          )}
        </div>
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

