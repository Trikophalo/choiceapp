import { useEffect, useRef } from 'react'
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  type PanInfo,
} from 'framer-motion'
import type { Card, SwipeDirection } from '@/types'
import { CardArt } from './CardArt'

/* Interaction constants — the feel of the whole app lives here. */
const ROTATION_DIVISOR = 20
const MAX_ROTATION = 14
const COMMIT_RATIO = 0.35 // fraction of card width
const COMMIT_VELOCITY = 500 // px/s fling
const STAMP_START = 40 // px of drag before stamps appear

interface SwipeCardProps {
  card: Card
  /** 0 = top card, 1 = next, 2 = the one behind that. */
  depth: number
  isTop: boolean
  onSwipe: (direction: SwipeDirection) => void
  /** Set to fire a programmatic swipe from buttons or the keyboard. */
  triggered?: SwipeDirection | null
  labels: { like: string; nope: string; details: string }
  /** Opens the detail sheet. A tap must never count as a swipe. */
  onOpenDetails?: () => void
}

export function SwipeCard({
  card,
  depth,
  isTop,
  onSwipe,
  triggered,
  labels,
  onOpenDetails,
}: SwipeCardProps) {
  const x = useMotionValue(0)
  const controls = useAnimationControls()

  const rotate = useTransform(x, (value) =>
    Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, value / ROTATION_DIVISOR)),
  )
  const likeOpacity = useTransform(x, [STAMP_START, 140], [0, 1])
  const nopeOpacity = useTransform(x, [-140, -STAMP_START], [1, 0])

  const flyOut = async (direction: SwipeDirection, velocity = 0) => {
    const target = direction === 'like' ? 1 : -1
    await controls.start({
      x: target * (window.innerWidth + 240),
      y: 24,
      rotate: target * 22,
      opacity: 0,
      transition: {
        duration: Math.max(0.25, Math.min(0.35, 260 / (Math.abs(velocity) + 700))),
        ease: [0.32, 0.72, 0, 1],
      },
    })
    onSwipe(direction)
  }

  // Buttons and arrow keys reuse the same exit animation as a real drag.
  // `fired` makes the fly-out idempotent, so a re-render can never replay it.
  const fired = useRef(false)
  useEffect(() => {
    if (isTop && triggered && !fired.current) {
      fired.current = true
      void flyOut(triggered)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggered, isTop])

  const dragged = useRef(false)

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // Remember that this gesture moved, so the click that follows is ignored.
    dragged.current = Math.abs(info.offset.x) > 6 || Math.abs(info.offset.y) > 6

    const threshold = Math.max(80, window.innerWidth * COMMIT_RATIO * 0.6)
    const passedDistance = Math.abs(info.offset.x) > threshold
    const passedVelocity = Math.abs(info.velocity.x) > COMMIT_VELOCITY

    if (passedDistance || passedVelocity) {
      void flyOut(info.offset.x > 0 ? 'like' : 'nope', info.velocity.x)
      return
    }
    // Below threshold: spring back to centre.
    void controls.start({
      x: 0,
      y: 0,
      rotate: 0,
      transition: { type: 'spring', stiffness: 500, damping: 30 },
    })
  }

  return (
    // Outer layer owns the stack presentation (scale/offset as cards are
    // promoted); the inner layer owns drag and the fly-out, so the two
    // animations never fight over the same element.
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - depth, pointerEvents: isTop ? 'auto' : 'none' }}
      initial={false}
      animate={{ scale: 1 - depth * 0.05, y: depth * 12 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <motion.div
        className="h-full w-full touch-card"
        style={{ x: isTop ? x : 0, rotate: isTop ? rotate : 0 }}
        animate={controls}
        initial={false}
        drag={isTop ? 'x' : false}
        dragElastic={0.65}
        dragConstraints={{ left: 0, right: 0 }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false // Consume the click that ends a drag.
            return
          }
          if (isTop) onOpenDetails?.()
        }}
      >
      <article
        data-testid="card"
        data-top={isTop ? 'true' : 'false'}
        className="relative h-full w-full overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-card"
      >
        <div className="absolute inset-0">
          <CardArt
            src={card.imageUrl}
            title={card.title}
            seed={card.accentSeed}
            className="h-full w-full"
            eager={depth === 0}
          />
        </div>

        {/* Scrim keeps the title legible over any photo. */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

        {card.badge && (
          <div className="absolute right-4 top-4 rounded-full bg-black/45 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md">
            {card.badge}
          </div>
        )}

        {isTop && onOpenDetails && (
          <button
            type="button"
            aria-label={labels.details}
            // Stop the press from starting a drag on the card underneath.
            onPointerDownCapture={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onOpenDetails()
            }}
            className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition hover:scale-110 hover:bg-black/65 active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 7.6v.2" />
            </svg>
          </button>
        )}


        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h2 className="text-[1.6rem] font-semibold leading-tight tracking-tight text-white drop-shadow-sm sm:text-3xl">
            {card.title}
          </h2>
          {card.subtitle && (
            <p className="mt-1.5 line-clamp-2 text-[0.95rem] leading-snug text-white/80">
              {card.subtitle}
            </p>
          )}
        </div>

        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-xl border-[3px] border-like px-4 py-1.5 text-2xl font-bold uppercase tracking-wider text-like backdrop-blur-[2px]"
            >
              {labels.like}
            </motion.div>
            <motion.div
              style={{ opacity: nopeOpacity }}
              className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-xl border-[3px] border-nope px-4 py-1.5 text-2xl font-bold uppercase tracking-wider text-nope backdrop-blur-[2px]"
            >
              {labels.nope}
            </motion.div>
          </>
        )}
      </article>
      </motion.div>
    </motion.div>
  )
}
