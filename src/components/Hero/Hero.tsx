import { lazy, Suspense, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { brand, lotteryRegions, statusLabel } from '@/data'
import { onNavigateClick } from '@/lib/navigation'

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
  const contentY = useTransform(scrollY, [0, 420], [0, reduce ? 0 : 20])
  const globeY = useTransform(scrollY, [0, 420], [0, reduce ? 0 : -12])
  const scrollOpacity = useTransform(scrollY, [0, 160], [1, 0])

  return (
    <section id="home" className="hero" aria-labelledby="hero-brand">
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
          id="hero-brand"
          className="hero__brand"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <span className="hero__brand-mark" aria-hidden="true" />
          <span className="hero__brand-text">{brand.name}</span>
        </motion.p>

        <motion.h1
          className="hero__title"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
        >
          <span>ONE WORLD.</span>
          <span>MANY LOTTERIES.</span>
        </motion.h1>

        <motion.p
          className="hero__lead"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Explore lottery apps, insights, predictions and tools from around the
          world — analysis and information, never ticket sales.
        </motion.p>

        <motion.div
          className="hero__actions"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.14 }}
        >
          <a
            href="#lotteries"
            className="btn btn--gold"
            onClick={(e) => onNavigateClick(e, '#lotteries')}
          >
            Explore Lotteries
          </a>
          <a
            href="#apps"
            className="btn btn--ghost"
            onClick={(e) => onNavigateClick(e, '#apps')}
          >
            Explore Apps
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        className="hero__globe-wrap"
        style={{ y: globeY }}
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
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
          role="listbox"
          aria-label="Lottery regions"
        >
          {lotteryRegions.map((region) => (
            <button
              key={region.id}
              type="button"
              role="option"
              aria-selected={selectedId === region.id}
              className={`hero__region-btn ${selectedId === region.id ? 'is-active' : ''}`}
              style={{ '--accent': region.accent } as React.CSSProperties}
              onClick={() => setSelectedId(region.id)}
            >
              <span className="hero__region-dot" aria-hidden="true" />
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
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{ '--accent': selected.accent } as React.CSSProperties}
          aria-live="polite"
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
          {selected.status === 'available' ? (
            <a
              href={selected.ctaHref}
              className="hero__panel-cta"
              onClick={(e) => onNavigateClick(e, selected.ctaHref)}
            >
              Explore App <span aria-hidden="true">→</span>
            </a>
          ) : (
            <a
              href="#expansion"
              className="hero__panel-cta"
              onClick={(e) => onNavigateClick(e, '#expansion')}
            >
              See Roadmap <span aria-hidden="true">→</span>
            </a>
          )}
        </motion.aside>
      )}

      <motion.a
        href="#lotteries"
        className="hero__scroll"
        style={{ opacity: scrollOpacity }}
        aria-label="Explore the world of lotteries"
        onClick={(e) => onNavigateClick(e, '#lotteries')}
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
