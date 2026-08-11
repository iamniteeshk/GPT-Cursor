import type { LotteryRegion } from './types'

export const lotteryRegions: LotteryRegion[] = [
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
      'Kerala Lottery results, analysis, lucky picks and intelligent insights — built for India.',
    accent: '#F5C451',
    ctaLabel: 'Explore App',
    ctaHref: '#apps',
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
      'Powerball and Mega Millions tools for results, statistics, probability insights and picks.',
    accent: '#4FC3F7',
    ctaLabel: 'Explore App',
    ctaHref: '#apps',
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
    accent: '#7CFFB2',
    ctaLabel: 'Notify Me',
    ctaHref: '#expansion',
  },
]

export const getAvailableRegions = () =>
  lotteryRegions.filter((r) => r.status === 'available')

export const getComingSoonRegions = () =>
  lotteryRegions.filter((r) => r.status === 'coming-soon')
