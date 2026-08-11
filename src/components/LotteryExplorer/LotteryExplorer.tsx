import { motion, useReducedMotion } from 'framer-motion'
import { lotteryRegions } from '@/data'

const statusLabel = (status: string) =>
  status === 'live' ? 'Available' : 'Coming Soon'

export function LotteryExplorer() {
  const reduce = useReducedMotion()

  return (
    <section id="lotteries" className="section explorer">
      <div className="section__inner">
        <header className="section__header">
          <p className="section__eyebrow">Global Lottery Explorer</p>
          <h2 className="section__title">Explore the World of Lotteries</h2>
          <p className="section__lead">
            Discover regions, lotteries, and LottoERY apps across an expanding
            digital planet — built to grow with every new market.
          </p>
        </header>

        <div className="explorer__grid">
          {lotteryRegions.map((region, index) => (
            <motion.article
              key={region.id}
              className={`explorer-card explorer-card--${region.status}`}
              style={{ '--accent': region.accent } as React.CSSProperties}
              initial={reduce ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: index * 0.08 }}
              whileHover={reduce ? undefined : { y: -6, rotateX: 2 }}
            >
              <div className="explorer-card__glow" aria-hidden="true" />
              <div className="explorer-card__top">
                <span className="explorer-card__region">{region.region}</span>
                <span
                  className={`status-pill status-pill--${region.status}`}
                >
                  {statusLabel(region.status)}
                </span>
              </div>
              <h3 className="explorer-card__title">
                {region.product ?? region.lottery}
              </h3>
              <p className="explorer-card__lottery">{region.lottery}</p>
              <p className="explorer-card__desc">{region.description}</p>
              <div className="explorer-card__meta">
                <span>{region.country ?? region.region}</span>
                <span>
                  {region.product ? 'LottoERY App' : 'On the roadmap'}
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default LotteryExplorer
