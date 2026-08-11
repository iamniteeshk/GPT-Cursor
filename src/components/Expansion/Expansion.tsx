import { motion, useReducedMotion } from 'framer-motion'
import { expansionRegions } from '@/data'

export function Expansion() {
  const reduce = useReducedMotion()

  return (
    <section id="expansion" className="section expansion">
      <div className="section__inner">
        <header className="section__header">
          <p className="section__eyebrow">Future Expansion</p>
          <h2 className="section__title">More of the World Is Coming</h2>
          <p className="section__lead">
            New regions join the LottoERY planet through data — not redesigns.
            Every market below is clearly marked as upcoming.
          </p>
        </header>

        <div className="expansion__grid">
          {expansionRegions.map((region, index) => (
            <motion.article
              key={region.id}
              className="expansion-card"
              initial={reduce ? false : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              whileHover={reduce ? undefined : { y: -5 }}
            >
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
