export type AppStatus = 'live' | 'coming-soon'

export interface LotteryRegion {
  id: string
  region: string
  country?: string
  lottery: string
  product: string | null
  status: AppStatus
  lat: number
  lng: number
  description: string
  accent: string
}

export interface LottoApp {
  id: string
  name: string
  lottery: string
  region: string
  status: AppStatus
  description: string
  platforms: ('ios' | 'android' | 'web')[]
  accent: string
  ctaLabel: string
  ctaHref: string
}

export interface InsightFeature {
  id: string
  title: string
  description: string
  icon: 'results' | 'analysis' | 'predictions' | 'picks' | 'history' | 'stats' | 'rankings' | 'insights'
}

export interface ExpansionRegion {
  id: string
  name: string
  status: 'coming-soon'
  blurb: string
}
