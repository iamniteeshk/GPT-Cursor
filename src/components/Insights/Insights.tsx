import { motion, useReducedMotion } from 'framer-motion'
import { insightFeatures } from '@/data'

const icons: Record<string, string> = {
  results: '◉',
  analysis: '◈',
  predictions: '✧',
  picks: '✦',
  history: '◷',
  stats: '▣',
  rankings: '▲',
  insights: '◎',
}

export function Insights() {
  const reduce = useReducedMotion()

  return (
    <section id="insights" className="section insights">
      <div className="section__inner">
        <header className="section__header">
          <p className="section__eyebrow">Value Beyond Apps</p>
          <h2 className="section__title">Enhanced Results for You</h2>
          <p className="section__lead">
            LottoERY products turn lottery data into clarity — analysis,
            probability insights, statistics, and personalized tools. Never a
            guarantee of winnings; always a smarter way to explore the numbers.
          </p>
        </header>

        <div className="insights__grid">
          {insightFeatures.map((feature, index) => (
            <motion.article
              key={feature.id}
              className="insight-card"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: (index % 4) * 0.06 }}
              whileHover={reduce ? undefined : { y: -4 }}
            >
              <span className="insight-card__icon" aria-hidden="true">
                {icons[feature.icon]}
              </span>
              <h3 className="insight-card__title">{feature.title}</h3>
              <p className="insight-card__desc">{feature.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Insights
