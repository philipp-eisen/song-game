import { useAction } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'

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

export type SpotifyPlaybackStatus = 'loading' | 'connecting' | 'ready' | 'error'

export type SpotifyPlaybackError = {
  message: string
  needsReauth?: boolean
  needsPremium?: boolean
}

let spotifySdkLoadPromise: Promise<void> | null = null

async function loadSpotifyWebPlaybackSDK(options?: {
  timeoutMs?: number
}): Promise<void> {
  if (window.Spotify) return
  if (spotifySdkLoadPromise) return spotifySdkLoadPromise

  spotifySdkLoadPromise = new Promise<void>((resolve, reject) => {
    const timeoutMs = options?.timeoutMs ?? 10_000

    const timeout = window.setTimeout(() => {
      spotifySdkLoadPromise = null
      reject(new Error('Spotify SDK load timeout'))
    }, timeoutMs)

    const previous = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      previous?.()
      window.clearTimeout(timeout)
      resolve()
    }

    const existingScript = document.getElementById('spotify-sdk')
    if (existingScript) return

    const script = document.createElement('script')
    script.id = 'spotify-sdk'
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timeout)
      spotifySdkLoadPromise = null
      reject(new Error('Failed to load Spotify SDK'))
    }

    document.body.appendChild(script)
  })

  return spotifySdkLoadPromise
}

function spotifyUriToUrl(spotifyUri?: string) {
  if (!spotifyUri) return null
  return spotifyUri.replace('spotify:track:', 'https://open.spotify.com/track/')
}

