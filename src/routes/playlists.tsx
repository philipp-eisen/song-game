import { createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { PlaylistIcon } from '@phosphor-icons/react'
import { listMyPlaylistsQuery } from '@/lib/convex-queries'
import { ImportPlaylistCard, PlaylistsList } from '@/components/playlists'

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
  const { data: playlists } = useSuspenseQuery(listMyPlaylistsQuery())

  return (
    <section className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <PlaylistIcon weight="duotone" className="size-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Playlists</h1>
          <p className="text-muted-foreground">
            Import public Spotify playlists to use in your games
          </p>
        </div>
      </header>

      <ImportPlaylistCard />
      <PlaylistsList playlists={playlists} />
    </section>
  )
}
