import { createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useAction } from 'convex/react'
import { useState } from 'react'
import {
  AppleLogo,
  ArrowsClockwise,
  CheckCircle,
  MusicNotes,
  Playlist,
  Plus,
  SpotifyLogo,
  Warning,
  XCircle,
} from '@phosphor-icons/react'
import { api } from '../../convex/_generated/api'
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
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const Route = createFileRoute('/playlists')({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: '/' })
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(listMyPlaylistsQuery())
  },
  component: PlaylistsPage,
})

function PlaylistsPage() {
  const { data: session } = authClient.useSession()
  const { data: playlists } = useSuspenseQuery(listMyPlaylistsQuery())

  const isGuest = session?.user.email.includes('guest.songgame.local')

  return (
    <section className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <Playlist weight="duotone" className="size-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Playlists</h1>
          <p className="text-muted-foreground">
            Import Spotify playlists to use in your games
          </p>
        </div>
      </header>

      {isGuest ? (
        <GuestUpgradeCTA />
      ) : (
        <>
          <ImportPlaylistCard />
          <PlaylistsList playlists={playlists} />
        </>
      )}
    </section>
  )
}

function GuestUpgradeCTA() {
  return (
    <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <CardTitle className="text-lg">
          Connect Spotify to Import Playlists
        </CardTitle>
        <CardDescription>
          Sign in with your Spotify account to import playlists and create games
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => authClient.signIn.social({ provider: 'spotify' })}
          className="bg-spotify text-spotify-foreground hover:bg-spotify/90"
        >
          <SpotifyLogo weight="fill" className="mr-2 h-4 w-4" />
          Connect Spotify
        </Button>
      </CardContent>
    </Card>
  )
}

function ImportPlaylistCard() {
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
      const result = await importPlaylist({
        playlistUrlOrId: playlistUrl.trim(),
      })
      setSuccess(
        `Imported ${result.trackCount} tracks! Processing will continue in the background.`,
      )
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
        <CardTitle className="flex items-center gap-2">
          <Plus weight="bold" className="size-5" />
          Import Playlist
        </CardTitle>
        <CardDescription>
          Paste a Spotify playlist URL or ID to import it. Tracks are
          automatically matched to Apple Music for playback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            handleImport()
          }}
        >
          <Input
            placeholder="https://open.spotify.com/playlist/... or playlist ID"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={importing || !playlistUrl.trim()}>
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </form>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-success" role="status">
            {success}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface PlaylistData {
  _id: string
  source: 'spotify' | 'appleMusic'
  name: string
  imageUrl?: string
  status: 'importing' | 'processing' | 'ready' | 'failed'
  totalTracks: number
  readyTracks: number
  unmatchedTracks: number
}

interface PlaylistsListProps {
  playlists: Array<PlaylistData>
}

function PlaylistsList({ playlists }: PlaylistsListProps) {
  if (playlists.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MusicNotes
            weight="duotone"
            className="mb-4 size-16 text-muted-foreground/50"
          />
          <CardTitle className="mb-2 text-lg">No playlists yet</CardTitle>
          <CardDescription className="text-center">
            Import a Spotify playlist to get started creating games.
          </CardDescription>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Playlists</CardTitle>
        <CardDescription>
          {playlists.length} playlist{playlists.length !== 1 && 's'} imported
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {playlists.map((playlist) => (
            <PlaylistItem key={playlist._id} playlist={playlist} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function PlaylistItem({ playlist }: { playlist: PlaylistData }) {
  const isImporting = playlist.status === 'importing'
  const isProcessing = playlist.status === 'processing'
  const isReady = playlist.status === 'ready'
  const isFailed = playlist.status === 'failed'

  const processedCount = playlist.readyTracks + playlist.unmatchedTracks
  const pendingCount = Math.max(0, playlist.totalTracks - processedCount)

  return (
    <li>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            {playlist.imageUrl ? (
              <img
                src={playlist.imageUrl}
                alt=""
                className="size-12 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                <MusicNotes
                  weight="duotone"
                  className="size-6 text-muted-foreground"
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{playlist.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  {playlist.source === 'spotify' ? (
                    <SpotifyLogo weight="fill" className="size-3" />
                  ) : (
                    <AppleLogo weight="fill" className="size-3" />
                  )}
                  {playlist.totalTracks} tracks
                </span>
              </div>
            </div>

            {/* Status Badge */}
            {isReady ? (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <CheckCircle weight="fill" className="size-3 text-primary" />
                Ready
              </Badge>
            ) : isImporting ? (
              <Badge variant="outline" className="shrink-0 gap-1">
                <ArrowsClockwise className="size-3 animate-spin" />
                Importing
              </Badge>
            ) : isProcessing ? (
              <Badge variant="outline" className="shrink-0 gap-1">
                <ArrowsClockwise className="size-3 animate-spin" />
                Matching
              </Badge>
            ) : isFailed ? (
              <Badge variant="destructive" className="shrink-0 gap-1">
                <XCircle weight="fill" className="size-3" />
                Failed
              </Badge>
            ) : null}
          </div>

          {/* Import progress (only during import) */}
          {isImporting && playlist.totalTracks > 0 ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Importing tracks…</span>
                <span className="tabular-nums">
                  {processedCount}/{playlist.totalTracks}
                </span>
              </div>
              <Progress
                value={(processedCount / playlist.totalTracks) * 100}
                className="**:data-[slot=progress-track]:h-2 **:data-[slot=progress-track]:rounded-md"
              />
            </div>
          ) : null}

          {/* Post-import status summary */}
          {isProcessing ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 text-primary">
                <CheckCircle weight="fill" className="size-3" />
                {playlist.readyTracks} playable
              </Badge>
              {playlist.unmatchedTracks > 0 ? (
                <Badge variant="outline" className="gap-1 text-warning">
                  <Warning weight="fill" className="size-3" />
                  {playlist.unmatchedTracks} unmatched
                </Badge>
              ) : null}
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <ArrowsClockwise className="size-3 animate-spin" />
                {pendingCount} remaining
              </Badge>
            </div>
          ) : null}

          {isReady ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {playlist.readyTracks > 0 ? (
                <Badge variant="outline" className="gap-1 text-primary">
                  <CheckCircle weight="fill" className="size-3" />
                  {playlist.readyTracks} playable
                </Badge>
              ) : null}
              {playlist.unmatchedTracks > 0 ? (
                <Badge variant="outline" className="gap-1 text-warning">
                  <Warning weight="fill" className="size-3" />
                  {playlist.unmatchedTracks} unmatched
                </Badge>
              ) : null}
            </div>
          ) : null}

          {isFailed ? (
            <div className="mt-2">
              <Alert variant="destructive">
                <XCircle weight="fill" />
                <AlertTitle>Import failed</AlertTitle>
                <AlertDescription>
                  Try importing the playlist again. If it keeps failing, double
                  check the playlist URL/ID.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  )
}