export function useSpotifyPlayback({
  spotifyUri,
  previewUrl,
}: {
  spotifyUri?: string
  previewUrl?: string
}) {
  const getAccessToken = useAction(api.spotify.getAccessToken)

  const [status, setStatus] = useState<SpotifyPlaybackStatus>('loading')
  const [error, setError] = useState<SpotifyPlaybackError | null>(null)

  const [progressMs, setProgressMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)
  const usingFallbackRef = useRef(false)
  useEffect(() => {
    usingFallbackRef.current = usingFallback
  }, [usingFallback])

  const spotifyUriRef = useRef<string | undefined>(spotifyUri)
  useEffect(() => {
    spotifyUriRef.current = spotifyUri
  }, [spotifyUri])

  const previewUrlRef = useRef<string | undefined>(previewUrl)
  useEffect(() => {
    previewUrlRef.current = previewUrl
  }, [previewUrl])

  const playerRef = useRef<SpotifyPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  )
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const spotifyUrl = useMemo(() => spotifyUriToUrl(spotifyUri), [spotifyUri])

  const cleanupProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  const cleanupSdkPlayer = useCallback(() => {
    cleanupProgressInterval()

    if (playerRef.current) {
      // Remove listeners to avoid stray updates
      playerRef.current.removeListener('initialization_error')
      playerRef.current.removeListener('authentication_error')
      playerRef.current.removeListener('account_error')
      playerRef.current.removeListener('playback_error')
      playerRef.current.removeListener('ready')
      playerRef.current.removeListener('not_ready')
      playerRef.current.removeListener('player_state_changed')

      playerRef.current.disconnect()
      playerRef.current = null
    }

    deviceIdRef.current = null
  }, [cleanupProgressInterval])

  const cleanupPreviewAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audioRef.current = null
  }, [])

  const cleanupAll = useCallback(() => {
    cleanupSdkPlayer()
    cleanupPreviewAudio()
  }, [cleanupSdkPlayer, cleanupPreviewAudio])

  const switchToPreview = useCallback(() => {
    if (!previewUrlRef.current) return

    cleanupSdkPlayer()
    setUsingFallback(true)
    setStatus('ready')
    setError(null)
    setIsPlaying(false)
    setProgressMs(0)
    setDurationMs(0)
  }, [cleanupSdkPlayer])

  // Initialize Spotify SDK player on mount (no need to re-init per track/preview change)
  useEffect(() => {
    const cancelledRef = { current: false }

    const init = async () => {
      setStatus('loading')
      setError(null)
      setUsingFallback(false)
      setIsPlaying(false)
      setProgressMs(0)
      setDurationMs(0)

      try {
        const tokenData = await getAccessToken()
        if (cancelledRef.current) return

        if (!tokenData) {
          setError({ message: 'Not logged in with Spotify', needsReauth: true })
          setStatus('error')
          return
        }

        accessTokenRef.current = tokenData.accessToken

        await loadSpotifyWebPlaybackSDK()
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cancelledRef can flip during awaits via effect cleanup
        if (cancelledRef.current) return

        if (!window.Spotify) {
          throw new Error('Spotify SDK not available')
        }

        setStatus('connecting')

        const player = new window.Spotify.Player({
          name: 'Song Game Player',
          getOAuthToken: (cb: (token: string) => void) => {
            cb(accessTokenRef.current ?? '')
          },
          volume: 0.5,
        })
        playerRef.current = player

        const safeSetError = (next: SpotifyPlaybackError) => {
          if (cancelledRef.current) return
          setError(next)
          setStatus('error')
          setIsPlaying(false)
        }

        player.addListener('initialization_error', (data: unknown) => {
          const { message } = data as { message: string }
          console.error('[Spotify] Initialization error:', message)
          safeSetError({ message: `Initialization failed: ${message}` })
        })

        player.addListener('authentication_error', (data: unknown) => {
          const { message } = data as { message: string }
          console.error('[Spotify] Authentication error:', message)
          safeSetError({
            message:
              'Spotify authentication failed. Please sign out and sign in again.',
            needsReauth: true,
          })
        })

        player.addListener('account_error', (data: unknown) => {
          const { message } = data as { message: string }
          console.error('[Spotify] Account error:', message)

          if (previewUrlRef.current) {
            console.log('[Spotify] Falling back to preview URL')
            switchToPreview()
            return
          }

          safeSetError({
            message: 'Spotify Premium is required for web playback.',
            needsPremium: true,
          })
        })

        player.addListener('playback_error', (data: unknown) => {
          const { message } = data as { message: string }
          console.error('[Spotify] Playback error:', message)
          // Transient; don't fail UI.
        })

        player.addListener('ready', (data: unknown) => {
          const { device_id } = data as { device_id: string }
          console.log('[Spotify] Player ready with device ID:', device_id)
          if (cancelledRef.current) return

          deviceIdRef.current = device_id
          setStatus('ready')
        })

        player.addListener('not_ready', (data: unknown) => {
          const { device_id } = data as { device_id: string }
          console.log('[Spotify] Player not ready:', device_id)
          if (cancelledRef.current) return

          if (deviceIdRef.current === device_id) {
            deviceIdRef.current = null
            setStatus('connecting')
          }
        })

        player.addListener('player_state_changed', (data: unknown) => {
          const state = data as SpotifyPlaybackState | null
          if (cancelledRef.current || !state || usingFallbackRef.current) return

          setDurationMs(state.duration)
          setProgressMs(state.position)
          setIsPlaying(!state.paused)
        })

        const connected = await player.connect()
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cancelledRef can flip during awaits via effect cleanup
        if (cancelledRef.current) {
          player.disconnect()
          return
        }

        if (!connected) {
          throw new Error('Failed to connect to Spotify')
        }

        console.log('[Spotify] Player connected, waiting for ready event...')
      } catch (err) {
        console.error('[Spotify] Init error:', err)
        if (cancelledRef.current) return

        if (previewUrlRef.current) {
          console.log('[Spotify] Falling back to preview URL due to error')
          switchToPreview()
          return
        }

        setError({
          message: err instanceof Error ? err.message : 'Failed to initialize',
        })
        setStatus('error')
      }
    }

    init()

    return () => {
      cancelledRef.current = true
      cleanupAll()
    }
  }, [cleanupAll, getAccessToken, switchToPreview])

  // Set up preview audio player when in fallback mode
  useEffect(() => {
    if (!usingFallback || !previewUrl) return

    const audio = new Audio(previewUrl)
    audioRef.current = audio

    const handleTimeUpdate = () => {
      setProgressMs(audio.currentTime * 1000)
    }

    const handleLoadedMetadata = () => {
      setDurationMs(audio.duration * 1000)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setProgressMs(0)
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
  }, [previewUrl, usingFallback])

  // Progress polling for SDK player (keeps slider moving smoothly)
  useEffect(() => {
    if (usingFallback || !isPlaying) {
      cleanupProgressInterval()
      return
    }

    progressIntervalRef.current = setInterval(async () => {
      const state = await playerRef.current?.getCurrentState()
      if (state && !usingFallbackRef.current) {
        setProgressMs(state.position)
      }
    }, 500)

    return () => cleanupProgressInterval()
  }, [cleanupProgressInterval, isPlaying, usingFallback])

  const playSdkTrack = useCallback(async () => {
    const deviceId = deviceIdRef.current
    const token = accessTokenRef.current
    const uri = spotifyUriRef.current

    if (!deviceId || !token || !uri) {
      console.error('[Spotify] Cannot play: missing device, token, or URI')
      return
    }

    try {
      const transferRes = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false,
        }),
      })

      if (!transferRes.ok && transferRes.status !== 204) {
        console.warn('[Spotify] Transfer response:', transferRes.status)
      }

      await new Promise((resolve) => setTimeout(resolve, 300))

      const playRes = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: [uri],
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

        setStatus('error')
        setIsPlaying(false)
      }
    } catch (err) {
      console.error('[Spotify] Play error:', err)
      setError({
        message: err instanceof Error ? err.message : 'Playback failed',
      })
      setStatus('error')
      setIsPlaying(false)
    }
  }, [])

  const togglePlayPause = useCallback(async () => {
    if (usingFallback) {
      const audio = audioRef.current
      if (!audio) return

      try {
        if (audio.paused) {
          await audio.play()
          setIsPlaying(true)
        } else {
          audio.pause()
          setIsPlaying(false)
        }
      } catch (err) {
        console.error('[Spotify] Preview play error:', err)
      }
      return
    }

    const player = playerRef.current
    if (!player) return

    const state = await player.getCurrentState()
    if (!state) {
      await playSdkTrack()
      return
    }

    await player.togglePlay()
  }, [playSdkTrack, usingFallback])

  const seek = useCallback(
    (positionMs: number) => {
      setProgressMs(positionMs)

      if (usingFallback) {
        const audio = audioRef.current
        if (audio) {
          audio.currentTime = positionMs / 1000
        }
        return
      }

      playerRef.current?.seek(positionMs)
    },
    [usingFallback],
  )

  const canPlay = Boolean(spotifyUri || previewUrl)

  return {
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
  }
}


