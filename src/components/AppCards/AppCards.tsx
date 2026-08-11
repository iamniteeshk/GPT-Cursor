import { motion, useReducedMotion } from 'framer-motion'
import { lottoApps } from '@/data'

const platformLabel: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
}

export function AppCards() {
  const reduce = useReducedMotion()

  return (
    <section id="apps" className="section apps">
      <div className="section__inner">
        <header className="section__header">
          <p className="section__eyebrow">Product Ecosystem</p>
          <h2 className="section__title">LottoERY Apps</h2>
          <p className="section__lead">
            Premium lottery apps for regional markets — unified under one global
            technology brand.
          </p>
        </header>

        <div className="apps__grid">
          {lottoApps.map((app, index) => (
            <motion.article
              key={app.id}
              className="app-card"
              style={{ '--accent': app.accent } as React.CSSProperties}
              initial={reduce ? false : { opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={
                reduce
                  ? undefined
                  : {
                      y: -10,
                      rotateY: index % 2 === 0 ? -2 : 2,
                      rotateX: 2,
                    }
              }
            >
              <div className="app-card__shine" aria-hidden="true" />
              <div className="app-card__badge-row">
                <span className="status-pill status-pill--live">Live</span>
                <span className="app-card__region">{app.region}</span>
              </div>
              <h3 className="app-card__name">{app.name}</h3>
              <p className="app-card__lottery">{app.lottery}</p>
              <p className="app-card__desc">{app.description}</p>
              <div className="app-card__platforms">
                {app.platforms.map((p) => (
                  <span key={p} className="platform-badge">
                    {platformLabel[p]}
                  </span>
                ))}
              </div>
              <a href={app.ctaHref} className="btn btn--outline app-card__cta">
                {app.ctaLabel}
              </a>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default AppCards
