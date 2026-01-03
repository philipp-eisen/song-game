import {
  CheckCircleIcon,
  ClockIcon,
  MusicNotesIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PlaylistStatusSummaryProps {
  imageUrl?: string
  description?: string
  totalTracks: number
  readyTracks: number
  unmatchedTracks: number
  status: 'importing' | 'processing' | 'ready' | 'failed'
}

export function PlaylistStatusSummary({
  imageUrl,
  description,
  totalTracks,
  readyTracks,
  unmatchedTracks,
  status,
}: PlaylistStatusSummaryProps) {
  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        {/* Playlist image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="size-20 shrink-0 rounded-lg object-cover shadow-md sm:size-24"
          />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-muted shadow-md sm:size-24">
            <MusicNotesIcon
              weight="duotone"
              className="size-10 text-muted-foreground sm:size-12"
            />
          </div>
        )}

        {/* Info and badges */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-sm">
              <MusicNotesIcon weight="duotone" className="size-4" />
              {totalTracks} total
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-sm text-primary">
              <CheckCircleIcon weight="duotone" className="size-4" />
              {readyTracks} playable
            </Badge>
            {unmatchedTracks > 0 && (
              <Badge variant="outline" className="gap-1.5 text-sm text-warning">
                <WarningIcon weight="duotone" className="size-4" />
                {unmatchedTracks} unmatched
              </Badge>
            )}
            {status === 'processing' && (
              <Badge variant="outline" className="gap-1.5 text-sm">
                <ClockIcon weight="duotone" className="size-4 animate-pulse" />
                Processing...
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

