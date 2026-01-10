import { useMutation } from 'convex/react'
import {
  ArrowRightIcon,
  CoinIcon,
  EyeIcon,
  FastForwardIcon,
} from '@phosphor-icons/react'
import { motion } from 'motion/react'

import { api } from '../../../convex/_generated/api'
import type { GameData } from './types'
import { Button } from '@/components/ui/button'
import {
  useActionState,
  useActivePlayer,
  useIsActivePlayer,
  useIsHost,
  useMyPlayer,
  useWrapAction,
} from '@/stores/play-game-store'

/** Wrapper that adds a pulsing glow animation to indicate an active CTA */
function PulsingCtaWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="rounded-lg"
      animate={{
        boxShadow: [
          '0 0 0 0 hsl(var(--primary) / 0.5)',
          '0 0 0 8px hsl(var(--primary) / 0)',
          '0 0 0 0 hsl(var(--primary) / 0.5)',
        ],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  )
}

interface ActionButtonsProps {
  game: GameData
  /** Callback to trigger transition animation before resolving round */
  onBeforeResolve?: () => Promise<void>
}

export function ActionButtons({ game, onBeforeResolve }: ActionButtonsProps) {
  const activePlayer = useActivePlayer()
  const isActivePlayer = useIsActivePlayer()
  const isHost = useIsHost()
  const myPlayer = useMyPlayer()
  const { loading, error } = useActionState()
  const wrapAction = useWrapAction()

  const skipRound = useMutation(api.turns.skipRound)
  const revealCard = useMutation(api.turns.revealCard)
  const resolveRound = useMutation(api.turns.resolveRound)
  const tradeTokensForCard = useMutation(api.turns.tradeTokensForCard)
  const claimGuessToken = useMutation(api.turns.claimGuessToken)

  const onAction = async (action: () => Promise<unknown>) => {
    try {
      await wrapAction(action)
    } catch {
      // Error is already handled by wrapAction and stored in state
    }
  }

  if (!activePlayer) return null

  // awaitingPlacement phase - active player buttons
  if (game.phase === 'awaitingPlacement' && isActivePlayer) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap justify-center gap-2">
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
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  // awaitingReveal phase
  if (game.phase === 'awaitingReveal') {
    if (isActivePlayer || isHost) {
      return (
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
          <PulsingCtaWrapper>
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
          </PulsingCtaWrapper>
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
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )
    }
    return null
  }

  // revealed phase
  if (game.phase === 'revealed') {
    const alreadyClaimed =
      myPlayer?._id &&
      game.currentRound?.tokenClaimers.includes(myPlayer._id)

    const handleContinue = async () => {
      // Trigger transition animation before resolving
      if (onBeforeResolve) {
        await onBeforeResolve()
      }
      await resolveRound({
        gameId: game._id,
        actingPlayerId: activePlayer._id,
      })
    }

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap justify-center gap-2">
        {(isActivePlayer || isHost) && (
          <PulsingCtaWrapper>
            <Button
              className="gap-2"
              onClick={() => onAction(handleContinue)}
              disabled={loading}
            >
              <ArrowRightIcon weight="duotone" className="size-4" />
              Continue
            </Button>
          </PulsingCtaWrapper>
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
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return null
}
