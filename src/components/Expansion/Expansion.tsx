import { motion, useReducedMotion } from 'framer-motion'
import { expansionRegions } from '@/data'

export function Expansion() {
  const reduce = useReducedMotion()

  return (
    <section id="expansion" className="section expansion" tabIndex={-1}>
      <div className="section__inner">
        <header className="section__header">
          <p className="section__eyebrow">Future Expansion</p>
          <h2 className="section__title">More of the World Is Coming</h2>
          <p className="section__lead">
            New nodes join the LottoERY orbit through data — clearly marked as
            upcoming, never as live products.
          </p>
        </header>

        <div className="expansion__viz" aria-hidden="true">
          <div className="expansion__hub">LottoERY</div>
          <div className="expansion__rings">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="expansion__grid">
          {expansionRegions.map((region, index) => (
            <motion.article
              key={region.id}
              className="expansion-card"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
              whileHover={reduce ? undefined : { y: -4 }}
            >
              <div className="expansion-card__orbit" aria-hidden="true" />
              <div className="expansion-card__top">
                <h3>{region.name}</h3>
                <span className="status-pill status-pill--coming-soon">
                  Coming Soon
                </span>
              </div>
              <p>{region.blurb}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Expansion
