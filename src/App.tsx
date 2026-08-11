import { Navigation } from '@/components/Navigation'
import { Hero } from '@/components/Hero'
import { LotteryExplorer } from '@/components/LotteryExplorer'
import { AppCards } from '@/components/AppCards'
import { Insights } from '@/components/Insights'
import { Platform } from '@/components/Platform'
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
        <Insights />
        <Platform />
        <Expansion />
      </main>
      <Footer />
    </div>
  )
}
