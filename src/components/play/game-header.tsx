import { MusicNoteIcon } from '@phosphor-icons/react'

import type { GameData } from './types'

interface GameHeaderProps {
  game: GameData
}

export function GameHeader({ game }: GameHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <MusicNoteIcon weight="duotone" className="size-6 text-primary" />
      <h1 className="truncate text-xl font-bold">
        {game.playlistName ?? 'Song Game'}
      </h1>
    </div>
  )
}

