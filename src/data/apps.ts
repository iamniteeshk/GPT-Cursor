import type { LottoApp } from './types'

export const lottoApps: LottoApp[] = [
  {
    id: 'lucky-keralam',
    name: 'Lucky Keralam',
    lottery: 'Kerala Lottery',
    region: 'India',
    status: 'available',
    tagline: 'Kerala • India',
    description:
      'Lottery results, number analysis, lucky picks and lottery insights for Kerala Lottery — clarity without the guesswork.',
    platforms: ['android', 'ios', 'web'],
    accent: '#F5C451',
    accentSecondary: '#2d8f68',
    ctaLabel: 'Explore Lucky Keralam',
    ctaHref: '#apps',
  },
  {
    id: 'mega-ball',
    name: 'Mega Ball',
    lottery: 'Powerball + Mega Millions',
    region: 'United States',
    status: 'available',
    tagline: 'United States',
    description:
      'Track Powerball and Mega Millions with tools for results, statistics, probability insights and personalized picks.',
    platforms: ['android', 'ios', 'web'],
    accent: '#4FC3F7',
    accentSecondary: '#1a4f8c',
    ctaLabel: 'Explore Mega Ball',
    ctaHref: '#apps',
  },
]

export const getAvailableApps = () =>
  lottoApps.filter((a) => a.status === 'available')
