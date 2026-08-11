import { Navigation } from '@/components/Navigation'
import { Hero } from '@/components/Hero'
import { LotteryExplorer } from '@/components/LotteryExplorer'
import { AppCards } from '@/components/AppCards'
import { HowItWorks } from '@/components/HowItWorks'
import { Insights } from '@/components/Insights'
import { InsightsPreview } from '@/components/InsightsPreview'
import { Platform } from '@/components/Platform'
import { About } from '@/components/About'
import { Expansion } from '@/components/Expansion'
import { Footer } from '@/components/Footer'

export default function App() {
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Navigation />
      <main id="main">
        <Hero />
        <LotteryExplorer />
        <AppCards />
        <HowItWorks />
        <Insights />
        <InsightsPreview />
        <Platform />
        <About />
        <Expansion />
      </main>
      <Footer />
    </div>
  )
}
