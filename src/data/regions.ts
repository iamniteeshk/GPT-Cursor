import type { LotteryRegion } from './types'

export const lotteryRegions: LotteryRegion[] = [
  {
    id: 'india-kerala',
    region: 'India',
    country: 'India',
    lottery: 'Kerala Lottery',
    product: 'Lucky Keralam',
    status: 'live',
    lat: 10.8505,
    lng: 76.2711,
    description:
      'Official Kerala Lottery insights, results, and intelligent tools through Lucky Keralam.',
    accent: '#F5C451',
  },
  {
    id: 'united-states',
    region: 'United States',
    country: 'United States',
    lottery: 'Powerball & Mega Millions',
    product: 'Mega Ball',
    status: 'live',
    lat: 39.8283,
    lng: -98.5795,
    description:
      'US Powerball and Mega Millions analysis, results, and prediction tools via Mega Ball.',
    accent: '#4FC3F7',
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
    description: 'European lottery experiences are on the LottoERY roadmap.',
    accent: '#7CFFB2',
  },
]

export const getLiveRegions = () =>
  lotteryRegions.filter((r) => r.status === 'live')

export const getComingSoonRegions = () =>
  lotteryRegions.filter((r) => r.status === 'coming-soon')
