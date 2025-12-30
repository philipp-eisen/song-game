import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { SpotifyLogo } from '@phosphor-icons/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { listMyPlaylistsQuery } from '@/lib/convex-queries'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppLogo } from '@/components/app-logo'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    // Only prefetch playlists if authenticated
    if (context.isAuthenticated) {
      await context.queryClient.ensureQueryData(listMyPlaylistsQuery())
    }
  },
  component: HomePage,
})

function HomePage() {
  const { data: session, isPending: sessionPending } = authClient.useSession()

  if (sessionPending) {
    return (
      <section className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </section>
    )
  }

  const isLoggedIn = !!session
  const isGuest = session?.user.email.includes('guest.songgame.local')
  const canCreateGame = isLoggedIn && !isGuest

  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center p-4">
      {/* Hero */}
      <header className="mb-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <AppLogo size={48} className="text-primary" />
          <h1 className="text-4xl font-bold">Song Eras</h1>
        </div>
        <p className="text-lg text-muted-foreground">When was it released?</p>
      </header>

      <div className="grid w-full max-w-2xl gap-6">
        {/* Join Game - Always available */}
        <JoinGameSection />

        {/* Create Game or Login CTA */}
        {canCreateGame ? (
          <CreateGameSection />
        ) : (
          <LoginCTA isGuest={isGuest ?? false} />
        )}
      </div>
    </section>
  )
}

function JoinGameSection() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const joinByCode = useMutation(api.games.joinByCode)

  const handleJoin = async () => {
    if (joining) return // Prevent concurrent submissions
    if (!joinCode.trim()) return

    // If not logged in, sign in as anonymous first
    if (!session) {
      try {
        await authClient.signIn.anonymous()
      } catch {
        setError('Failed to sign in as guest')
        return
      }
    }

    setError(null)
    setJoining(true)

    try {
      const result = await joinByCode({ joinCode: joinCode.trim() })
      navigate({ to: '/play/$gameId', params: { gameId: result.gameId } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game')
    } finally {
      setJoining(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join Game</CardTitle>
        <CardDescription>
          Enter a 6-character code to join a game
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (joinCode.length === 6) handleJoin()
          }}
        >
          <Input
            placeholder="ABC123"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="font-mono uppercase"
          />
          <Button type="submit" disabled={joining || joinCode.length < 6}>
            {joining ? 'Joining...' : 'Join'}
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface LoginCTAProps {
  isGuest: boolean
}

function LoginCTA({ isGuest }: LoginCTAProps) {
  return (
    <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-primary/10">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {isGuest ? 'Upgrade to Create Games' : 'Want to host your own game?'}
        </CardTitle>
        <CardDescription className="text-base">
          Sign in with Spotify to import playlists and create games for your
          friends
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <Button
          onClick={() => authClient.signIn.social({ provider: 'spotify' })}
          className="w-full max-w-xs bg-spotify text-spotify-foreground hover:bg-spotify/90"
          size="lg"
        >
          <SpotifyLogo weight="fill" className="mr-2 h-5 w-5" />
          Sign in with Spotify
        </Button>
        {!isGuest && (
          <p className="text-center text-xs text-muted-foreground">
            Or{' '}
            <button
              type="button"
              onClick={() => authClient.signIn.anonymous()}
              className="underline hover:text-foreground"
            >
              continue as guest
            </button>{' '}
            to join games only
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function CreateGameSection() {
  const navigate = useNavigate()
  const { data: playlists } = useSuspenseQuery(listMyPlaylistsQuery())
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('')
  const [mode, setMode] = useState<'hostOnly' | 'sidecars'>('hostOnly')
  const [playerNames, setPlayerNames] = useState<Array<string>>([
    'Player 1',
    'Player 2',
  ])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createGame = useMutation(api.games.create)

  // If no playlists, show a CTA to import playlists
  if (playlists.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create Game</CardTitle>
          <CardDescription>
            Import a playlist first to create a game
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/playlists" />} className="w-full">
            Import a Playlist
          </Button>
        </CardContent>
      </Card>
    )
  }

  const handleCreate = async () => {
    if (!selectedPlaylist) {
      setError('Please select a playlist')
      return
    }

    setError(null)
    setCreating(true)

    try {
      const result = await createGame({
        playlistId: selectedPlaylist as Id<'spotifyPlaylists'>,
        mode,
        playerNames:
          mode === 'hostOnly' ? playerNames.filter((n) => n.trim()) : undefined,
      })
      navigate({ to: '/play/$gameId', params: { gameId: result.gameId } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game')
    } finally {
      setCreating(false)
    }
  }

  const addPlayer = () => {
    setPlayerNames([...playerNames, `Player ${playerNames.length + 1}`])
  }

  const removePlayer = (index: number) => {
    if (playerNames.length > 1) {
      setPlayerNames(playerNames.filter((_, i) => i !== index))
    }
  }

  const updatePlayerName = (index: number, name: string) => {
    const newNames = [...playerNames]
    newNames[index] = name
    setPlayerNames(newNames)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Game</CardTitle>
        <CardDescription>
          Start a new game with your imported playlists
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Playlist Selection */}
        <fieldset className="space-y-2">
          <label className="text-sm font-medium" htmlFor="playlist-select">
            Select Playlist
          </label>
          <Select
            value={selectedPlaylist || null}
            onValueChange={(value) => setSelectedPlaylist(value ?? '')}
          >
            <SelectTrigger className="w-full" id="playlist-select">
              <SelectValue>
                {selectedPlaylist
                  ? (playlists.find((p) => p._id === selectedPlaylist)?.name ??
                    'Choose a playlist...')
                  : 'Choose a playlist...'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {playlists.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.name} ({p.trackCount} tracks)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>

        {/* Mode Selection */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Game Mode</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="hostOnly"
                checked={mode === 'hostOnly'}
                onChange={() => setMode('hostOnly')}
                className="accent-primary"
              />
              <span className="text-sm">Host Only (single device)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="sidecars"
                checked={mode === 'sidecars'}
                onChange={() => setMode('sidecars')}
                className="accent-primary"
              />
              <span className="text-sm">Sidecars (multi-device)</span>
            </label>
          </div>
        </fieldset>

        {/* Player Names (Host Only mode) */}
        {mode === 'hostOnly' && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Players</legend>
            <ul className="space-y-2">
              {playerNames.map((name, index) => (
                <li key={index} className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => updatePlayerName(index, e.target.value)}
                    placeholder={`Player ${index + 1}`}
                  />
                  {playerNames.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePlayer(index)}
                      aria-label={`Remove player ${index + 1}`}
                    >
                      ×
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" onClick={addPlayer}>
              + Add Player
            </Button>
          </fieldset>
        )}

        {mode === 'sidecars' && (
          <p className="text-sm text-muted-foreground">
            Other players will join using the game code. They can sign in with
            Spotify or continue as guests.
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          onClick={handleCreate}
          disabled={creating || !selectedPlaylist}
          className="w-full"
        >
          {creating ? 'Creating...' : 'Create Game'}
        </Button>
      </CardContent>
    </Card>
  )
}
