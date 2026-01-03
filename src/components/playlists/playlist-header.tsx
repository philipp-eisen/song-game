import { Link } from '@tanstack/react-router'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface PlaylistHeaderProps {
  name: string
}

export function PlaylistHeader({ name }: PlaylistHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" render={<Link to="/playlists" />}>
        <ArrowLeftIcon weight="duotone" className="size-5" />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold sm:text-2xl">
        {name}
      </h1>
    </div>
  )
}

