import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { GameData, PlayerData } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BetControlsProps {
  game: GameData
  myPlayer: PlayerData
}

export function BetControls({ game, myPlayer }: BetControlsProps) {
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
