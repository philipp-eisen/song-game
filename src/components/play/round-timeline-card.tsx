import { CheckCircle, SealQuestion, XCircle } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface RoundTimelineCardProps {
  /** Whether to show the revealed (back) side */
  isRevealed: boolean
  /** Whether the placement was correct (only used when revealed) */
  isCorrect?: boolean
  /** Card data to show on the back (revealed side) */
  cardData?: {
    title: string
    releaseYear: number
    artistName?: string
    albumImageUrl?: string | null
  }
  /** Called when the wrong animation completes and the card should be removed */
  onWrongAnimationComplete?: () => void
  className?: string
}

export function RoundTimelineCard({
  isRevealed,
  isCorrect,
  cardData,
  onWrongAnimationComplete,
  className,
}: RoundTimelineCardProps) {
  const [showCard, setShowCard] = useState(true)
  const [hasTriggeredWrongAnimation, setHasTriggeredWrongAnimation] =
    useState(false)

  // When revealed as wrong, wait briefly then trigger disappear animation
  useEffect(() => {
    if (isRevealed && isCorrect === false && !hasTriggeredWrongAnimation) {
      setHasTriggeredWrongAnimation(true)
      const timer = setTimeout(() => {
        setShowCard(false)
      }, 1500) // Show wrong state for 1.5s before disappearing
      return () => clearTimeout(timer)
    }
  }, [isRevealed, isCorrect, hasTriggeredWrongAnimation])

  // Reset state when card changes
  useEffect(() => {
    setShowCard(true)
    setHasTriggeredWrongAnimation(false)
  }, [cardData?.title])

  return (
    <AnimatePresence
      onExitComplete={() => {
        if (isCorrect === false) {
          onWrongAnimationComplete?.()
        }
      }}
    >
      {showCard && (
        <motion.div
          className={cn('relative h-40 w-28 shrink-0', className)}
          style={{ perspective: 1000 }}
          initial={{ opacity: 1, scale: 1 }}
          exit={{
            opacity: 0,
            scale: 0.8,
            y: -20,
            transition: { duration: 0.4, ease: 'easeInOut' },
          }}
        >
          {/* Card container for flip */}
          <motion.div
            className="relative h-full w-full"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: isRevealed ? 180 : 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {/* Front face - Mystery card */}
            <div
              className="absolute inset-0"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <MysteryCardFace />
            </div>

            {/* Back face - Revealed card */}
            <div
              className="absolute inset-0"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <RevealedCardFace
                cardData={cardData}
                isCorrect={isCorrect}
                isRevealed={isRevealed}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MysteryCardFace() {
  return (
    <Card
      size="sm"
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 to-purple-800 p-2"
    >
      <CardContent className="flex flex-col items-center justify-center gap-2 p-0">
        <SealQuestion className="h-16 w-16 text-white/90" weight="duotone" />
        <span className="text-xs font-medium text-white/80">Mystery Card</span>
      </CardContent>
    </Card>
  )
}

interface RevealedCardFaceProps {
  cardData?: {
    title: string
    releaseYear: number
    artistName?: string
    albumImageUrl?: string | null
  }
  isCorrect?: boolean
  isRevealed: boolean
}

function RevealedCardFace({
  cardData,
  isCorrect,
  isRevealed,
}: RevealedCardFaceProps) {
  return (
    <Card
      size="sm"
      className={cn(
        'relative h-full w-full items-center gap-1 p-2 text-center transition-colors duration-300',
        isRevealed &&
          isCorrect === true &&
          'ring-2 ring-green-500 ring-offset-1',
        isRevealed &&
          isCorrect === false &&
          'ring-2 ring-red-500 ring-offset-1',
      )}
    >
      <CardContent className="flex flex-col items-center gap-0 p-0">
        {cardData?.albumImageUrl && (
          <img
            src={cardData.albumImageUrl}
            alt=""
            className="mb-1 h-12 w-12 shrink-0 rounded object-cover"
          />
        )}
        <p
          className="line-clamp-4 h-14 w-full text-xs font-medium leading-[0.875rem]"
          title={cardData?.title}
        >
          {cardData?.title ?? 'Unknown'}
        </p>
        {cardData?.artistName && (
          <p
            className="w-full shrink-0 truncate text-xs text-muted-foreground"
            title={cardData.artistName}
          >
            {cardData.artistName}
          </p>
        )}
        <p className="mt-auto text-sm font-bold text-primary">
          {cardData?.releaseYear ?? '????'}
        </p>
      </CardContent>

      {/* Result badge overlay */}
      {isRevealed && isCorrect !== undefined && (
        <motion.div
          className={cn(
            'absolute -right-2 -top-2 rounded-full p-0.5',
            isCorrect ? 'bg-green-500' : 'bg-red-500',
          )}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3, ease: 'backOut' }}
        >
          {isCorrect ? (
            <CheckCircle className="h-5 w-5 text-white" weight="fill" />
          ) : (
            <XCircle className="h-5 w-5 text-white" weight="fill" />
          )}
        </motion.div>
      )}
    </Card>
  )
}

/** Draggable mystery card for placement - used in the controls bar */
export function DraggableMysteryCard({ className }: { className?: string }) {
  return (
    <Card
      size="sm"
      className={cn(
        'flex h-40 w-28 shrink-0 cursor-grab items-center justify-center bg-gradient-to-br from-violet-600 to-purple-800 p-2 active:cursor-grabbing',
        className,
      )}
    >
      <CardContent className="flex flex-col items-center justify-center gap-2 p-0">
        <SealQuestion className="h-16 w-16 text-white/90" weight="duotone" />
        <span className="text-xs font-medium text-white/80">Drag to place</span>
      </CardContent>
    </Card>
  )
}

