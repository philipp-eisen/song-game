import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface GameCardProps {
  title: string
  releaseYear: number
  artistName?: string
  imageUrl?: string | null
  className?: string
}

export function GameCard({
  title,
  releaseYear,
  artistName,
  imageUrl,
  className,
}: GameCardProps) {
  return (
    <Card
      size="sm"
      className={cn(
        'h-40 w-28 shrink-0 items-center gap-1 p-2 text-center',
        className,
      )}
    >
      <CardContent className="flex flex-col items-center gap-0 overflow-hidden p-0">
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="mb-1 h-12 w-12 shrink-0 rounded object-cover"
          />
        )}
        <p
          className="line-clamp-4 h-14 w-full text-xs font-medium leading-[0.875rem]"
          title={title}
        >
          {title}
        </p>
        {artistName && (
          <p
            className="w-full shrink-0 truncate text-xs text-muted-foreground"
            title={artistName}
          >
            {artistName}
          </p>
        )}
        <p className="mt-auto text-sm font-bold text-primary">{releaseYear}</p>
      </CardContent>
    </Card>
  )
}
