import { motion, useReducedMotion } from 'framer-motion'
import { lottoApps, statusLabel } from '@/data'
import { onNavigateClick } from '@/lib/navigation'

const platformLabel: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
}

export function AppCards() {
  const reduce = useReducedMotion()

  return (
    <section id="apps" className="section apps" tabIndex={-1}>
      <div className="section__inner">
        <header className="section__header">
          <p className="section__eyebrow">Product Ecosystem</p>
          <h2 className="section__title">LottoERY Apps</h2>
          <p className="section__lead">
            Regional lottery products with shared intelligence — distinct
            identities, one universe.
          </p>
        </header>

        <div className="apps__grid">
          {lottoApps.map((app, index) => {
            const anchor =
              app.id === 'india-kerala'
                ? 'apps-lucky-keralam'
                : app.id === 'united-states'
                  ? 'apps-mega-ball'
                  : `apps-${app.id}`

            return (
              <motion.article
                key={app.id}
                id={anchor}
                className={`app-card app-card--${app.product?.toLowerCase().replace(/\s+/g, '-') ?? app.id}`}
                style={
                  {
                    '--accent': app.accent,
                    '--accent-2': app.accentSecondary,
                  } as React.CSSProperties
                }
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                whileHover={reduce ? undefined : { y: -6 }}
                tabIndex={-1}
              >
                <div className="app-card__visual" aria-hidden="true">
                  <div className="app-card__device">
                    <div className="app-card__device-notch" />
                    <div className="app-card__device-screen">
                      <span className="app-card__device-brand">LottoERY</span>
                      <strong className="app-card__device-name">
                        {app.product}
                      </strong>
                      <span className="app-card__device-lottery">
                        {app.lottery}
                      </span>
                      <div className="app-card__device-pills">
                        {app.features.slice(0, 3).map((f) => (
                          <span key={f.id}>{f.label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="app-card__body">
                  <div className="app-card__badge-row">
                    <span className={`status-pill status-pill--${app.status}`}>
                      {statusLabel(app.status)}
                    </span>
                    <span className="app-card__region">{app.tagline}</span>
                  </div>
                  <h3 className="app-card__name">
                    {(app.product ?? app.region).toUpperCase()}
                  </h3>
                  <p className="app-card__lottery">{app.lottery}</p>
                  <p className="app-card__desc">{app.description}</p>
                  <ul className="app-card__features">
                    {app.features.map((f) => (
                      <li key={f.id}>{f.label}</li>
                    ))}
                  </ul>
                  <div className="app-card__platforms">
                    {app.platforms.map((p) => (
                      <span key={p} className="platform-badge">
                        {platformLabel[p]}
                      </span>
                    ))}
                  </div>
                  <a
                    href={app.ctaHref}
                    className="btn btn--outline app-card__cta"
                    onClick={(e) => onNavigateClick(e, app.ctaHref)}
                  >
                    {app.ctaLabel}
                  </a>
                </div>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default AppCards
