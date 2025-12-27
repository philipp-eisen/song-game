import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { Id } from '../../convex/_generated/dataModel'
import {
  FinishedView,
  GameControlsBar,
  GameHeader,
  GameView,
  LobbyView,
} from '@/components/play'
import { getGameQuery } from '@/lib/convex-queries'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

export const Route = createFileRoute('/play/$gameId')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      getGameQuery(params.gameId as Id<'games'>),
    )
  },
  component: GamePage,
})

function GamePage() {
  const { gameId } = Route.useParams()
  const { data: game } = useSuspenseQuery(getGameQuery(gameId as Id<'games'>))

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
        </Card>
      </div>
    )
  }

  const isActiveGame = game.phase !== 'lobby' && game.phase !== 'finished'

  // Active game layout: header + controls at top, scrollable timelines below
  if (isActiveGame) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {/* Fixed header section */}
        <div className="shrink-0 space-y-4 p-4 pb-0">
          <GameHeader game={game} />
          <GameControlsBar game={game} />
        </div>

        {/* Scrollable timelines section */}
        <div className="min-h-0 flex-1 p-4">
          <ScrollArea className="h-full">
            <GameView game={game} />
          </ScrollArea>
        </div>
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
