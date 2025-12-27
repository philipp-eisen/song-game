import { useCallback } from 'react'
import type { ChangeEvent } from 'react'
import { SpotifyLogoIcon, PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSpotifyPlayback } from '@/hooks/use-spotify-playback'

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

  // Error state
  if (status === 'error' && error) {
    return (
      <Card className="border-dashed border-2 border-destructive/50">
        <CardContent className="py-6">
          <div className="text-center">
            <p className="text-lg font-medium text-destructive">
              ⚠️ Playback Unavailable
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {error.message}
            </p>

            {error.needsPremium && (
              <p className="text-xs text-muted-foreground mt-2">
                The Spotify Web Playback SDK requires a Premium account.
              </p>
            )}

            <div className="flex flex-col items-center gap-2 mt-4">
              {error.needsReauth && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = '/api/auth/sign-out')}
                >
                  Sign Out to Re-authenticate
                </Button>
              )}

              {spotifyUrl && (
                <a
                  href={spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-full font-medium transition-colors text-sm"
                >
                  <SpotifyLogoIcon weight="duotone" className="h-4 w-4" />
                  Open in Spotify App
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (status === 'loading' || status === 'connecting') {
    return (
      <Card className="border-2 border-primary/30">
        <CardContent className="py-6">
          <div className="text-center">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-2" />
            <p className="text-sm text-muted-foreground">
              {status === 'loading'
                ? 'Loading Spotify...'
                : 'Connecting player...'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Ready/Playing/Paused state
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card className="border-2 border-primary/50 bg-primary/5">
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          {/* Fallback notice */}
          {usingFallback && (
            <p className="text-xs text-center text-amber-600">
              Playing 30-second preview (Premium required for full playback)
            </p>
          )}

          <div className="flex items-center gap-4">
            <Button
              variant={isPlaying ? 'secondary' : 'default'}
              size="lg"
              className="h-14 w-14 rounded-full shrink-0"
              onClick={togglePlayPause}
              disabled={!canPlay}
            >
              {isPlaying ? (
                <PauseIcon weight="duotone" className="h-6 w-6" />
              ) : (
                <PlayIcon weight="duotone" className="h-6 w-6" />
              )}
            </Button>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-primary mb-1">
                🎵 Listen to guess the year!
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-10 shrink-0">
                  {formatTime(progressMs)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={durationMs || 1}
                  value={progressMs}
                  onChange={handleSeek}
                  className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                />
                <span className="text-xs text-muted-foreground w-10 shrink-0">
                  {formatTime(durationMs)}
                </span>
              </div>
            </div>
          </div>

          {spotifyUrl && (
            <div className="text-center">
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                <SpotifyLogoIcon weight="duotone" className="h-3 w-3" />
                Open in Spotify →
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
