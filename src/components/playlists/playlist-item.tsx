import { Link } from '@tanstack/react-router'
import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  MusicNotesIcon,
  WarningIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export interface PlaylistData {
  _id: string
  source: 'spotify' | 'appleMusic'
  name: string
  imageUrl?: string
  status: 'importing' | 'processing' | 'ready' | 'failed'
  totalTracks: number
  readyTracks: number
  unmatchedTracks: number
}

interface PlaylistItemProps {
  playlist: PlaylistData
}

export function PlaylistItem({ playlist }: PlaylistItemProps) {
  const isImporting = playlist.status === 'importing'
  const isProcessing = playlist.status === 'processing'
  const isReady = playlist.status === 'ready'
  const isFailed = playlist.status === 'failed'

  const processedCount = playlist.readyTracks + playlist.unmatchedTracks
  const pendingCount = Math.max(0, playlist.totalTracks - processedCount)

  return (
    <li>
      <Link
        to="/playlists/$playlistId"
        params={{ playlistId: playlist._id }}
        className="block"
      >
        <Card className="transition-colors hover:bg-accent/50">
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
                  <MusicNotesIcon
                    weight="duotone"
                    className="size-6 text-muted-foreground"
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{playlist.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{playlist.totalTracks} tracks</span>
                </div>
              </div>

              {/* Status Badge */}
              {isReady ? (
                <Badge variant="secondary" className="shrink-0 gap-1">
                  <CheckCircleIcon
                    weight="duotone"
                    className="size-3 text-primary"
                  />
                  Ready
                </Badge>
              ) : isImporting ? (
                <Badge variant="outline" className="shrink-0 gap-1">
                  <ArrowsClockwiseIcon
                    weight="duotone"
                    className="size-3 animate-spin"
                  />
                  Importing
                </Badge>
              ) : isProcessing ? (
                <Badge variant="outline" className="shrink-0 gap-1">
                  <ArrowsClockwiseIcon
                    weight="duotone"
                    className="size-3 animate-spin"
                  />
                  Matching
                </Badge>
              ) : isFailed ? (
                <Badge variant="destructive" className="shrink-0 gap-1">
                  <XCircleIcon weight="duotone" className="size-3" />
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
                  <CheckCircleIcon weight="duotone" className="size-3" />
                  {playlist.readyTracks} playable
                </Badge>
                {playlist.unmatchedTracks > 0 ? (
                  <Badge variant="outline" className="gap-1 text-warning">
                    <WarningIcon weight="duotone" className="size-3" />
                    {playlist.unmatchedTracks} unmatched
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className="gap-1 text-muted-foreground"
                >
                  <ArrowsClockwiseIcon
                    weight="duotone"
                    className="size-3 animate-spin"
                  />
                  {pendingCount} remaining
                </Badge>
              </div>
            ) : null}

            {isReady ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {playlist.readyTracks > 0 ? (
                  <Badge variant="outline" className="gap-1 text-primary">
                    <CheckCircleIcon weight="duotone" className="size-3" />
                    {playlist.readyTracks} playable
                  </Badge>
                ) : null}
                {playlist.unmatchedTracks > 0 ? (
                  <Badge variant="outline" className="gap-1 text-warning">
                    <WarningIcon weight="duotone" className="size-3" />
                    {playlist.unmatchedTracks} unmatched
                  </Badge>
                ) : null}
              </div>
            ) : null}

            {isFailed ? (
              <div className="mt-2">
                <Alert variant="destructive">
                  <XCircleIcon weight="duotone" />
                  <AlertTitle>Import failed</AlertTitle>
                  <AlertDescription>
                    Try importing the playlist again. If it keeps failing,
                    double check the playlist URL/ID.
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </Link>
    </li>
  )
}

