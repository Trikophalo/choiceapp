import { useState } from 'react'
import { hashSeed } from '@/lib/random'

/** Deterministic, pleasant gradient per card — used when a source has no
 *  photo (OSM restaurants, activities) or when an image fails to load, so a
 *  missing picture still looks designed rather than broken. */
const PALETTES: Array<[string, string]> = [
  ['#FF6B5A', '#FFA83D'],
  ['#7C5CFF', '#FF6B9D'],
  ['#12B3A8', '#66D97F'],
  ['#F5A524', '#FF6B5A'],
  ['#4C7DFF', '#12B3A8'],
  ['#FF5A87', '#FFB454'],
  ['#8E6BFF', '#4CC8FF'],
]

interface CardArtProps {
  src?: string
  title: string
  seed?: string
  className?: string
  eager?: boolean
}

export function CardArt({ src, title, seed, className = '', eager }: CardArtProps) {
  const [failed, setFailed] = useState(false)
  const [from, to] = PALETTES[hashSeed(seed ?? title) % PALETTES.length]
  const initial = title.trim().charAt(0).toUpperCase() || '?'

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
        aria-hidden="true"
      >
        <span className="text-[clamp(4rem,22vw,7rem)] font-semibold text-white/85 drop-shadow-sm select-none">
          {initial}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover select-none ${className}`}
    />
  )
}
