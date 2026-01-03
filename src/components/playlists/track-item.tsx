import { useState } from 'react'
import { useMutation } from 'convex/react'
import {
  CheckCircleIcon,
  ClockIcon,
  MusicNotesIcon,
  SpotifyLogoIcon,
  TrashIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export interface TrackData {
  _id: Id<'playlistTracks'>
  position: number
  status: 'pending' | 'ready' | 'unmatched'
  title: string
  artistNames: Array<string>
  releaseYear?: number
  previewUrl?: string
  imageUrl?: string
  spotifyTrackId?: string
  unmatchedReason?: string
}

interface TrackItemProps {
  track: TrackData
}

export function TrackItem({ track }: TrackItemProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const removeTrack = useMutation(api.playlists.removeTrack)

  const handleRemove = async () => {
    setIsRemoving(true)
    try {
      await removeTrack({ trackId: track._id })
    } catch (error) {
      console.error('Failed to remove track:', error)
      setIsRemoving(false)
    }
  }

  const isReady = track.status === 'ready'
  const isPending = track.status === 'pending'
  const isUnmatched = track.status === 'unmatched'

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      {/* Track number */}
      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground sm:w-8">
        {track.position + 1}
      </span>

      {/* Track artwork */}
      {track.imageUrl ? (
        <img
          src={track.imageUrl}
          alt=""
          className="size-10 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
          <MusicNotesIcon
            weight="duotone"
            className="size-5 text-muted-foreground"
          />
        </div>
      )}

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{track.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {track.artistNames.join(', ')}
        </p>
      </div>

      {/* Release year (if available) - hide on mobile */}
      {track.releaseYear && (
        <span className="hidden shrink-0 text-sm tabular-nums text-muted-foreground sm:block">
          {track.releaseYear}
        </span>
      )}

      {/* Status badge */}
      {isReady && (
        <Badge variant="secondary" className="hidden shrink-0 gap-1 sm:flex">
          <CheckCircleIcon weight="duotone" className="size-3 text-primary" />
          <span className="hidden md:inline">Matched</span>
        </Badge>
      )}
      {isPending && (
        <Badge variant="outline" className="hidden shrink-0 gap-1 sm:flex">
          <ClockIcon weight="duotone" className="size-3" />
          <span className="hidden md:inline">Pending</span>
        </Badge>
      )}
      {isUnmatched && (
        <Badge
          variant="outline"
          className="hidden shrink-0 gap-1 text-warning sm:flex"
        >
          <XCircleIcon weight="duotone" className="size-3" />
          <span className="hidden md:inline">Unmatched</span>
        </Badge>
      )}

      {/* Mobile-only status indicator */}
      <div className="sm:hidden">
        {isReady && (
          <CheckCircleIcon
            weight="duotone"
            className="size-5 text-primary"
          />
        )}
        {isPending && (
          <ClockIcon weight="duotone" className="size-5 text-muted-foreground" />
        )}
        {isUnmatched && (
          <XCircleIcon weight="duotone" className="size-5 text-warning" />
        )}
      </div>

      {/* Spotify link */}
      {track.spotifyTrackId && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden shrink-0 sm:flex"
          render={
            <a
              href={`https://open.spotify.com/track/${track.spotifyTrackId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Spotify"
            />
          }
        >
          <SpotifyLogoIcon weight="duotone" className="size-4" />
        </Button>
      )}

      {/* Remove button */}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              disabled={isRemoving}
            />
          }
        >
          <TrashIcon weight="duotone" className="size-4" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove track?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{track.title}" by{' '}
              {track.artistNames.join(', ')} from this playlist? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} variant="destructive">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

