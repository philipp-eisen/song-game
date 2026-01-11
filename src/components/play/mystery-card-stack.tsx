import { useDraggable } from '@dnd-kit/core'
import { SealQuestionIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const MYSTERY_CARD_ID = 'mystery-card'

interface MysteryCardStackProps {
  /** Number of cards remaining in the deck */
  cardsRemaining: number
  /** Whether dragging is disabled */
  disabled?: boolean
}

export function MysteryCardStack({
  cardsRemaining,
  disabled,
}: MysteryCardStackProps) {
  // Only hide if deck is empty
  if (cardsRemaining <= 0) {
    return (
      <div className="flex h-40 w-28 shrink-0 items-center justify-center">
        <p className="text-center text-xs text-muted-foreground">
          No cards left
        </p>
      </div>
    )
  }

  return <DraggableCardStack cardsRemaining={cardsRemaining} disabled={disabled} />
}

function DraggableCardStack({
  cardsRemaining,
  disabled,
}: {
  cardsRemaining: number
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: MYSTERY_CARD_ID,
    disabled,
  })

  const isInactive = disabled || isDragging

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'relative shrink-0 touch-none',
        disabled
          ? 'cursor-not-allowed'
          : 'cursor-grab active:cursor-grabbing',
      )}
    >
      {/* Stack container with perspective */}
      <motion.div
        className="relative h-40 w-28"
        whileHover={disabled ? undefined : 'hover'}
        initial="idle"
        animate={isDragging ? 'dragging' : 'idle'}
      >
        {/* Back cards (stack effect) - more pronounced offset for visibility */}
        <motion.div
          className="absolute inset-0"
          variants={{
            idle: { rotate: -4, x: 8, y: 8 },
            hover: { rotate: -6, x: 10, y: 10 },
            dragging: { rotate: -4, x: 8, y: 8 },
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <StackCard variant="back" disabled={isInactive} />
        </motion.div>

        <motion.div
          className="absolute inset-0"
          variants={{
            idle: { rotate: -2, x: 4, y: 4 },
            hover: { rotate: -3, x: 5, y: 5 },
            dragging: { rotate: -2, x: 4, y: 4 },
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <StackCard variant="middle" disabled={isInactive} />
        </motion.div>

        {/* Top card (main draggable card) */}
        <motion.div
          className="relative"
          variants={{
            idle: {
              y: 0,
              scale: 1,
              rotate: [0, -3, 2.5, -2, 1.5, -1, 0],
            },
            hover: { y: -4, scale: 1.02, rotate: 0 },
            dragging: { y: 0, scale: 1, rotate: 0 },
            disabled: { y: 0, scale: 1, rotate: 0 },
          }}
          animate={isDragging ? 'dragging' : disabled ? 'disabled' : 'idle'}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 20,
            rotate: {
              duration: 0.8,
              repeat: Infinity,
              repeatDelay: 3,
              ease: 'easeInOut',
            },
          }}
        >
          <TopCard disabled={isInactive} />
        </motion.div>

        {/* Deck counter badge */}
        <motion.div
          className={cn(
            'absolute -right-2 -top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold shadow-md',
            isInactive
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary text-primary-foreground',
          )}
          key={cardsRemaining}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.3 }}
        >
          {cardsRemaining}
        </motion.div>

        {/* Animated glow effect - only when active */}
        {!isInactive && (
          <motion.div
            className="pointer-events-none absolute -inset-2 -z-10 rounded-2xl"
            animate={{
              boxShadow: [
                '0 0 20px 4px hsl(var(--primary) / 0.2)',
                '0 0 25px 6px hsl(var(--primary) / 0.3)',
                '0 0 20px 4px hsl(var(--primary) / 0.2)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </motion.div>
    </div>
  )
}

function StackCard({
  variant,
  disabled,
}: {
  variant: 'back' | 'middle'
  disabled?: boolean
}) {
  return (
    <Card
      size="sm"
      className={cn(
        'flex h-full w-full items-center justify-center shadow-md',
        disabled
          ? 'bg-gradient-to-br from-muted to-muted/70'
          : 'bg-gradient-to-br from-primary/80 to-primary/50',
        variant === 'back' && 'opacity-60',
        variant === 'middle' && 'opacity-80',
      )}
    />
  )
}

function TopCard({ disabled }: { disabled?: boolean }) {
  return (
    <Card
      size="sm"
      className={cn(
        'flex h-40 w-28 shrink-0 items-center justify-center',
        disabled
          ? 'bg-gradient-to-br from-muted to-muted/70 ring-2 ring-muted-foreground/20 ring-offset-2 ring-offset-background'
          : 'bg-gradient-to-br from-primary to-primary/70 ring-2 ring-primary/50 ring-offset-2 ring-offset-background shadow-lg shadow-primary/30',
      )}
    >
      <CardContent className="flex flex-col items-center justify-center gap-2 p-0">
        <motion.div
          animate={disabled ? {} : { scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <SealQuestionIcon
            className={cn(
              'size-14',
              disabled
                ? 'text-muted-foreground/60'
                : 'text-primary-foreground/90',
            )}
            weight="duotone"
          />
        </motion.div>
        <span
          className={cn(
            'text-xs font-medium',
            disabled
              ? 'text-muted-foreground/60'
              : 'text-primary-foreground/80',
          )}
        >
          {disabled ? 'Waiting...' : 'Drag to place'}
        </span>
      </CardContent>
    </Card>
  )
}
