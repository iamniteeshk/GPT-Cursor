import { motion, useReducedMotion } from 'framer-motion'
import { howSteps } from '@/data'

export function HowItWorks() {
  const reduce = useReducedMotion()

  return (
    <section id="how-it-works" className="section how">
      <div className="section__inner">
        <header className="section__header">
          <p className="section__eyebrow">The Lottery Universe</p>
          <h2 className="section__title">How LottoERY Works</h2>
          <p className="section__lead">
            A simple path from global discovery to clearer lottery information —
            without pretending outcomes are predictable.
          </p>
        </header>

        <ol className="how__steps">
          {howSteps.map((step, index) => (
            <motion.li
              key={step.id}
              className="how-step"
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <span className="how-step__num" aria-hidden="true">
                {step.step}
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default HowItWorks
