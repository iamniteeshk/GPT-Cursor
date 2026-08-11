import { motion, useReducedMotion } from 'framer-motion'
import { insightArticles } from '@/data'
import { onNavigateClick } from '@/lib/navigation'

export function InsightsPreview() {
  const reduce = useReducedMotion()

  return (
    <section id="insights-preview" className="section insights-preview">
      <div className="section__inner">
        <header className="section__header">
          <p className="section__eyebrow">Editorial</p>
          <h2 className="section__title">LottoERY Insights</h2>
          <p className="section__lead">
            Editorial articles — distinct from live lottery results. Previews
            of how LottoERY thinks about statistics, global lotteries, and
            responsible tools.
          </p>
        </header>

        <div className="articles__grid">
          {insightArticles.map((article, index) => (
            <motion.article
              key={article.id}
              className="article-card"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              whileHover={reduce ? undefined : { y: -4 }}
            >
              <p className="article-card__cat">{article.category}</p>
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
              <a
                href={article.href}
                className="article-card__link"
                onClick={(e) => onNavigateClick(e, article.href)}
              >
                Read preview <span aria-hidden="true">→</span>
              </a>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default InsightsPreview
