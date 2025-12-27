import { Link, Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useAction, useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { listMyGamesQuery, listMyPlaylistsQuery } from '@/lib/convex-queries'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/game')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(listMyPlaylistsQuery()),
      context.queryClient.ensureQueryData(listMyGamesQuery()),
    ])
  },
  component: GameHub,
})

function GameHub() {
  const { data: session, isPending: sessionPending } = authClient.useSession()

  if (sessionPending) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              Sign in with Spotify to import playlists and create games, or continue as
              guest to join existing games.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              onClick={() => authClient.signIn.social({ provider: 'spotify' })}
              className="bg-[#1DB954] hover:bg-[#1ed760]"
            >
              Sign in with Spotify
            </Button>
            <Button
              variant="outline"
              onClick={() => authClient.signIn.anonymous()}
            >
              Continue as Guest
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if user is anonymous (guest)
  const isGuest = session.user.email.includes('guest.songgame.local')

  return (
    <div className="space-y-8 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Song Game</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {isGuest ? 'Guest' : session.user.name}
          </span>
          <Button variant="ghost" size="sm" onClick={() => authClient.signOut()}>
            Sign out
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Join Game Section */}
        <JoinGameSection />

        {/* My Games Section */}
        <MyGamesSection />

        {/* Only show playlist import for non-guest users */}
        {!isGuest && <PlaylistImportSection />}

        {/* Create Game Section - only for non-guest users with playlists */}
        {!isGuest && <CreateGameSection />}
      </div>

      <Outlet />
    </div>
  )
}

function JoinGameSection() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const joinByCode = useMutation(api.games.joinByCode)

  const handleJoin = async () => {
    if (!joinCode.trim()) return

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
        <CardDescription>Enter a 6-character code to join a game</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            placeholder="ABC123"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="font-mono uppercase"
          />
          <Button onClick={handleJoin} disabled={joining || joinCode.length < 6}>
            {joining ? 'Joining...' : 'Join'}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  )
}

function MyGamesSection() {
  const { data: games } = useSuspenseQuery(listMyGamesQuery())

  if (games.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Games</CardTitle>
          <CardDescription>You have no active games</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Games</CardTitle>
        <CardDescription>{games.length} game(s)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {games.map((game) => (
            <Link
              key={game._id}
              to="/play/$gameId"
              params={{ gameId: game._id }}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">{game.playlistName ?? 'Unknown playlist'}</p>
                <p className="text-sm text-muted-foreground">
                  Code: <span className="font-mono">{game.joinCode}</span> •{' '}
                  {game.playerCount} player(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={game.phase === 'lobby' ? 'secondary' : 'default'}>
                  {game.phase}
                </Badge>
                {game.isHost && <Badge variant="outline">Host</Badge>}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PlaylistImportSection() {
  const { data: playlists } = useSuspenseQuery(listMyPlaylistsQuery())
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const importPlaylist = useAction(api.spotify.importSpotifyPlaylist)

  const handleImport = async () => {
    if (!playlistUrl.trim()) return

    setError(null)
    setSuccess(null)
    setImporting(true)

    try {
      const result = await importPlaylist({ playlistUrlOrId: playlistUrl.trim() })
      setSuccess(`Imported ${result.trackCount} tracks!`)
      setPlaylistUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import playlist')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Playlist</CardTitle>
        <CardDescription>
          Import a Spotify playlist to use as song cards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Spotify playlist URL or ID"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
          />
          <Button onClick={handleImport} disabled={importing || !playlistUrl.trim()}>
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-500">{success}</p>}

        {playlists.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Your playlists:</p>
            {playlists.map((p) => (
              <div
                key={p._id}
                className="flex items-center gap-3 rounded-lg border p-2"
              >
                {p.imageUrl && (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded object-cover"
                  />
                )}
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.trackCount} tracks
                  </p>
                </div>
              </div>
            ))}
          </div>
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
  const [playerNames, setPlayerNames] = useState<Array<string>>(['Player 1', 'Player 2'])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createGame = useMutation(api.games.create)

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
        playerNames: mode === 'hostOnly' ? playerNames.filter((n) => n.trim()) : undefined,
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

  if (playlists.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create Game</CardTitle>
          <CardDescription>Import a playlist first to create a game</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Create Game</CardTitle>
        <CardDescription>Start a new game with your imported playlists</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Playlist Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Playlist</label>
          <select
            value={selectedPlaylist}
            onChange={(e) => setSelectedPlaylist(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            <option value="">Choose a playlist...</option>
            {playlists.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.trackCount} tracks)
              </option>
            ))}
          </select>
        </div>

        {/* Mode Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Game Mode</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="hostOnly"
                checked={mode === 'hostOnly'}
                onChange={() => setMode('hostOnly')}
              />
              <span>Host Only (single device)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="sidecars"
                checked={mode === 'sidecars'}
                onChange={() => setMode('sidecars')}
              />
              <span>Sidecars (multi-device)</span>
            </label>
          </div>
        </div>

        {/* Player Names (Host Only mode) */}
        {mode === 'hostOnly' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Players</label>
            <div className="space-y-2">
              {playerNames.map((name, index) => (
                <div key={index} className="flex gap-2">
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
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addPlayer}>
                + Add Player
              </Button>
            </div>
          </div>
        )}

        {mode === 'sidecars' && (
          <p className="text-sm text-muted-foreground">
            Other players will join using the game code. They can sign in with Spotify or
            continue as guests.
          </p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button onClick={handleCreate} disabled={creating || !selectedPlaylist}>
          {creating ? 'Creating...' : 'Create Game'}
        </Button>
      </CardContent>
    </Card>
  )
}

