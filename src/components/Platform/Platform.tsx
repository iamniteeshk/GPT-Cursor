import { motion, useReducedMotion } from 'framer-motion'
import { lotteryRegions, statusLabel } from '@/data'

export function Platform() {
  const reduce = useReducedMotion()

  return (
    <section id="about" className="section platform">
      <div className="section__inner">
        <header className="section__header">
          <p className="section__eyebrow">Global Platform Identity</p>
          <h2 className="section__title">One Platform. Many Lottery Experiences.</h2>
          <p className="section__lead">
            LottoERY is a technology ecosystem — not a lottery operator. Regional
            apps orbit one brand, one design language, and one expanding world.
          </p>
        </header>

        <motion.div
          className="platform-tree"
          initial={reduce ? false : { opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <div className="platform-tree__hub">
            <span className="platform-tree__hub-label">LottoERY</span>
            <span className="platform-tree__hub-sub">The Lottery Universe</span>
          </div>

          <div className="platform-tree__connectors" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <div className="platform-tree__branches">
            {lotteryRegions.map((region, i) => (
              <motion.div
                key={region.id}
                className="platform-node"
                style={{ '--accent': region.accent } as React.CSSProperties}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.12 + i * 0.08 }}
              >
                <span className="platform-node__region">{region.region}</span>
                <strong className="platform-node__product">
                  {region.product ?? 'Coming Soon'}
                </strong>
                <span className={`status-pill status-pill--${region.status}`}>
                  {statusLabel(region.status)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <p className="platform__disclaimer">
          LottoERY provides lottery-related applications, information, analysis
          and tools. LottoERY does not operate or conduct lotteries.
        </p>
      </div>
    </section>
  )
}

export default Platform
