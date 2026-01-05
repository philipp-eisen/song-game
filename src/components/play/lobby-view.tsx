import { CheckIcon, CopyIcon, LinkIcon, UsersIcon } from '@phosphor-icons/react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
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
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    const gameUrl = `${window.location.origin}/play/${game.joinCode}`
    try {
      await navigator.clipboard.writeText(gameUrl)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

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
      {/* Invite Players Card - only for sidecars mode */}
      {game.mode === 'sidecars' && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UsersIcon weight="duotone" className="size-5 text-primary" />
              <CardTitle className="text-lg">Invite Players</CardTitle>
            </div>
            <CardDescription>
              Share this link with friends to invite them to the game
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Join Code</p>
              <p className="font-mono text-2xl font-bold tracking-wider">
                {game.joinCode}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
              <LinkIcon
                weight="duotone"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <div className="flex-1 truncate font-mono text-sm">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/play/${game.joinCode}`
                  : `/play/${game.joinCode}`}
              </div>
              <Button
                onClick={handleCopyLink}
                size="sm"
                variant="ghost"
                className="shrink-0"
              >
                {copied ? (
                  <CheckIcon weight="duotone" className="size-4" />
                ) : (
                  <CopyIcon weight="duotone" className="size-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lobby</CardTitle>
          <CardDescription>
            {game.mode === 'sidecars'
              ? 'Waiting for players to join'
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
