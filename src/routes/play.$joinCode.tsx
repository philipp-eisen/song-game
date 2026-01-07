import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import {
  FinishedView,
  GameControlsBar,
  GameHeader,
  LobbyView,
  TurnPrompt,
} from '@/components/play'
import {
  getAllTimelinesQuery,
  getGameByJoinCodeQuery,
} from '@/lib/convex-queries'
import { authClient } from '@/lib/auth-client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/play/$joinCode')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      getGameByJoinCodeQuery(params.joinCode),
    )
  },
  component: GamePage,
})

function GamePage() {
  const { joinCode } = Route.useParams()
  const { data: game } = useSuspenseQuery(getGameByJoinCodeQuery(joinCode))
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const joinByCode = useMutation(api.games.joinByCode)

  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false)

  // Auto-join when user opens link and game query returns null (not yet in game)
  useEffect(() => {
    // Don't attempt join if:
    // - Already in the game
    // - Already attempting/attempted join
    // - Session is still loading
    if (game || isJoining || hasAttemptedJoin || isSessionPending) {
      return
    }

    const attemptJoin = async () => {
      setIsJoining(true)
      setJoinError(null)
      try {
        // If not logged in, sign in as anonymous first
        if (!session) {
          await authClient.signIn.anonymous()
        }
        await joinByCode({ joinCode: joinCode.toUpperCase() })
        // Success! The query will automatically update and show the game
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : 'Failed to join game')
      } finally {
        setIsJoining(false)
        setHasAttemptedJoin(true)
      }
    }

    attemptJoin()
  }, [
    game,
    isJoining,
    hasAttemptedJoin,
    isSessionPending,
    session,
    joinByCode,
    joinCode,
  ])

  // Show loading state while joining
  if (isJoining) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <Spinner className="size-8" />
            <p className="text-muted-foreground">Joining game...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show error if join failed
  if (!game && joinError) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Unable to Join Game</CardTitle>
            <CardDescription>{joinError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link to="/" />}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show not found if no game and no join error (game doesn't exist or not accessible)
  if (!game) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Game Not Found</CardTitle>
            <CardDescription>
              This game doesn't exist or you don't have access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link to="/" />}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isActiveGame = game.phase !== 'lobby' && game.phase !== 'finished'

  // Active game layout: header + player status bar + controls
  if (isActiveGame) {
    return <ActiveGameView game={game} />
  }

  // Lobby/Finished layout: standard scrolling page
  return (
    <div className="space-y-4 p-4">
      <GameHeader game={game} />
      {game.phase === 'lobby' && <LobbyView game={game} />}
      {game.phase === 'finished' && <FinishedView game={game} />}
    </div>
  )
}

// Separate component for active game to use suspense query for timelines
function ActiveGameView({
  game,
}: {
  game: NonNullable<typeof api.games.get._returnType>
}) {
  const { data: timelines } = useSuspenseQuery(getAllTimelinesQuery(game._id))
  const timelineData = timelines ?? []

  const activePlayer = game.players.find(
    (p) => p.seatIndex === game.currentTurnSeatIndex,
  )
  const isActivePlayer =
    activePlayer?.isCurrentUser ||
    (activePlayer?.kind === 'local' && game.isCurrentUserHost)

  return (
    <div className="space-y-4 p-4">
      <GameHeader game={game} />
      <TurnPrompt
        game={game}
        activePlayer={activePlayer}
        isActivePlayer={!!isActivePlayer}
      />
      <GameControlsBar game={game} timelines={timelineData} />
    </div>
  )
}
