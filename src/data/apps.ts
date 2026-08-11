import type { LottoApp } from './types'

export const lottoApps: LottoApp[] = [
  {
    id: 'lucky-keralam',
    name: 'Lucky Keralam',
    lottery: 'Kerala Lottery',
    region: 'India',
    status: 'live',
    description:
      'Results, number analysis, historical draws, and intelligent insights for Kerala Lottery — designed for players who want clarity, not guesswork.',
    platforms: ['android', 'ios', 'web'],
    accent: '#F5C451',
    ctaLabel: 'Explore Lucky Keralam',
    ctaHref: '#apps',
  },
  {
    id: 'mega-ball',
    name: 'Mega Ball',
    lottery: 'Powerball + Mega Millions',
    region: 'United States',
    status: 'live',
    description:
      'Track Powerball and Mega Millions with live-ready tools for results, statistics, probability insights, and personalized picks.',
    platforms: ['android', 'ios', 'web'],
    accent: '#4FC3F7',
    ctaLabel: 'Explore Mega Ball',
    ctaHref: '#apps',
  },
]

export const getLiveApps = () => lottoApps.filter((a) => a.status === 'live')
