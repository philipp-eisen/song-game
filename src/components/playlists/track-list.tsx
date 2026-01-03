import { MusicNotesIcon } from '@phosphor-icons/react'
import { TrackItem } from './track-item'
import type { TrackData } from './track-item'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface TrackListProps {
  tracks: Array<TrackData>
}

export function TrackList({ tracks }: TrackListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracks</CardTitle>
        <CardDescription>
          All tracks in this playlist. Playable tracks are matched to Apple
          Music for preview playback.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MusicNotesIcon
              weight="duotone"
              className="mb-4 size-12 text-muted-foreground/50"
            />
            <p className="text-muted-foreground">No tracks in this playlist</p>
          </div>
        ) : (
          <ul className="divide-y">
            {tracks.map((track) => (
              <TrackItem key={track._id} track={track} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

