import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { GameData } from './types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface LobbyViewProps {
  game: GameData
}

export function LobbyView({ game }: LobbyViewProps) {
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
      await addLocalPlayer({
        gameId: game._id,
        displayName: newPlayerName.trim(),
      })
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
      navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete game')
    }
  }

  const handleLeave = async () => {
    try {
      await leaveGame({ gameId: game._id })
      navigate({ to: '/' })
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
            <p className="text-sm font-medium">
              Players ({game.players.length})
            </p>
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
              <Button
                onClick={handleAddPlayer}
                disabled={!newPlayerName.trim()}
              >
                Add
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2">
            {isHost ? (
              <>
                <Button
                  onClick={handleStart}
                  disabled={loading || game.players.length < 1}
                >
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
          <div>
            {game.mode === 'hostOnly' ? 'Single Device' : 'Multi-Device'}
          </div>
          <div>Tokens:</div>
          <div>
            {game.useTokens
              ? `Yes (${game.startingTokens} start, ${game.maxTokens} max)`
              : 'No'}
          </div>
          <div>Win at:</div>
          <div>{game.winCondition} cards</div>
          <div>Deck:</div>
          <div>{game.deckRemaining} cards</div>
        </CardContent>
      </Card>
    </div>
  )
}
