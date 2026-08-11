import type {
  ExpansionRegion,
  HowStep,
  InsightArticle,
  InsightFeature,
} from './types'

export const insightFeatures: InsightFeature[] = [
  {
    id: 'results',
    title: 'Results',
    description:
      'Find lottery results in one place — clear draw outcomes with context.',
    icon: 'results',
    availability: 'all',
  },
  {
    id: 'analysis',
    title: 'Analysis',
    description:
      'Explore historical number patterns and statistics across supported draws.',
    icon: 'analysis',
    availability: 'all',
  },
  {
    id: 'predictions',
    title: 'Predictions',
    description:
      'Explore algorithmic insights where available — informational only, never guarantees.',
    icon: 'predictions',
    availability: 'selected',
    note: 'Availability varies by app',
  },
  {
    id: 'picks',
    title: 'Lucky Picks',
    description:
      'Generate interesting number selections where the product supports picks.',
    icon: 'picks',
    availability: 'all',
  },
  {
    id: 'history',
    title: 'History',
    description:
      'Browse previous draws and historical information for deeper context.',
    icon: 'history',
    availability: 'all',
  },
  {
    id: 'global',
    title: 'Global Access',
    description:
      'Discover lottery experiences across different regions in one ecosystem.',
    icon: 'global',
    availability: 'all',
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
    id: 'canada',
    name: 'Canada',
    status: 'coming-soon',
    blurb: 'Lotto Max, 6/49, and regional lottery experiences ahead.',
  },
  {
    id: 'australia',
    name: 'Australia',
    status: 'coming-soon',
    blurb: 'Australian lottery coverage built for local draw calendars.',
  },
  {
    id: 'asia',
    name: 'Asia',
    status: 'coming-soon',
    blurb: 'Expanding beyond Kerala into additional Asian lottery markets.',
  },
  {
    id: 'more',
    name: 'More',
    status: 'coming-soon',
    blurb: 'New regions join the LottoERY universe as the ecosystem grows.',
  },
]

export const howSteps: HowStep[] = [
  {
    id: 'choose',
    step: '01',
    title: 'Choose a Lottery',
    description:
      'Explore lotteries from different countries and regions on the LottoERY map.',
  },
  {
    id: 'explore',
    step: '02',
    title: 'Explore the Data',
    description:
      'Use results, statistics, analysis and available lottery tools for that market.',
  },
  {
    id: 'decide',
    step: '03',
    title: 'Make Better-Informed Choices',
    description:
      'Use insights and predictions as information — never as guarantees of winning.',
  },
]

export const insightArticles: InsightArticle[] = [
  {
    id: 'lottery-statistics',
    category: 'Analysis',
    title: 'How Lottery Statistics Can Help You Understand Draw History',
    excerpt:
      'Frequency, gaps, and distribution are tools for reading historical draws — useful context, not a forecast of the next result.',
    href: '#insights-preview',
  },
  {
    id: 'global-lotteries',
    category: 'Editorial',
    title: 'Inside the World of Global Lotteries',
    excerpt:
      'Formats, calendars, and player tools differ by region. A look at how lottery experiences vary around the world.',
    href: '#insights-preview',
  },
  {
    id: 'lottoery-data-tools',
    category: 'Product',
    title: 'How LottoERY Uses Data to Build Better Lottery Tools',
    excerpt:
      'Insights, analysis, and predictions in LottoERY apps are designed as informational tools — never as guarantees of winnings.',
    href: '#insights-preview',
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
  about:
    'LottoERY is a technology ecosystem focused on building lottery-related applications, tools, analysis and experiences for users across different regions.',
  disclaimer:
    'LottoERY provides lottery-related applications, information, analysis and tools. LottoERY does not operate or conduct lotteries. Predictions and analysis are informational only and do not guarantee winnings. Lottery outcomes are random. Users must follow applicable local laws and age restrictions. Feature availability may vary by region and product.',
  credit: 'Developed by IAMNK • Powered by GNK Services',
} as const
