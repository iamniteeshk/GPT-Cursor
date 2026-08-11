import type { LotteryMarket } from './types'

/**
 * Single source of truth for regions, globe markers, explorer cards, and apps.
 * Add a new market here — UI consumes this list.
 */
export const lotteryMarkets: LotteryMarket[] = [
  {
    id: 'india-kerala',
    region: 'India',
    country: 'India',
    lottery: 'Kerala Lottery',
    product: 'Lucky Keralam',
    status: 'available',
    lat: 20.5937,
    lng: 78.9629,
    description:
      'Kerala Lottery results, number analysis, lucky picks and lottery insights — built for players who want clarity.',
    shortBlurb: 'Kerala Lottery tools for results, analysis and picks.',
    accent: '#F5C451',
    accentSecondary: '#1f7a55',
    ctaLabel: 'Explore Lucky Keralam',
    ctaHref: '#apps-lucky-keralam',
    tagline: 'Kerala • India',
    platforms: ['android', 'ios', 'web'],
    features: [
      { id: 'results', label: 'Lottery Results' },
      { id: 'analysis', label: 'Number Analysis' },
      { id: 'picks', label: 'Lucky Picks' },
      { id: 'history', label: 'Historical Insights' },
    ],
    highlightCountryIds: [356],
  },
  {
    id: 'united-states',
    region: 'United States',
    country: 'United States',
    lottery: 'Powerball + Mega Millions',
    product: 'Mega Ball',
    status: 'available',
    lat: 39.8283,
    lng: -98.5795,
    description:
      'Track Powerball and Mega Millions with tools for results, statistics, probability insights and personalized picks.',
    shortBlurb: 'Powerball and Mega Millions results, stats and picks.',
    accent: '#4FC3F7',
    accentSecondary: '#1a4f8c',
    ctaLabel: 'Explore Mega Ball',
    ctaHref: '#apps-mega-ball',
    tagline: 'United States',
    platforms: ['android', 'ios', 'web'],
    features: [
      { id: 'results', label: 'Results' },
      { id: 'analysis', label: 'Number Analysis' },
      { id: 'picks', label: 'Lucky Picks' },
      { id: 'history', label: 'Historical Data' },
      { id: 'insights', label: 'Lottery Insights' },
    ],
    highlightCountryIds: [840],
  },
  {
    id: 'europe',
    region: 'Europe',
    country: 'Europe',
    lottery: 'European Lotteries',
    product: null,
    status: 'coming-soon',
    lat: 50.1109,
    lng: 10.0,
    description:
      'More lottery experiences across Europe are joining the LottoERY universe.',
    shortBlurb: 'European lottery experiences are on the roadmap.',
    accent: '#5FD4A0',
    accentSecondary: '#2a6b5a',
    ctaLabel: 'See Roadmap',
    ctaHref: '#expansion',
    tagline: 'Europe',
    platforms: [],
    features: [],
    // Representative Western/Central European countries (ISO numeric)
    highlightCountryIds: [
      276, 250, 380, 724, 528, 56, 40, 756, 620, 616, 203, 348, 752, 208, 246,
      372, 826,
    ],
  },
]

/** Globe / explorer regions */
export const lotteryRegions = lotteryMarkets

/** Available product apps only */
export const lottoApps = lotteryMarkets.filter(
  (m) => m.status === 'available' && m.product,
)

export const getAvailableRegions = () =>
  lotteryMarkets.filter((r) => r.status === 'available')

export const getComingSoonRegions = () =>
  lotteryMarkets.filter((r) => r.status === 'coming-soon')

export const getAvailableApps = () => lottoApps

export const getMarketById = (id: string) =>
  lotteryMarkets.find((m) => m.id === id)
