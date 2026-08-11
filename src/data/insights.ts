import type { ExpansionRegion, InsightFeature } from './types'

export const insightFeatures: InsightFeature[] = [
  {
    id: 'results',
    title: 'Lottery Results',
    description:
      'Clear, timely draw results presented with context — so you always know what landed and when.',
    icon: 'results',
  },
  {
    id: 'analysis',
    title: 'Number Analysis',
    description:
      'Break down frequency, patterns, and draw history with tools built for deeper understanding.',
    icon: 'analysis',
  },
  {
    id: 'predictions',
    title: 'Predictions',
    description:
      'Probability-informed prediction views that surface trends without promising outcomes.',
    icon: 'predictions',
  },
  {
    id: 'picks',
    title: 'Lucky Picks',
    description:
      'Generate thoughtful pick combinations powered by configurable analysis preferences.',
    icon: 'picks',
  },
  {
    id: 'history',
    title: 'Historical Results',
    description:
      'Browse past draws with searchable archives that make long-term patterns easy to explore.',
    icon: 'history',
  },
  {
    id: 'stats',
    title: 'Statistics',
    description:
      'Visual statistics for hot/cold numbers, draw intervals, and distribution snapshots.',
    icon: 'stats',
  },
  {
    id: 'rankings',
    title: 'Number Rankings',
    description:
      'Rank numbers by appearance, recency, and other analytical signals you choose to follow.',
    icon: 'rankings',
  },
  {
    id: 'insights',
    title: 'Intelligent Insights',
    description:
      'Personalized tools that turn raw lottery data into actionable, human-readable insights.',
    icon: 'insights',
  },
]

export const expansionRegions: ExpansionRegion[] = [
  {
    id: 'europe',
    name: 'Europe',
    status: 'coming-soon',
    blurb: 'Multi-country lottery experiences across the European map.',
  },
  {
    id: 'uk',
    name: 'United Kingdom',
    status: 'coming-soon',
    blurb: 'UK National Lottery tools and insights on the LottoERY stack.',
  },
  {
    id: 'australia',
    name: 'Australia',
    status: 'coming-soon',
    blurb: 'Australian lottery coverage built for local draw calendars.',
  },
  {
    id: 'canada',
    name: 'Canada',
    status: 'coming-soon',
    blurb: 'Lotto Max, 6/49, and regional lottery experiences ahead.',
  },
  {
    id: 'asia',
    name: 'Asia',
    status: 'coming-soon',
    blurb: 'Expanding beyond Kerala into additional Asian lottery markets.',
  },
  {
    id: 'more',
    name: 'More Coming Soon',
    status: 'coming-soon',
    blurb: 'New regions join the LottoERY planet as the ecosystem grows.',
  },
]

export const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Lotteries', href: '#lotteries' },
  { label: 'Apps', href: '#apps' },
  { label: 'Insights', href: '#insights' },
  { label: 'About', href: '#about' },
] as const

export const brand = {
  name: 'LottoERY',
  tagline: 'ONE WORLD. MANY LOTTERIES.',
  supporting: 'The world of lotteries. One place.',
  disclaimer:
    'LottoERY provides lottery-related applications, information, analysis and tools. LottoERY does not operate or conduct lotteries. Lottery participation is subject to local laws and age restrictions. Analysis and predictions are informational and do not guarantee winnings.',
} as const
