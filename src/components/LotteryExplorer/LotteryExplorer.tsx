import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { lotteryMarkets, statusLabel } from '@/data'
import { onNavigateClick } from '@/lib/navigation'

export function LotteryExplorer() {
  const reduce = useReducedMotion()
  const [selectedId, setSelectedId] = useState(lotteryMarkets[0]?.id ?? '')
  const selected =
    lotteryMarkets.find((m) => m.id === selectedId) ?? lotteryMarkets[0]

  return (
    <section id="lotteries" className="section explorer" tabIndex={-1}>
      <div className="section__inner">
        <header className="section__header">
          <p className="section__eyebrow">Global Lottery Explorer</p>
          <h2 className="section__title">Explore Lotteries Around the World</h2>
          <p className="section__lead">
            One data source powers the globe, explorer, and apps — select a
            region to inspect lottery coverage and LottoERY products.
          </p>
        </header>

        <div className="explorer__layout">
          <div
            className="explorer__tabs"
            role="tablist"
            aria-label="Lottery regions"
          >
            {lotteryMarkets.map((market) => (
              <button
                key={market.id}
                type="button"
                role="tab"
                id={`tab-${market.id}`}
                aria-selected={selectedId === market.id}
                aria-controls={`panel-${market.id}`}
                className={`explorer__tab ${selectedId === market.id ? 'is-active' : ''}`}
                style={{ '--accent': market.accent } as React.CSSProperties}
                onClick={() => setSelectedId(market.id)}
              >
                <span className="explorer__tab-dot" aria-hidden="true" />
                <span>
                  <strong>{market.region}</strong>
                  <small>{statusLabel(market.status)}</small>
                </span>
              </button>
            ))}
          </div>

          {selected && (
            <motion.article
              key={selected.id}
              id={`panel-${selected.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${selected.id}`}
              className="explorer__detail"
              style={{ '--accent': selected.accent } as React.CSSProperties}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="explorer__detail-top">
                <div>
                  <p className="explorer__detail-region">{selected.country}</p>
                  <h3>{selected.product ?? selected.lottery}</h3>
                  <p className="explorer__detail-lottery">{selected.lottery}</p>
                </div>
                <span className={`status-pill status-pill--${selected.status}`}>
                  {statusLabel(selected.status)}
                </span>
              </div>
              <p className="explorer__detail-desc">{selected.description}</p>
              {selected.features.length > 0 && (
                <ul className="explorer__features">
                  {selected.features.map((f) => (
                    <li key={f.id}>{f.label}</li>
                  ))}
                </ul>
              )}
              <a
                href={selected.ctaHref}
                className="btn btn--gold"
                onClick={(e) => onNavigateClick(e, selected.ctaHref)}
              >
                {selected.ctaLabel}
              </a>
            </motion.article>
          )}
        </div>

        <div className="explorer__grid explorer__grid--compact">
          {lotteryMarkets.map((market, index) => (
            <motion.button
              key={market.id}
              type="button"
              className={`explorer-card explorer-card--button ${selectedId === market.id ? 'is-active' : ''}`}
              style={{ '--accent': market.accent } as React.CSSProperties}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              onClick={() => setSelectedId(market.id)}
            >
              <div className="explorer-card__top">
                <span className="explorer-card__region">{market.region}</span>
                <span className={`status-pill status-pill--${market.status}`}>
                  {statusLabel(market.status)}
                </span>
              </div>
              <h3 className="explorer-card__title">
                {market.product ?? market.lottery}
              </h3>
              <p className="explorer-card__lottery">{market.lottery}</p>
              <p className="explorer-card__desc">{market.shortBlurb}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  )
}

export default LotteryExplorer
