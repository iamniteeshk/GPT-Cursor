export type AppStatus = 'available' | 'coming-soon'

export interface MarketFeature {
  id: string
  label: string
}

export interface LotteryMarket {
  id: string
  region: string
  country: string
  lottery: string
  product: string | null
  status: AppStatus
  lat: number
  lng: number
  description: string
  accent: string
  accentSecondary: string
  ctaLabel: string
  /** In-page destination, e.g. #apps-lucky-keralam */
  ctaHref: string
  tagline: string
  platforms: ('ios' | 'android' | 'web')[]
  features: MarketFeature[]
  /** ISO 3166-1 numeric country ids for globe highlight (world-atlas) */
  highlightCountryIds: number[]
  shortBlurb: string
}

/** @deprecated alias — use LotteryMarket */
export type LotteryRegion = LotteryMarket
/** @deprecated alias — use LotteryMarket for app products */
export type LottoApp = LotteryMarket

export interface InsightFeature {
  id: string
  title: string
  description: string
  icon: 'results' | 'analysis' | 'predictions' | 'picks' | 'history' | 'global'
  availability: 'all' | 'selected'
  note?: string
}

export interface ExpansionRegion {
  id: string
  name: string
  status: 'coming-soon'
  blurb: string
}

export interface InsightArticle {
  id: string
  category: 'Analysis' | 'Statistics' | 'Guides' | 'Global' | 'Updates' | 'Editorial' | 'Product'
  title: string
  excerpt: string
  href: string
}

export interface HowStep {
  id: string
  step: string
  title: string
  description: string
}

export function statusLabel(status: AppStatus): 'Available' | 'Coming Soon' {
  return status === 'available' ? 'Available' : 'Coming Soon'
}
