import { lazy, Suspense, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { brand, lotteryRegions } from '@/data'

const Globe = lazy(() =>
  import('@/components/Globe').then((m) => ({ default: m.Globe })),
)

export function Hero() {
  const [selectedId, setSelectedId] = useState<string | null>(
    lotteryRegions[0]?.id ?? null,
  )
  const reduce = useReducedMotion()
  const selected = lotteryRegions.find((r) => r.id === selectedId)

  return (
    <section id="home" className="hero">
      <div className="hero__atmosphere" aria-hidden="true" />
      <div className="hero__grid" aria-hidden="true" />

      <div className="hero__content">
        <motion.p
          className="hero__eyebrow"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {brand.name}
        </motion.p>

        <motion.h1
          className="hero__title"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08 }}
        >
          {brand.tagline}
        </motion.h1>

        <motion.p
          className="hero__lead"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16 }}
        >
          Explore lottery apps, insights, predictions and tools from around the
          world.
        </motion.p>

        <motion.div
          className="hero__actions"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24 }}
        >
          <a href="#lotteries" className="btn btn--gold">
            Explore Lotteries
          </a>
          <a href="#apps" className="btn btn--ghost">
            Explore Apps
          </a>
        </motion.div>

        {selected && (
          <motion.div
            className="hero__region-chip"
            key={selected.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ '--accent': selected.accent } as React.CSSProperties}
          >
            <span className="hero__region-dot" />
            <div>
              <strong>{selected.region}</strong>
              <span>
                {selected.product ?? selected.lottery} ·{' '}
                {selected.status === 'live' ? 'Live' : 'Coming Soon'}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      <motion.div
        className="hero__globe"
        initial={reduce ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense
          fallback={
            <div className="globe-fallback" aria-hidden="true">
              <div className="globe-fallback__orb">
                <div className="globe-fallback__grid" />
              </div>
            </div>
          }
        >
          <Globe selectedId={selectedId} onSelect={setSelectedId} />
        </Suspense>
        <div className="hero__markers" role="list" aria-label="Lottery regions">
          {lotteryRegions.map((region) => (
            <button
              key={region.id}
              type="button"
              role="listitem"
              className={`hero__marker-btn ${selectedId === region.id ? 'is-active' : ''}`}
              style={{ '--accent': region.accent } as React.CSSProperties}
              onClick={() => setSelectedId(region.id)}
            >
              <span className="hero__marker-dot" />
              {region.region}
            </button>
          ))}
        </div>
      </motion.div>
    </section>
  )
}

export default Hero
