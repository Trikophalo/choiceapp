import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

const COLORS = ['#FF6B5A', '#FFA83D', '#7C5CFF', '#12B3A8', '#FF5A87']

/** Lightweight CSS/motion confetti for the match reveal — no canvas library,
 *  and it stays out of the way for reduced-motion users. */
export function Confetti({ count = 26 }: { count?: number }) {
  const reduced = useReducedMotion()

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: (i * 97) % 100,
        delay: (i % 7) * 0.08,
        duration: 2.2 + ((i * 13) % 10) / 10,
        color: COLORS[i % COLORS.length],
        rotate: (i * 47) % 360,
        size: 6 + ((i * 5) % 6),
      })),
    [count],
  )

  if (reduced) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute top-0 block rounded-[2px]"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.6,
            backgroundColor: piece.color,
          }}
          initial={{ y: -40, opacity: 0, rotate: 0 }}
          animate={{ y: '105vh', opacity: [0, 1, 1, 0], rotate: piece.rotate + 360 }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: 'easeIn',
          }}
        />
      ))}
    </div>
  )
}
