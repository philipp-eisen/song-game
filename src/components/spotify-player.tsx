import { useAction } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// Spotify Web Playback SDK types
interface SpotifyPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, callback: (data: unknown) => void) => void
  removeListener: (event: string) => void
  getCurrentState: () => Promise<SpotifyPlaybackState | null>
  togglePlay: () => Promise<void>
  seek: (position: number) => Promise<void>
}

interface SpotifyPlaybackState {
  duration: number
  position: number
  paused: boolean
  track_window: {
    current_track: {
      name: string
      artists: Array<{ name: string }>
    } | null
  }
}

interface SpotifyPlayerConstructor {
  new (options: {
    name: string
    getOAuthToken: (cb: (token: string) => void) => void
    volume?: number
  }): SpotifyPlayer
}

interface SpotifySDK {
  Player: SpotifyPlayerConstructor
}

declare global {
  interface Window {
    Spotify?: SpotifySDK
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

interface SpotifyPlayerProps {
  spotifyUri?: string
  previewUrl?: string
}

type PlayerState =
  | 'loading' // Loading SDK
  | 'connecting' // SDK loaded, connecting player
  | 'ready' // Player connected and ready
  | 'playing' // Currently playing
  | 'paused' // Paused
  | 'error' // Error state

interface ErrorInfo {
  message: string
  needsReauth?: boolean
  needsPremium?: boolean
}

export function SpotifyPlayer({ spotifyUri, previewUrl }: SpotifyPlayerProps) {
  const getAccessToken = useAction(api.spotify.getAccessToken)

  const playerRef = useRef<SpotifyPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  )
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [playerState, setPlayerState] = useState<PlayerState>('loading')
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [usingFallback, setUsingFallback] = useState(false)

  // Cleanup function
  const cleanup = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (playerRef.current) {
      playerRef.current.disconnect()
      playerRef.current = null
    }
    deviceIdRef.current = null
  }, [])

  // Initialize the player
  useEffect(() => {
    let mounted = true

    const initPlayer = async () => {
      try {
        // 1. Get access token
        const tokenData = await getAccessToken()
        if (!mounted) return

        if (!tokenData) {
          setError({ message: 'Not logged in with Spotify', needsReauth: true })
          setPlayerState('error')
          return
        }

        accessTokenRef.current = tokenData.accessToken

        // 2. Load SDK if not already loaded
        if (!window.Spotify) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error('SDK load timeout')),
              10000,
            )

            window.onSpotifyWebPlaybackSDKReady = () => {
              clearTimeout(timeout)
              resolve()
            }

            // Check if script already exists
            if (!document.getElementById('spotify-sdk')) {
              const script = document.createElement('script')
              script.id = 'spotify-sdk'
              script.src = 'https://sdk.scdn.co/spotify-player.js'
              script.onerror = () => {
                clearTimeout(timeout)
                reject(new Error('Failed to load Spotify SDK'))
              }
              document.body.appendChild(script)
            }
          })
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety check for async SDK loading
        if (!mounted || !window.Spotify) return
        setPlayerState('connecting')

        // 3. Create and connect player
        const player = new window.Spotify.Player({
          name: 'Song Game Player',
          getOAuthToken: (cb: (token: string) => void) => {
            cb(accessTokenRef.current ?? '')
          },
          volume: 0.5,
        })

        // Error listeners
        player.addListener('initialization_error', (data: unknown) => {
          const { message } = data as { message: string }
          console.error('[Spotify] Initialization error:', message)
          if (mounted) {
            setError({ message: `Initialization failed: ${message}` })
            setPlayerState('error')
          }
        })

        player.addListener('authentication_error', (data: unknown) => {
          const { message } = data as { message: string }
          console.error('[Spotify] Authentication error:', message)
          if (mounted) {
            setError({
              message:
                'Spotify authentication failed. Please sign out and sign in again.',
              needsReauth: true,
            })
            setPlayerState('error')
          }
        })

        player.addListener('account_error', (data: unknown) => {
          const { message } = data as { message: string }
          console.error('[Spotify] Account error:', message)
          if (mounted) {
            // Fall back to preview if available
            if (previewUrl) {
              console.log('[Spotify] Falling back to preview URL')
              setUsingFallback(true)
              setPlayerState('ready')
            } else {
              setError({
                message: 'Spotify Premium is required for web playback.',
                needsPremium: true,
              })
              setPlayerState('error')
            }
          }
        })

        player.addListener('playback_error', (data: unknown) => {
          const { message } = data as { message: string }
          console.error('[Spotify] Playback error:', message)
          // Don't set error state for playback errors - they can be transient
        })

        // Ready listener
        player.addListener('ready', (data: unknown) => {
          const { device_id } = data as { device_id: string }
          console.log('[Spotify] Player ready with device ID:', device_id)
          if (mounted) {
            deviceIdRef.current = device_id
            playerRef.current = player
            setPlayerState('ready')
          }
        })

        player.addListener('not_ready', (data: unknown) => {
          const { device_id } = data as { device_id: string }
          console.log('[Spotify] Player not ready:', device_id)
          if (mounted && deviceIdRef.current === device_id) {
            deviceIdRef.current = null
            setPlayerState('connecting')
          }
        })

        // State change listener
        player.addListener('player_state_changed', (data: unknown) => {
          const state = data as SpotifyPlaybackState | null
          if (!mounted || !state) return

          setDuration(state.duration)
          setProgress(state.position)

          if (state.paused) {
            setPlayerState('paused')
          } else {
            setPlayerState('playing')
          }
        })

        // Connect
        const connected = await player.connect()
        if (!connected) {
          throw new Error('Failed to connect to Spotify')
        }

        console.log('[Spotify] Player connected, waiting for ready event...')
      } catch (err) {
        console.error('[Spotify] Init error:', err)
        if (mounted) {
          // Fall back to preview if available
          if (previewUrl) {
            console.log('[Spotify] Falling back to preview URL due to error')
            setUsingFallback(true)
            setPlayerState('ready')
          } else {
            setError({
              message:
                err instanceof Error ? err.message : 'Failed to initialize',
            })
            setPlayerState('error')
          }
        }
      }
    }

    initPlayer()

    return () => {
      mounted = false
      cleanup()
    }
  }, [getAccessToken, cleanup, previewUrl])

  // Progress tracking interval for SDK player
  useEffect(() => {
    if (playerState === 'playing' && !usingFallback) {
      progressIntervalRef.current = setInterval(async () => {
        const state = await playerRef.current?.getCurrentState()
        if (state) {
          setProgress(state.position)
        }
      }, 500)
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [playerState, usingFallback])

  // Play track function (SDK)
  const playTrack = useCallback(async () => {
    if (!deviceIdRef.current || !accessTokenRef.current || !spotifyUri) {
      console.error('[Spotify] Cannot play: missing device, token, or URI')
      return
    }

    try {
      // First, transfer playback to our device
      const transferRes = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessTokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_ids: [deviceIdRef.current],
          play: false,
        }),
      })

      if (!transferRes.ok && transferRes.status !== 204) {
        console.warn('[Spotify] Transfer response:', transferRes.status)
      }

      // Small delay to ensure transfer completes
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Now play the track
      const playRes = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessTokenRef.current}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: [spotifyUri],
          }),
        },
      )

      if (!playRes.ok && playRes.status !== 204) {
        const errorText = await playRes.text()
        console.error('[Spotify] Play error:', playRes.status, errorText)

        if (playRes.status === 404) {
          setError({
            message: 'Device not found. Please refresh and try again.',
          })
        } else if (playRes.status === 403) {
          setError({
            message: 'Spotify Premium required for web playback.',
            needsPremium: true,
          })
        } else {
          setError({ message: `Playback failed (${playRes.status})` })
        }
        setPlayerState('error')
      }
    } catch (err) {
      console.error('[Spotify] Play error:', err)
      setError({
        message: err instanceof Error ? err.message : 'Playback failed',
      })
      setPlayerState('error')
    }
  }, [spotifyUri])

  // Toggle play/pause (SDK)
  const togglePlayPause = useCallback(async () => {
    if (usingFallback) {
      // Fallback audio player
      const audio = audioRef.current
      if (!audio) return

      if (audio.paused) {
        await audio.play()
        setPlayerState('playing')
      } else {
        audio.pause()
        setPlayerState('paused')
      }
      return
    }

    if (!playerRef.current) return

    const state = await playerRef.current.getCurrentState()

    if (!state) {
      // No state means nothing is playing yet - start playback
      await playTrack()
    } else {
      await playerRef.current.togglePlay()
    }
  }, [playTrack, usingFallback])

  // Seek function
  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newPosition = parseInt(e.target.value)
      setProgress(newPosition)

      if (usingFallback && audioRef.current) {
        audioRef.current.currentTime = newPosition / 1000
      } else {
        playerRef.current?.seek(newPosition)
      }
    },
    [usingFallback],
  )

  // Fallback audio event handlers
  useEffect(() => {
    if (!usingFallback || !previewUrl) return

    const audio = new Audio(previewUrl)
    audioRef.current = audio

    const handleTimeUpdate = () => {
      setProgress(audio.currentTime * 1000)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration * 1000)
    }

    const handleEnded = () => {
      setPlayerState('paused')
      setProgress(0)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [usingFallback, previewUrl])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getSpotifyUrl = () => {
    if (!spotifyUri) return null
    return spotifyUri.replace(
      'spotify:track:',
      'https://open.spotify.com/track/',
    )
  }

  const spotifyUrl = getSpotifyUrl()

  // Error state
  if (playerState === 'error' && error) {
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
                  <SpotifyIcon className="h-4 w-4" />
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
  if (playerState === 'loading' || playerState === 'connecting') {
    return (
      <Card className="border-2 border-primary/30">
        <CardContent className="py-6">
          <div className="text-center">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-2" />
            <p className="text-sm text-muted-foreground">
              {playerState === 'loading'
                ? 'Loading Spotify...'
                : 'Connecting player...'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Ready/Playing/Paused state
  const isPlaying = playerState === 'playing'

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

          {/* Play/Pause button and progress */}
          <div className="flex items-center gap-4">
            <Button
              variant={isPlaying ? 'secondary' : 'default'}
              size="lg"
              className="h-14 w-14 rounded-full flex-shrink-0"
              onClick={togglePlayPause}
              disabled={!spotifyUri && !previewUrl}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </Button>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-primary mb-1">
                🎵 Listen to guess the year!
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-10 flex-shrink-0">
                  {formatTime(progress)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  value={progress}
                  onChange={handleSeek}
                  className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                />
                <span className="text-xs text-muted-foreground w-10 flex-shrink-0">
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>

          {/* Spotify attribution */}
          {spotifyUrl && (
            <div className="text-center">
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                <SpotifyIcon className="h-3 w-3" />
                Open in Spotify →
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function PlayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
    >
      <path
        fillRule="evenodd"
        d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
    >
      <path
        fillRule="evenodd"
        d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  )
}
