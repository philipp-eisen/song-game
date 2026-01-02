import { useCallback, useEffect, useRef } from 'react'
import {
  AppleLogoIcon,
  MusicNoteIcon,
  PauseIcon,
  PlayIcon,
} from '@phosphor-icons/react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { formatTime, usePreviewPlayback } from '@/hooks/use-preview-playback'
import { cn } from '@/lib/utils'

interface PreviewPlayerProps {
  previewUrl?: string
  appleMusicId?: string
  artworkUrl?: string
  title?: string
  artist?: string
  className?: string
  compact?: boolean
  autoPlay?: boolean
}

/**
 * Generate an Apple Music song URL from an Apple Music ID
 */
function getAppleMusicUrl(appleMusicId: string): string {
  return `https://music.apple.com/song/${appleMusicId}`
}

/**
 * A universal audio preview player component
 * Works with Apple Music preview URLs (and any other audio URLs)
 * No SDK authentication required
 */
export function PreviewPlayer({
  previewUrl,
  appleMusicId,
  artworkUrl,
  title,
  artist,
  className,
  compact = false,
  autoPlay = false,
}: PreviewPlayerProps) {
  const appleMusicUrl = appleMusicId ? getAppleMusicUrl(appleMusicId) : null
  const { state, play, togglePlayPause, seek, currentUrl } =
    usePreviewPlayback()

  // Track the last auto-played URL to avoid replaying the same track
  const lastAutoPlayedUrl = useRef<string | null>(null)

  const isCurrentTrack = currentUrl === previewUrl
  const isPlaying = isCurrentTrack && state.isPlaying
  const isLoading = isCurrentTrack && state.isLoading
  const currentTime = isCurrentTrack ? state.currentTime : 0
  const duration = isCurrentTrack ? state.duration : 30 // Default to 30s for previews

  // Auto-play when previewUrl changes
  useEffect(() => {
    if (autoPlay && previewUrl && previewUrl !== lastAutoPlayedUrl.current) {
      lastAutoPlayedUrl.current = previewUrl
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        play(previewUrl)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoPlay, previewUrl, play])

  const handleToggle = useCallback(() => {
    if (previewUrl) {
      togglePlayPause(previewUrl)
    }
  }, [previewUrl, togglePlayPause])

  const handleSeek = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const next = Number(e.target.value)
      if (!Number.isFinite(next)) return
      seek(next)
    },
    [seek],
  )

  // No preview URL state
  if (!previewUrl) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-full bg-muted px-2 py-1.5',
          className,
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
          <MusicNoteIcon weight="duotone" className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">
          No preview available
        </span>
      </div>
    )
  }

  // Error state
  if (isCurrentTrack && state.error) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-full bg-destructive/10 px-3 py-1.5 dark:bg-destructive/20',
          className,
        )}
      >
        <span className="text-sm text-destructive">⚠️ {state.error}</span>
      </div>
    )
  }

  // Compact mode - just a play button
  if (compact) {
    return (
      <Button
        variant={isPlaying ? 'secondary' : 'ghost'}
        size="icon"
        className={cn(
          'h-8 w-8 rounded-full shrink-0 transition-all',
          isPlaying && 'bg-primary text-primary-foreground',
          className,
        )}
        onClick={handleToggle}
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : isPlaying ? (
          <PauseIcon weight="duotone" className="h-4 w-4" />
        ) : (
          <PlayIcon weight="duotone" className="h-4 w-4" />
        )}
      </Button>
    )
  }

  // Full player
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Artwork/Play button */}
      <Button
        variant={isPlaying ? 'secondary' : 'default'}
        size="icon"
        className={cn(
          'h-10 w-10 rounded-full shrink-0 transition-all overflow-hidden',
          isPlaying && 'bg-primary text-primary-foreground',
          artworkUrl && 'p-0',
        )}
        onClick={handleToggle}
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : artworkUrl ? (
          <div className="relative h-full w-full">
            <img
              src={artworkUrl}
              alt=""
              className={cn(
                'h-full w-full object-cover transition-opacity',
                isPlaying && 'opacity-50',
              )}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {isPlaying ? (
                <PauseIcon
                  weight="duotone"
                  className="h-5 w-5 text-white drop-shadow"
                />
              ) : (
                <PlayIcon
                  weight="duotone"
                  className="h-5 w-5 text-white drop-shadow"
                />
              )}
            </div>
          </div>
        ) : isPlaying ? (
          <PauseIcon weight="duotone" className="h-5 w-5" />
        ) : (
          <PlayIcon weight="duotone" className="h-5 w-5" />
        )}
      </Button>

      {/* Track info and progress */}
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        {/* Title/Artist */}
        {(title || artist) && (
          <div className="flex items-center gap-1 text-xs truncate">
            {title && <span className="font-medium truncate">{title}</span>}
            {title && artist && (
              <span className="text-muted-foreground">•</span>
            )}
            {artist && (
              <span className="text-muted-foreground truncate">{artist}</span>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right shrink-0">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 30}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-secondary [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground w-7 shrink-0">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Apple Music link */}
      {appleMusicUrl ? (
        <a
          href={appleMusicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Open in Apple Music"
        >
          <AppleLogoIcon weight="duotone" className="h-5 w-5" />
        </a>
      ) : (
        <span className="text-[10px] text-muted-foreground shrink-0">
          preview
        </span>
      )}
    </div>
  )
}

/**
 * Simple play/pause button for inline use
 */
export function PreviewPlayButton({
  previewUrl,
  className,
}: {
  previewUrl?: string
  className?: string
}) {
  return <PreviewPlayer previewUrl={previewUrl} compact className={className} />
}
