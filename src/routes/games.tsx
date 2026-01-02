import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import {
  DotsThreeVerticalIcon,
  GameControllerIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { listMyGamesQuery } from '@/lib/convex-queries'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const Route = createFileRoute('/games')({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: '/' })
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(listMyGamesQuery())
  },
  component: GamesPage,
})

function GamesPage() {
  const { data: session } = authClient.useSession()
  const { data: games } = useSuspenseQuery(listMyGamesQuery())
  const deleteGame = useMutation(api.games.deleteGame)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (gameId: Id<'games'>) => {
    setDeleting(gameId)
    try {
      await deleteGame({ gameId })
    } catch (err) {
      console.error('Failed to delete game:', err)
    } finally {
      setDeleting(null)
    }
  }

  const isGuest = session?.user.email.includes('guest.songgame.local')

  return (
    <section className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <GameControllerIcon weight="duotone" className="size-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">My Games</h1>
          <p className="text-muted-foreground">
            View and manage your active games
          </p>
        </div>
      </header>

      {games.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GameControllerIcon
              weight="duotone"
              className="mb-4 size-16 text-muted-foreground/50"
            />
            <CardTitle className="mb-2 text-lg">No games yet</CardTitle>
            <CardDescription className="mb-4 text-center">
              {isGuest
                ? 'Join a game using a code or sign in to create your own.'
                : 'Create a new game to get started.'}
            </CardDescription>
            <Button render={<Link to="/" />}>
              {isGuest ? 'Go to Home' : 'Create a Game'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Games</CardTitle>
            <CardDescription>
              {games.length} game{games.length !== 1 && 's'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {games.map((game) => (
              <article
                key={game._id}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <Link
                  to="/play/$joinCode"
                  params={{ joinCode: game.joinCode }}
                  className="flex-1"
                >
                  <p className="font-medium">
                    {game.playlistName ?? 'Unknown playlist'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Code: <span className="font-mono">{game.joinCode}</span> •{' '}
                    {game.playerCount} player{game.playerCount !== 1 && 's'}
                  </p>
                </Link>
                <nav className="flex items-center gap-2">
                  <Badge
                    variant={game.phase === 'lobby' ? 'secondary' : 'default'}
                  >
                    {game.phase}
                  </Badge>
                  {game.isHost && <Badge variant="outline">Host</Badge>}
                  {game.isHost && game.phase === 'lobby' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={deleting === game._id}
                          >
                            <DotsThreeVerticalIcon weight="duotone" className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.preventDefault()
                            handleDelete(game._id)
                          }}
                        >
                          <TrashIcon weight="duotone" className="mr-2 h-4 w-4" />
                          Delete Game
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </nav>
              </article>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  )
}

