import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { GameData } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useActionState,
  useMyPlayer,
  useWrapAction,
} from '@/stores/play-game-store'

interface BetControlsProps {
  game: GameData
}

export function BetControls({ game }: BetControlsProps) {
  const myPlayer = useMyPlayer()
  const { loading, error } = useActionState()
  const wrapAction = useWrapAction()

  // Form state stays local
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  const placeBet = useMutation(api.turns.placeBet)

  const handleBet = async () => {
    if (selectedSlot === null || !myPlayer) return
    try {
      await wrapAction(async () => {
        await placeBet({
          gameId: game._id,
          actingPlayerId: myPlayer._id,
          slotIndex: selectedSlot,
        })
        setSelectedSlot(null)
      })
    } catch {
      // Error is already handled by wrapAction
    }
  }

  if (!myPlayer) return null

  const existingBets = game.currentRound?.bets ?? []
  const alreadyBet = existingBets.some((b) => b.bettorPlayerId === myPlayer._id)

  if (alreadyBet) {
    return (
      <p className="text-sm text-muted-foreground">
        You've already placed a bet this round
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <Input
        type="number"
        min={0}
        placeholder="Slot index to bet on"
        value={selectedSlot ?? ''}
        onChange={(e) =>
          setSelectedSlot(e.target.value ? parseInt(e.target.value) : null)
        }
        className="w-32"
      />
      <Button
        variant="secondary"
        onClick={handleBet}
        disabled={loading || selectedSlot === null}
      >
        Place Bet (1 Token)
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
