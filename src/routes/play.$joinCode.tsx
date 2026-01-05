import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import {
  FinishedView,
  GameControlsBar,
  GameHeader,
  LobbyView,
} from '@/components/play'
import { getGameByJoinCodeQuery } from '@/lib/convex-queries'
import { authClient } from '@/lib/auth-client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  const { data: game, refetch } = useSuspenseQuery(getGameByJoinCodeQuery(joinCode))
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const queryClient = useQueryClient()
  
  const joinByCode = useMutation(api.games.joinByCode)
  const [autoJoinState, setAutoJoinState] = useState<'idle' | 'joining' | 'done' | 'error'>('idle')
  const [autoJoinError, setAutoJoinError] = useState<string | null>(null)

  // Auto-join logic: if user visits a game link and is not yet a player, try to join
  useEffect(() => {
    const attemptAutoJoin = async () => {
      // Skip if already processed or game data is loaded (user is already in game)
      if (autoJoinState !== 'idle') return
      if (game) return // User is already a player or host
      if (sessionPending) return // Wait for session to load
      
      setAutoJoinState('joining')
      
      try {
        // If not logged in, sign in as anonymous first
        if (!session) {
          await authClient.signIn.anonymous()
        }
        
        // Try to join the game
        await joinByCode({ joinCode: joinCode.toUpperCase() })
        
        // Invalidate and refetch game data
        await queryClient.invalidateQueries({ queryKey: getGameByJoinCodeQuery(joinCode).queryKey })
        await refetch()
        
        setAutoJoinState('done')
      } catch (err) {
        // If join fails (game already started, hostOnly mode, etc.), just show the error
        setAutoJoinState('error')
        setAutoJoinError(err instanceof Error ? err.message : 'Failed to join game')
      }
    }
    
    attemptAutoJoin()
  }, [game, session, sessionPending, joinCode, joinByCode, queryClient, refetch, autoJoinState])

  // Show loading while auto-joining
  if (autoJoinState === 'joining') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4">
        <Spinner className="size-8" />
        <p className="text-muted-foreground">Joining game...</p>
      </div>
    )
  }

  // Show error if auto-join failed and user has no access
  if (!game) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Game Not Found</CardTitle>
            <CardDescription>
              {autoJoinError || "This game doesn't exist or you don't have access."}
            </CardDescription>
          </CardHeader>
          {autoJoinError && (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The game may have already started or may not accept new players.
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    )
  }

  const isActiveGame = game.phase !== 'lobby' && game.phase !== 'finished'

  // Active game layout: header + controls (active timeline shown in controls)
  if (isActiveGame) {
    return (
      <div className="space-y-4 p-4">
        <GameHeader game={game} />
        <GameControlsBar game={game} />
      </div>
    )
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
