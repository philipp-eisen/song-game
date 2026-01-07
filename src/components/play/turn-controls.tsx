import { useMutation } from 'convex/react'
import { useState } from 'react'
import {
  ArrowRightIcon,
  CoinIcon,
  EyeIcon,
  FastForwardIcon,
} from '@phosphor-icons/react'

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

  // awaitingPlacement phase - active player sees the drag-drop UI in GameControlsBar
  if (game.phase === 'awaitingPlacement' && isActivePlayer) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {game.useTokens && activePlayer.tokenBalance >= 1 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
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
              <FastForwardIcon weight="duotone" className="size-4" />
              Skip Song (1 token)
            </Button>
          )}
          {game.useTokens && activePlayer.tokenBalance >= 3 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
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
              <CoinIcon weight="duotone" className="size-4" />
              Auto-place (3 tokens)
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  // awaitingPlacement phase - betting for non-active players
  if (game.phase === 'awaitingPlacement' && !isActivePlayer && game.useTokens) {
    const myPlayer = game.players.find((p) => p.isCurrentUser)
    if (myPlayer && myPlayer.tokenBalance >= 1) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bet on where the card should go (costs 1 token)
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
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              className="gap-2"
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
              <EyeIcon weight="duotone" className="size-5" />
              Reveal the Answer!
            </Button>
            {isActivePlayer &&
              game.useTokens &&
              activePlayer.tokenBalance >= 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
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
                  <CoinIcon weight="duotone" className="size-4" />
                  Auto-place (3 tokens)
                </Button>
              )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )
    }
    // Non-active players can still bet
    if (game.useTokens) {
      const myPlayer = game.players.find((p) => p.isCurrentUser)
      if (myPlayer && myPlayer.tokenBalance >= 1) {
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Last chance to place your bet!
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
              className="gap-2"
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
              <ArrowRightIcon weight="duotone" className="size-4" />
              Continue
            </Button>
          )}
          {isActivePlayer &&
            game.useTokens &&
            activePlayer.tokenBalance >= 3 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
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
                <CoinIcon weight="duotone" className="size-4" />
                Auto-place (3 tokens)
              </Button>
            )}
          {game.useTokens &&
            myPlayer &&
            !alreadyClaimed &&
            myPlayer.tokenBalance < game.maxTokens && (
              <Button
                variant="outline"
                className="gap-1.5"
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
                <CoinIcon weight="duotone" className="size-4" />
                Claim Bonus Token
              </Button>
            )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  // Non-active player waiting - no text needed since TurnPrompt handles this
  return null
}
