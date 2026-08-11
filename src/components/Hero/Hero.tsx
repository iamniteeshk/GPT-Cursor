import { lazy, Suspense, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { brand, lotteryRegions, statusLabel } from '@/data'

const Globe = lazy(() =>
  import('@/components/Globe').then((m) => ({ default: m.Globe })),
)

export function Hero() {
  const [selectedId, setSelectedId] = useState<string>(
    lotteryRegions[1]?.id ?? lotteryRegions[0]?.id ?? 'united-states',
  )
  const reduce = useReducedMotion()
  const selected =
    lotteryRegions.find((r) => r.id === selectedId) ?? lotteryRegions[0]
  const { scrollY } = useScroll()
  const contentY = useTransform(scrollY, [0, 420], [0, reduce ? 0 : 24])
  const globeY = useTransform(scrollY, [0, 420], [0, reduce ? 0 : -14])
  const scrollOpacity = useTransform(scrollY, [0, 160], [1, 0])

  return (
    <section id="home" className="hero">
      <div className="hero__atmosphere" aria-hidden="true" />
      <div className="hero__grid" aria-hidden="true" />
      <div
        className="hero__orb-glow"
        style={
          { '--accent': selected?.accent ?? '#4FC3F7' } as React.CSSProperties
        }
        aria-hidden="true"
      />

      <motion.div className="hero__content" style={{ y: contentY }}>
        <motion.p
          className="hero__brand"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          {brand.name}
        </motion.p>

        <motion.h1
          className="hero__title"
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.06 }}
        >
          <span>ONE WORLD.</span>
          <span>MANY LOTTERIES.</span>
        </motion.h1>

        <motion.p
          className="hero__lead"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.14 }}
        >
          Explore lottery apps, insights, predictions and tools from around the
          world.
        </motion.p>

        <motion.div
          className="hero__actions"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.2 }}
        >
          <a href="#lotteries" className="btn btn--gold">
            Explore Lotteries
          </a>
          <a href="#apps" className="btn btn--ghost">
            Explore Apps
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        className="hero__globe-wrap"
        style={{ y: globeY }}
        initial={reduce ? false : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero__globe-stage">
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
        </div>

        <div
          className="hero__region-rail"
          role="list"
          aria-label="Lottery regions"
        >
          {lotteryRegions.map((region) => (
            <button
              key={region.id}
              type="button"
              role="listitem"
              className={`hero__region-btn ${selectedId === region.id ? 'is-active' : ''}`}
              style={{ '--accent': region.accent } as React.CSSProperties}
              onClick={() => setSelectedId(region.id)}
            >
              <span className="hero__region-dot" />
              <span className="hero__region-copy">
                <strong>{region.region}</strong>
                <small>
                  {region.status === 'available'
                    ? region.product
                    : 'Coming Soon'}
                </small>
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {selected && (
        <motion.aside
          className="hero__panel"
          key={selected.id}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ '--accent': selected.accent } as React.CSSProperties}
        >
          <div className="hero__panel-top">
            <p className="hero__panel-region">{selected.region}</p>
            <span className={`status-pill status-pill--${selected.status}`}>
              {statusLabel(selected.status)}
            </span>
          </div>
          <h2 className="hero__panel-product">
            {selected.product ?? 'More lottery experiences'}
          </h2>
          <p className="hero__panel-lottery">{selected.lottery}</p>
          <p className="hero__panel-desc">{selected.description}</p>
          <a href={selected.ctaHref} className="hero__panel-cta">
            {selected.status === 'available' ? 'Explore App' : 'See Roadmap'}{' '}
            <span aria-hidden="true">→</span>
          </a>
        </motion.aside>
      )}

      <motion.a
        href="#lotteries"
        className="hero__scroll"
        style={{ opacity: scrollOpacity }}
        aria-label="Explore the world"
      >
        <span>Explore the world</span>
        <span className="hero__scroll-arrow" aria-hidden="true">
          ↓
        </span>
      </motion.a>
    </section>
  )
}

export default Hero
