import {
  CheckCircleIcon,
  SealQuestionIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

import { ConfettiBurst } from './confetti-burst'
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
    imageUrl?: string | null
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
  const [shouldShake, setShouldShake] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  // Trigger shake animation when revealed as wrong
  useEffect(() => {
    if (isRevealed && isCorrect === false) {
      // Delay shake to happen after flip completes
      const timer = setTimeout(() => {
        setShouldShake(true)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [isRevealed, isCorrect])

  // Trigger confetti when revealed as correct
  useEffect(() => {
    if (isRevealed && isCorrect === true) {
      let hideTimer: NodeJS.Timeout | undefined
      // Delay confetti to sync with flip animation completion
      const showTimer = setTimeout(() => {
        setShowConfetti(true)
        // Auto-hide confetti after animation
        hideTimer = setTimeout(() => setShowConfetti(false), 800)
      }, 500)
      return () => {
        clearTimeout(showTimer)
        if (hideTimer) clearTimeout(hideTimer)
      }
    }
  }, [isRevealed, isCorrect])

  // Reset state when card changes
  useEffect(() => {
    setShowCard(true)
    setShouldShake(false)
    setShowConfetti(false)
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
          {/* Confetti burst for correct answers */}
          <ConfettiBurst isActive={showConfetti} />

          {/* Card container for flip + shake */}
          <motion.div
            className="relative h-full w-full"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{
              rotateY: isRevealed ? 180 : 0,
              x: shouldShake ? [0, -8, 8, -6, 6, -4, 4, 0] : 0,
            }}
            transition={{
              rotateY: { duration: 0.6, ease: 'easeInOut' },
              x: { duration: 0.5, ease: 'easeInOut' },
            }}
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
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary/70 p-2"
    >
      <CardContent className="flex flex-col items-center justify-center gap-2 p-0">
        <SealQuestionIcon
          className="h-16 w-16 text-primary-foreground/90"
          weight="duotone"
        />
        <span className="text-xs font-medium text-primary-foreground/80">
          Mystery Card
        </span>
      </CardContent>
    </Card>
  )
}

interface RevealedCardFaceProps {
  cardData?: {
    title: string
    releaseYear: number
    artistName?: string
    imageUrl?: string | null
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
    <div className="relative h-full w-full">
      {/* Glow effect behind card */}
      {isRevealed && isCorrect !== undefined && (
        <motion.div
          className={cn(
            'absolute -inset-1 rounded-2xl',
            isCorrect ? 'bg-success/20' : 'bg-destructive/20',
          )}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0.4, 0.8, 0.4],
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            boxShadow: isCorrect
              ? '0 0 20px hsl(var(--success)), 0 0 40px hsl(var(--success) / 0.5)'
              : '0 0 20px hsl(var(--destructive)), 0 0 40px hsl(var(--destructive) / 0.5)',
          }}
        />
      )}

      <Card
        size="sm"
        className={cn(
          'relative h-full w-full items-center gap-1 overflow-visible p-2 text-center transition-colors duration-300',
          isRevealed &&
            isCorrect === true &&
            'ring-2 ring-success ring-offset-1 ring-offset-background',
          isRevealed &&
            isCorrect === false &&
            'ring-2 ring-destructive ring-offset-1 ring-offset-background',
        )}
      >
        <CardContent className="flex flex-col items-center gap-0 overflow-hidden p-0">
          {cardData?.imageUrl && (
            <img
              src={cardData.imageUrl}
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

        {/* Result badge overlay - correct */}
        {isRevealed && isCorrect === true && (
          <motion.div
            className="absolute -right-3 -top-3 rounded-full bg-success p-1 shadow-lg"
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: 1,
            }}
            transition={{
              delay: 0.3,
              duration: 0.5,
              scale: { delay: 0.5, duration: 0.4, repeat: 2 },
            }}
          >
            <CheckCircleIcon className="h-6 w-6 text-white" weight="duotone" />
          </motion.div>
        )}

        {/* Result badge overlay - wrong */}
        {isRevealed && isCorrect === false && (
          <motion.div
            className="absolute -right-3 -top-3 rounded-full bg-destructive p-1 shadow-lg"
            initial={{ scale: 0, opacity: 0, rotate: -180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{
              delay: 0.8,
              duration: 0.4,
              type: 'spring',
              stiffness: 200,
            }}
          >
            <XCircleIcon className="h-6 w-6 text-white" weight="duotone" />
          </motion.div>
        )}
      </Card>
    </div>
  )
}

/** Draggable mystery card for placement - used in the controls bar */
export function DraggableMysteryCard({ className }: { className?: string }) {
  return (
    <Card
      size="sm"
      className={cn(
        'flex h-40 w-28 shrink-0 cursor-grab items-center justify-center',
        'bg-gradient-to-br from-primary to-primary/70',
        'ring-2 ring-primary/50 ring-offset-2 ring-offset-background',
        'shadow-lg shadow-primary/30',
        'transition-transform hover:scale-105 active:scale-95 active:cursor-grabbing',
        className,
      )}
    >
      <CardContent className="flex flex-col items-center justify-center gap-2 p-0">
        <SealQuestionIcon
          className="size-14 animate-pulse text-primary-foreground/90"
          weight="duotone"
        />
        <span className="text-xs font-medium text-primary-foreground/80">
          Drag to place
        </span>
      </CardContent>
    </Card>
  )
}
