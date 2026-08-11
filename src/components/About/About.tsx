import { motion, useReducedMotion } from 'framer-motion'
import { brand } from '@/data'

export function About() {
  const reduce = useReducedMotion()

  return (
    <section id="about" className="section about" tabIndex={-1}>
      <div className="section__inner about__inner">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.45 }}
        >
          <p className="section__eyebrow">About LottoERY</p>
          <h2 className="section__title">Built for a World of Lotteries</h2>
          <p className="about__lead">{brand.about}</p>
          <p className="about__note">
            LottoERY provides lottery-related applications, information,
            analysis and tools. LottoERY does not operate or conduct lotteries.
          </p>
        </motion.div>

        <motion.div
          className="about__pillars"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <div>
            <h3>Technology first</h3>
            <p>Apps, analysis and tools — not ticket sales or lottery ops.</p>
          </div>
          <div>
            <h3>Region aware</h3>
            <p>Each market keeps its lottery identity inside one ecosystem.</p>
          </div>
          <div>
            <h3>Responsible by design</h3>
            <p>
              Insights inform curiosity. They never guarantee lottery outcomes.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default About
