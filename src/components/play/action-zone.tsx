import { useMutation } from 'convex/react'
import { useState } from 'react'
import {
  ArrowRightIcon,
  CoinIcon,
  EyeIcon,
  FastForwardIcon,
} from '@phosphor-icons/react'

import { api } from '../../../convex/_generated/api'
import { MysteryCardStack } from './mystery-card-stack'
import type { GameData, PlayerData } from './types'
import { Button } from '@/components/ui/button'

interface ActionZoneProps {
  game: GameData
  activePlayer: PlayerData
  isActivePlayer: boolean
  isHost: boolean
  /** Number of cards remaining in the deck */
  cardsRemaining: number
  /** Whether the mystery card has been placed */
  isCardPlaced: boolean
  /** Whether dragging is disabled */
  dragDisabled?: boolean
}

export function ActionZone({
  game,
  activePlayer,
  isActivePlayer,
  isHost,
  cardsRemaining,
  isCardPlaced,
  dragDisabled,
}: ActionZoneProps) {
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

  // Card stack is only draggable during placement phases when it's the active player's turn
  const canDragCard =
    isActivePlayer &&
    (game.phase === 'awaitingPlacement' || game.phase === 'awaitingReveal') &&
    !isCardPlaced &&
    !dragDisabled

  // Key to force remount when draggability changes - ensures dnd-kit re-registers
  const stackKey = `${canDragCard}-${game.currentRound?.card?.title ?? 'none'}`

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/30 p-4">
      {/* Left side: Mystery card stack - always visible */}
      <div className="shrink-0">
        <MysteryCardStack
          key={stackKey}
          cardsRemaining={cardsRemaining}
          disabled={!canDragCard}
        />
      </div>

      {/* Right side: Action buttons */}
      <div className="flex flex-1 flex-col items-end gap-2">
        <ActionButtons
          game={game}
          activePlayer={activePlayer}
          isActivePlayer={isActivePlayer}
          isHost={isHost}
          loading={loading}
          onAction={handleAction}
          skipRound={skipRound}
          revealCard={revealCard}
          resolveRound={resolveRound}
          tradeTokensForCard={tradeTokensForCard}
          claimGuessToken={claimGuessToken}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}

interface ActionButtonsProps {
  game: GameData
  activePlayer: PlayerData
  isActivePlayer: boolean
  isHost: boolean
  loading: boolean
  onAction: (action: () => Promise<unknown>) => Promise<void>
  skipRound: ReturnType<typeof useMutation<typeof api.turns.skipRound>>
  revealCard: ReturnType<typeof useMutation<typeof api.turns.revealCard>>
  resolveRound: ReturnType<typeof useMutation<typeof api.turns.resolveRound>>
  tradeTokensForCard: ReturnType<typeof useMutation<typeof api.turns.tradeTokensForCard>>
  claimGuessToken: ReturnType<typeof useMutation<typeof api.turns.claimGuessToken>>
}

function ActionButtons({
  game,
  activePlayer,
  isActivePlayer,
  isHost,
  loading,
  onAction,
  skipRound,
  revealCard,
  resolveRound,
  tradeTokensForCard,
  claimGuessToken,
}: ActionButtonsProps) {
  const myPlayer = game.players.find((p) => p.isCurrentUser)

  // awaitingPlacement phase - active player buttons
  if (game.phase === 'awaitingPlacement' && isActivePlayer) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {game.useTokens && activePlayer.tokenBalance >= 1 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              onAction(() =>
                skipRound({
                  gameId: game._id,
                  actingPlayerId: activePlayer._id,
                }),
              )
            }
            disabled={loading}
          >
            <FastForwardIcon weight="duotone" className="size-4" />
            Skip Song
          </Button>
        )}
        {game.useTokens && activePlayer.tokenBalance >= 3 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              onAction(() =>
                tradeTokensForCard({
                  gameId: game._id,
                  actingPlayerId: activePlayer._id,
                }),
              )
            }
            disabled={loading}
          >
            <CoinIcon weight="duotone" className="size-4" />
            Auto-place
          </Button>
        )}
      </div>
    )
  }

  // awaitingReveal phase
  if (game.phase === 'awaitingReveal') {
    if (isActivePlayer || isHost) {
      return (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="lg"
            className="gap-2"
            onClick={() =>
              onAction(() =>
                revealCard({
                  gameId: game._id,
                  actingPlayerId: activePlayer._id,
                }),
              )
            }
            disabled={loading}
          >
            <EyeIcon weight="duotone" className="size-5" />
            Reveal!
          </Button>
          {isActivePlayer &&
            game.useTokens &&
            activePlayer.tokenBalance >= 3 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  onAction(() =>
                    tradeTokensForCard({
                      gameId: game._id,
                      actingPlayerId: activePlayer._id,
                    }),
                  )
                }
                disabled={loading}
              >
                <CoinIcon weight="duotone" className="size-4" />
                Auto-place
              </Button>
            )}
        </div>
      )
    }
    return null
  }

  // revealed phase
  if (game.phase === 'revealed') {
    const alreadyClaimed = game.currentRound?.bets.some(
      (b) => b.bettorPlayerId === myPlayer?._id,
    )

    return (
      <div className="flex flex-wrap justify-end gap-2">
        {(isActivePlayer || isHost) && (
          <Button
            className="gap-2"
            onClick={() =>
              onAction(() =>
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
                onAction(() =>
                  tradeTokensForCard({
                    gameId: game._id,
                    actingPlayerId: activePlayer._id,
                  }),
                )
              }
              disabled={loading}
            >
              <CoinIcon weight="duotone" className="size-4" />
              Auto-place
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
                onAction(() =>
                  claimGuessToken({
                    gameId: game._id,
                    actingPlayerId: myPlayer._id,
                  }),
                )
              }
              disabled={loading}
            >
              <CoinIcon weight="duotone" className="size-4" />
              Claim Bonus
            </Button>
          )}
      </div>
    )
  }

  return null
}
