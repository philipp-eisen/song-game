import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import type { Id } from '../../convex/_generated/dataModel'
import { getPlaylistWithAllTracksQuery } from '@/lib/convex-queries'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  PlaylistHeader,
  PlaylistStatusSummary,
  TrackList,
} from '@/components/playlists'

export const Route = createFileRoute('/playlists_/$playlistId')({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: '/' })
    }
  },
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      getPlaylistWithAllTracksQuery(params.playlistId as Id<'playlists'>),
    )
  },
  component: PlaylistDetailPage,
})

function PlaylistDetailPage() {
  const { playlistId } = Route.useParams()
  const { data: playlist } = useSuspenseQuery(
    getPlaylistWithAllTracksQuery(playlistId as Id<'playlists'>),
  )

  if (!playlist) {
    return (
      <section className="mx-auto max-w-4xl p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Playlist Not Found</CardTitle>
            <CardDescription>
              This playlist doesn't exist or you don't have access to it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link to="/playlists" />}>
              <ArrowLeftIcon weight="duotone" className="size-4" />
              Back to Playlists
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <PlaylistHeader name={playlist.name} />

      <PlaylistStatusSummary
        imageUrl={playlist.imageUrl}
        description={playlist.description}
        totalTracks={playlist.totalTracks}
        readyTracks={playlist.readyTracks}
        unmatchedTracks={playlist.unmatchedTracks}
        status={playlist.status}
      />

      <TrackList tracks={playlist.tracks} />
    </section>
  )
}
