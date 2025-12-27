import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { BetControls } from './bet-controls'
import type { GameData, PlayerData } from './types'
import { Button } from '@/components/ui/button'

interface TurnControlsProps {
  game: GameData
  activePlayer: PlayerData
  isActivePlayer: boolean
  isHost: boolean
}

export function TurnControls({
  game,
  activePlayer,
  isActivePlayer,
  isHost,
}: TurnControlsProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const startRound = useMutation(api.turns.startRound)
  const skipRound = useMutation(api.turns.skipRound)
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
            onClick={() =>
              handleAction(() =>
                startRound({
                  gameId: game._id,
                  actingPlayerId: activePlayer._id,
                }),
              )
            }
            disabled={loading}
          >
            Draw Card
          </Button>
          {game.useTokens && activePlayer.tokenBalance >= 3 && (
            <Button
              variant="outline"
              onClick={() =>
                handleAction(() =>
                  tradeTokensForCard({
                    gameId: game._id,
                    actingPlayerId: activePlayer._id,
                  }),
                )
              }
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

  // awaitingPlacement phase - active player sees the drag-drop UI in GameControlsBar
  if (game.phase === 'awaitingPlacement' && isActivePlayer) {
    return (
      <div className="space-y-2">
        {game.useTokens && activePlayer.tokenBalance >= 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleAction(() =>
                skipRound({
                  gameId: game._id,
                  actingPlayerId: activePlayer._id,
                }),
              )
            }
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
          <p>
            Card has been placed at position {game.currentRound?.placementIndex}
          </p>
          <Button
            onClick={() =>
              handleAction(() =>
                revealCard({
                  gameId: game._id,
                  actingPlayerId: activePlayer._id,
                }),
              )
            }
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
            <p>
              Card placed at position {game.currentRound?.placementIndex}.
              Waiting for reveal...
            </p>
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
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {(isActivePlayer || isHost) && (
            <Button
              onClick={() =>
                handleAction(() =>
                  resolveRound({
                    gameId: game._id,
                    actingPlayerId: activePlayer._id,
                  }),
                )
              }
              disabled={loading}
            >
              Resolve Round
            </Button>
          )}
          {game.useTokens &&
            myPlayer &&
            !alreadyClaimed &&
            myPlayer.tokenBalance < game.maxTokens && (
              <Button
                variant="outline"
                onClick={() =>
                  handleAction(() =>
                    claimGuessToken({
                      gameId: game._id,
                      actingPlayerId: myPlayer._id,
                    }),
                  )
                }
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
