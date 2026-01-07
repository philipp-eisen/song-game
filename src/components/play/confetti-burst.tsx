import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'

interface ConfettiBurstProps {
  isActive: boolean
  colors?: Array<string>
}

export function ConfettiBurst({
  isActive,
  colors = [
    'hsl(var(--success))',
    'hsl(142 76% 60%)',
    'hsl(45 93% 58%)',
    'hsl(48 96% 53%)',
  ],
}: ConfettiBurstProps) {
  const particles = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      angle: (i / 16) * 360 + Math.random() * 20 - 10,
      distance: 50 + Math.random() * 40,
      size: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.15,
      rotation: Math.random() * 360,
    }))
  }, [colors])

  return (
    <AnimatePresence>
      {isActive && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
          {particles.map((particle) => {
            const rad = (particle.angle * Math.PI) / 180
            const x = Math.cos(rad) * particle.distance
            const y = Math.sin(rad) * particle.distance

            return (
              <motion.div
                key={particle.id}
                className="absolute left-1/2 top-1/2 rounded-sm"
                style={{
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  marginLeft: -particle.size / 2,
                  marginTop: -particle.size / 2,
                }}
                initial={{
                  x: 0,
                  y: 0,
                  scale: 0,
                  opacity: 1,
                  rotate: 0,
                }}
                animate={{
                  x,
                  y: y - 30,
                  scale: [0, 1.5, 1],
                  opacity: [1, 1, 0],
                  rotate: particle.rotation,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.7,
                  delay: particle.delay,
                  ease: 'easeOut',
                }}
              />
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}
