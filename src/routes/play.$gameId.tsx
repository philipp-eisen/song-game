import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import {
  getAllTimelinesQuery,
  getCurrentRoundCardQuery,
  getCurrentRoundSongPreviewQuery,
  getGameQuery,
} from '@/lib/convex-queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SpotifyPlayer } from '@/components/spotify-player'

// Type for the game query result
type GameData = NonNullable<FunctionReturnType<typeof api.games.get>>
type PlayerData = GameData['players'][0]
type TimelineData = NonNullable<FunctionReturnType<typeof api.timelines.getAllTimelines>>[0]
type CardData = NonNullable<FunctionReturnType<typeof api.timelines.getCurrentRoundCard>>


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

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{game.playlistName ?? 'Song Game'}</h1>
          <p className="text-muted-foreground">
            Code: <span className="font-mono text-lg">{game.joinCode}</span>
          </p>
        </div>
        <Badge
          variant={game.phase === 'lobby' ? 'secondary' : game.phase === 'finished' ? 'default' : 'outline'}
          className="text-sm"
        >
          {game.phase}
        </Badge>
      </div>

      {game.phase === 'lobby' && <LobbyView game={game} />}
      {game.phase !== 'lobby' && game.phase !== 'finished' && <GameView game={game} />}
      {game.phase === 'finished' && <FinishedView game={game} />}
    </div>
  )
}

