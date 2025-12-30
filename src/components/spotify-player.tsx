import { useCallback } from 'react'
import { PauseIcon, PlayIcon, SpotifyLogoIcon } from '@phosphor-icons/react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useSpotifyPlayback } from '@/hooks/use-spotify-playback'
import { cn } from '@/lib/utils'

interface SpotifyPlayerProps {
  spotifyUri?: string
  previewUrl?: string
}

export function SpotifyPlayer({ spotifyUri, previewUrl }: SpotifyPlayerProps) {
  const {
    status,
    error,
    usingFallback,
    isPlaying,
    progressMs,
    durationMs,
    spotifyUrl,
    canPlay,
    togglePlayPause,
    seek,
  } = useSpotifyPlayback({ spotifyUri, previewUrl })

  const handleSeek = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const next = Number(e.target.value)
      if (!Number.isFinite(next)) return
      seek(next)
    },
    [seek],
  )

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // No song state
  if (!spotifyUri && !previewUrl) {
    return (
      <div className="flex items-center gap-3 rounded-full bg-muted/50 px-2 py-1.5">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <SpotifyLogoIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">
          Draw a card to play
        </span>
      </div>
    )
  }

  // Error state
  if (status === 'error' && error) {
    return (
      <div className="flex items-center gap-3 rounded-full bg-destructive/10 px-3 py-1.5">
        <span className="text-sm text-destructive">⚠️ {error.message}</span>
        {spotifyUrl && (
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs bg-spotify hover:bg-spotify/90 text-spotify-foreground px-3 py-1 rounded-full transition-colors"
          >
            Open Spotify
          </a>
        )}
      </div>
    )
  }

  // Loading state
  if (status === 'loading' || status === 'connecting') {
    return (
      <div className="flex items-center gap-3 rounded-full bg-muted/50 px-2 py-1.5">
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <span className="text-sm text-muted-foreground">
          {status === 'loading' ? 'Loading...' : 'Connecting...'}
        </span>
      </div>
    )
  }

  // Ready/Playing/Paused state
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isPlaying ? 'secondary' : 'default'}
        size="icon"
        className={cn(
          'h-10 w-10 rounded-full shrink-0 transition-all',
          isPlaying && 'bg-primary text-primary-foreground',
        )}
        onClick={togglePlayPause}
        disabled={!canPlay}
      >
        {isPlaying ? (
          <PauseIcon weight="fill" className="h-5 w-5" />
        ) : (
          <PlayIcon weight="fill" className="h-5 w-5" />
        )}
      </Button>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-xs tabular-nums text-muted-foreground w-9 text-right shrink-0">
          {formatTime(progressMs)}
        </span>
        <input
          type="range"
          min={0}
          max={durationMs || 1}
          value={progressMs}
          onChange={handleSeek}
          className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
        />
        <span className="text-xs tabular-nums text-muted-foreground w-9 shrink-0">
          {formatTime(durationMs)}
        </span>
      </div>

      {usingFallback && (
        <span className="text-[10px] text-warning shrink-0">30s preview</span>
      )}

      {spotifyUrl && (
        <a
          href={spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-spotify transition-colors"
          title="Open in Spotify"
        >
          <SpotifyLogoIcon weight="duotone" className="h-5 w-5" />
        </a>
      )}
    </div>
  )
}