function LobbyView({ game }: { game: GameData }) {
  const navigate = useNavigate()
  const isHost = game.isCurrentUserHost

  const startGame = useMutation(api.games.start)
  const addLocalPlayer = useMutation(api.games.addLocalPlayer)
  const removeLocalPlayer = useMutation(api.games.removeLocalPlayer)
  const deleteGame = useMutation(api.games.deleteGame)
  const leaveGame = useMutation(api.games.leave)

  const [newPlayerName, setNewPlayerName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setError(null)
    setLoading(true)
    try {
      await startGame({ gameId: game._id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      setLoading(false)
    }
  }

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return
    setError(null)
    try {
      await addLocalPlayer({ gameId: game._id, displayName: newPlayerName.trim() })
      setNewPlayerName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add player')
    }
  }

  const handleRemovePlayer = async (playerId: Id<'gamePlayers'>) => {
    setError(null)
    try {
      await removeLocalPlayer({ playerId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove player')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this game?')) return
    try {
      await deleteGame({ gameId: game._id })
      navigate({ to: '/game' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete game')
    }
  }

  const handleLeave = async () => {
    try {
      await leaveGame({ gameId: game._id })
      navigate({ to: '/game' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave game')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Lobby</CardTitle>
          <CardDescription>
            {game.mode === 'sidecars'
              ? 'Share the join code with other players'
              : 'Add players to the game'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Players list */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Players ({game.players.length})</p>
            {game.players.map((player) => (
              <div
                key={player._id}
                className="flex items-center justify-between rounded-lg border p-2"
              >
                <div className="flex items-center gap-2">
                  <span>{player.displayName}</span>
                  {player.isHostSeat && <Badge variant="outline">Host</Badge>}
                  {player.isCurrentUser && <Badge>You</Badge>}
                </div>
                {isHost && !player.isHostSeat && game.mode === 'hostOnly' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePlayer(player._id)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Add player (host only mode) */}
          {isHost && game.mode === 'hostOnly' && (
            <div className="flex gap-2">
              <Input
                placeholder="Player name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
              />
              <Button onClick={handleAddPlayer} disabled={!newPlayerName.trim()}>
                Add
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2">
            {isHost ? (
              <>
                <Button onClick={handleStart} disabled={loading || game.players.length < 1}>
                  {loading ? 'Starting...' : 'Start Game'}
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete Game
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleLeave}>
                Leave Game
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Game settings preview */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div>Mode:</div>
          <div>{game.mode === 'hostOnly' ? 'Single Device' : 'Multi-Device'}</div>
          <div>Tokens:</div>
          <div>{game.useTokens ? `Yes (${game.startingTokens} start, ${game.maxTokens} max)` : 'No'}</div>
          <div>Win at:</div>
          <div>{game.winCondition} cards</div>
          <div>Deck:</div>
          <div>{game.deckRemaining} cards</div>
        </CardContent>
      </Card>
    </div>
  )
}

function GameView({ game }: { game: GameData }) {
  const { data: timelines } = useSuspenseQuery(getAllTimelinesQuery(game._id))
  const { data: currentCard } = useQuery(getCurrentRoundCardQuery(game._id))
  const { data: songPreview } = useQuery(getCurrentRoundSongPreviewQuery(game._id))

  const isHost = game.isCurrentUserHost

  const activePlayer = game.players.find((p) => p.seatIndex === game.currentTurnSeatIndex)
  const isActivePlayer =
    activePlayer?.isCurrentUser ||
    (activePlayer?.kind === 'local' && isHost)

  // Show song player during placement phases
  const showSongPlayer = 
    game.phase === 'awaitingPlacement' || 
    game.phase === 'awaitingReveal' || 
    game.phase === 'revealed'

  return (
    <div className="space-y-4">
      {/* Spotify Player - Show during active round */}
      {showSongPlayer && songPreview && (
        <SpotifyPlayer 
          spotifyUri={songPreview.spotifyUri} 
          previewUrl={songPreview.previewUrl} 
        />
      )}

      {/* Current Turn Info */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activePlayer?.displayName}'s Turn
            {isActivePlayer && <Badge className="ml-2">Your Turn</Badge>}
          </CardTitle>
          <CardDescription>
            Phase: {game.phase} • Deck: {game.deckRemaining} cards
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activePlayer && (
            <TurnControls
              game={game}
              activePlayer={activePlayer}
              isActivePlayer={isActivePlayer}
              isHost={isHost}
              currentCard={currentCard ?? null}
            />
          )}
        </CardContent>
      </Card>

      {/* Current Round Card (after reveal) */}
      {currentCard && game.phase === 'revealed' && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle>Current Card</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {currentCard.albumImageUrl && (
                <img
                  src={currentCard.albumImageUrl}
                  alt=""
                  className="h-20 w-20 rounded object-cover"
                />
              )}
              <div>
                <p className="text-xl font-bold">{currentCard.title}</p>
                <p className="text-muted-foreground">{currentCard.artistNames.join(', ')}</p>
                <p className="text-2xl font-bold text-primary">{currentCard.releaseYear}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timelines */}
      {timelines && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Timelines</h2>
          {timelines.map((timeline) => (
            <TimelineView
              key={timeline.playerId}
              timeline={timeline}
              game={game}
              isActivePlayer={timeline.playerId === activePlayer?._id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TurnControls({
  game,
  activePlayer,
  isActivePlayer,
  isHost,
  currentCard,
}: {
  game: GameData
  activePlayer: PlayerData
  isActivePlayer: boolean
  isHost: boolean
  currentCard: CardData | null
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const startRound = useMutation(api.turns.startRound)
  const skipRound = useMutation(api.turns.skipRound)
  const placeCard = useMutation(api.turns.placeCard)
  const revealCard = useMutation(api.turns.revealCard)
  const resolveRound = useMutation(api.turns.resolveRound)
  const tradeTokensForCard = useMutation(api.turns.tradeTokensForCard)
  const claimGuessToken = useMutation(api.turns.claimGuessToken)

  const handleAction = async (action: () => Promise<unknown>) => {
    setError(null)
    setLoading(true)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  // awaitingStart phase
  if (game.phase === 'awaitingStart' && isActivePlayer) {
    return (
      <div className="space-y-4">
        <p>Draw a card to start your turn</p>
        <div className="flex gap-2">
          <Button
            onClick={() => handleAction(() => startRound({ gameId: game._id, actingPlayerId: activePlayer._id }))}
            disabled={loading}
          >
            Draw Card
          </Button>
          {game.useTokens && activePlayer.tokenBalance >= 3 && (
            <Button
              variant="outline"
              onClick={() => handleAction(() => tradeTokensForCard({ gameId: game._id, actingPlayerId: activePlayer._id }))}
              disabled={loading}
            >
              Trade 3 Tokens for Auto-Card
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  // awaitingPlacement phase
  if (game.phase === 'awaitingPlacement' && isActivePlayer) {
    return (
      <div className="space-y-4">
        <p>Select where to place the card on your timeline</p>
        <p className="text-sm text-muted-foreground">
          Enter an index (0 = before first card, higher = after)
        </p>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={0}
            placeholder="Position"
            value={selectedIndex ?? ''}
            onChange={(e) => setSelectedIndex(e.target.value ? parseInt(e.target.value) : null)}
            className="w-24"
          />
          <Button
            onClick={() => selectedIndex !== null && handleAction(() => placeCard({ gameId: game._id, actingPlayerId: activePlayer._id, insertIndex: selectedIndex }))}
            disabled={loading || selectedIndex === null}
          >
            Place Card
          </Button>
        </div>
        {game.useTokens && activePlayer.tokenBalance >= 1 && (
          <Button
            variant="outline"
            onClick={() => handleAction(() => skipRound({ gameId: game._id, actingPlayerId: activePlayer._id }))}
            disabled={loading}
          >
            Skip (1 Token)
          </Button>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  // awaitingPlacement phase - betting for non-active players
  if (game.phase === 'awaitingPlacement' && !isActivePlayer && game.useTokens) {
    const myPlayer = game.players.find((p) => p.isCurrentUser)
    if (myPlayer && myPlayer.tokenBalance >= 1) {
      return (
        <div className="space-y-4">
          <p>{activePlayer.displayName} is placing their card...</p>
          <p className="text-sm text-muted-foreground">
            You can bet on where you think the card should go (costs 1 token)
          </p>
          <BetControls game={game} myPlayer={myPlayer} />
        </div>
      )
    }
  }

  // awaitingReveal phase
  if (game.phase === 'awaitingReveal') {
    if (isActivePlayer || isHost) {
      return (
        <div className="space-y-4">
          <p>Card has been placed at position {game.currentRound?.placementIndex}</p>
          <Button
            onClick={() => handleAction(() => revealCard({ gameId: game._id, actingPlayerId: activePlayer._id }))}
            disabled={loading}
          >
            Reveal Card
          </Button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )
    }
    // Non-active players can still bet
    if (game.useTokens) {
      const myPlayer = game.players.find((p) => p.isCurrentUser)
      if (myPlayer && myPlayer.tokenBalance >= 1) {
        return (
          <div className="space-y-4">
            <p>Card placed at position {game.currentRound?.placementIndex}. Waiting for reveal...</p>
            <BetControls game={game} myPlayer={myPlayer} />
          </div>
        )
      }
    }
  }

  // revealed phase
  if (game.phase === 'revealed') {
    const myPlayer = game.players.find((p) => p.isCurrentUser)
    const alreadyClaimed = game.currentRound?.bets.some(
      (b) => b.bettorPlayerId === myPlayer?._id,
    )

    return (
      <div className="space-y-4">
        <p>Card revealed! {currentCard?.title} by {currentCard?.artistNames.join(', ')} ({currentCard?.releaseYear})</p>
        <div className="flex gap-2 flex-wrap">
          {(isActivePlayer || isHost) && (
            <Button
              onClick={() => handleAction(() => resolveRound({ gameId: game._id, actingPlayerId: activePlayer._id }))}
              disabled={loading}
            >
              Resolve Round
            </Button>
          )}
          {game.useTokens && myPlayer && !alreadyClaimed && myPlayer.tokenBalance < game.maxTokens && (
            <Button
              variant="outline"
              onClick={() => handleAction(() => claimGuessToken({ gameId: game._id, actingPlayerId: myPlayer._id }))}
              disabled={loading}
            >
              Claim Guess Token (+1)
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <p className="text-muted-foreground">
      Waiting for {activePlayer.displayName}...
    </p>
  )
}

function BetControls({ game, myPlayer }: { game: GameData; myPlayer: PlayerData }) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const placeBet = useMutation(api.turns.placeBet)

  const handleBet = async () => {
    if (selectedSlot === null) return
    setError(null)
    setLoading(true)
    try {
      await placeBet({
        gameId: game._id,
        actingPlayerId: myPlayer._id,
        slotIndex: selectedSlot,
      })
      setSelectedSlot(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bet')
    } finally {
      setLoading(false)
    }
  }

  const existingBets = game.currentRound?.bets ?? []
  const alreadyBet = existingBets.some((b) => b.bettorPlayerId === myPlayer._id)

  if (alreadyBet) {
    return <p className="text-sm text-muted-foreground">You've already placed a bet this round</p>
  }

  return (
    <div className="space-y-2">
      <Input
        type="number"
        min={0}
        placeholder="Slot index to bet on"
        value={selectedSlot ?? ''}
        onChange={(e) => setSelectedSlot(e.target.value ? parseInt(e.target.value) : null)}
        className="w-32"
      />
      <Button
        variant="secondary"
        onClick={handleBet}
        disabled={loading || selectedSlot === null}
      >
        Place Bet (1 Token)
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

function TimelineView({
  timeline,
  game,
  isActivePlayer,
}: {
  timeline: TimelineData
  game: GameData
  isActivePlayer: boolean
}) {
  const player = game.players.find((p) => p._id === timeline.playerId)

  return (
    <Card className={isActivePlayer ? 'border-2 border-primary' : ''}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {timeline.displayName}
            {timeline.isCurrentUser && <Badge className="ml-2">You</Badge>}
            {isActivePlayer && <Badge variant="outline" className="ml-2">Active</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {timeline.cards.length} cards
            </span>
            {game.useTokens && (
              <Badge variant="secondary">{player?.tokenBalance ?? 0} tokens</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {timeline.cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cards yet</p>
          ) : (
            timeline.cards.map((card) => (
              <div
                key={card._id}
                className="flex-shrink-0 rounded-lg border bg-card p-2 text-center"
                style={{ minWidth: '120px' }}
              >
                {card.albumImageUrl && (
                  <img
                    src={card.albumImageUrl}
                    alt=""
                    className="mx-auto mb-1 h-12 w-12 rounded object-cover"
                  />
                )}
                <p className="text-xs font-medium truncate" title={card.title}>
                  {card.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {card.artistNames[0]}
                </p>
                <p className="text-sm font-bold text-primary">{card.releaseYear}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function FinishedView({ game }: { game: GameData }) {
  const winner = game.players.find((p) => p._id === game.winnerId)
  const { data: timelines } = useSuspenseQuery(getAllTimelinesQuery(game._id))

  return (
    <div className="space-y-4">
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="text-2xl">Game Over!</CardTitle>
          <CardDescription>
            {winner
              ? `${winner.displayName} wins with ${game.winCondition}+ cards!`
              : 'The game has ended'}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Final Timelines */}
      {timelines && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Final Timelines</h2>
          {[...timelines]
            .sort((a, b) => b.cards.length - a.cards.length)
            .map((timeline, index) => (
              <Card key={timeline.playerId} className={index === 0 ? 'border-2 border-primary' : ''}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {index === 0 && '🏆 '}
                      {timeline.displayName}
                      {timeline.isCurrentUser && <Badge className="ml-2">You</Badge>}
                    </CardTitle>
                    <span className="text-lg font-bold">{timeline.cards.length} cards</span>
                  </div>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {timeline.cards.map((card) => (
                      <div
                        key={card._id}
                        className="flex-shrink-0 rounded-lg border bg-card p-2 text-center"
                        style={{ minWidth: '100px' }}
                      >
                        <p className="text-xs font-medium truncate">{card.title}</p>
                        <p className="text-sm font-bold text-primary">{card.releaseYear}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
