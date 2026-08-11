import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = '/opt/cursor/artifacts/screenshots'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--enable-webgl'],
})

const viewports = [
  { name: 'd1366x768', width: 1366, height: 768 },
  { name: 'd1440x720', width: 1440, height: 720 },
  { name: 'd1440x900', width: 1440, height: 900 },
  { name: 'd1920x1080', width: 1920, height: 1080 },
  { name: 'm390x844', width: 390, height: 844, isMobile: true },
  { name: 'm430x932', width: 430, height: 932, isMobile: true },
]

const consoleErrors = []

async function waitForGlobe(page) {
  await page.waitForSelector('.globe-root canvas, .globe-fallback__orb', {
    timeout: 20000,
  })
  await page.waitForTimeout(1800)
}

async function shoot(page, file) {
  await page.screenshot({
    path: join(out, file),
    fullPage: false,
  })
}

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`${vp.name}: ${msg.text()}`)
  })
  page.on('pageerror', (err) => consoleErrors.push(`${vp.name}: ${err.message}`))

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await waitForGlobe(page)

  // Search for forbidden visible text
  const bodyText = await page.evaluate(() => document.body.innerText)
  const bad = ['LottoERY hero', 'lorem ipsum', 'TODO', 'placeholder', 'debug']
  for (const b of bad) {
    if (bodyText.toLowerCase().includes(b.toLowerCase())) {
      console.log(`FOUND BAD TEXT in ${vp.name}: ${b}`)
    }
  }

  // Horizontal overflow check
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  })
  console.log(`${vp.name} overflow=${overflow}`)

  await shoot(page, `p4-${vp.name}-usa.png`)

  // Click India
  const india = page.locator('.home-stage__region-btn', { hasText: 'India' }).first()
  if (await india.count()) {
    await india.click()
    await page.waitForTimeout(1600)
    await shoot(page, `p4-${vp.name}-india.png`)
  }

  // Europe
  const europe = page.locator('.home-stage__region-btn', { hasText: 'Europe' }).first()
  if (await europe.count()) {
    await europe.click()
    await page.waitForTimeout(1600)
    await shoot(page, `p4-${vp.name}-europe.png`)
  }

  // Apps section
  await page.evaluate(() => document.querySelector('#apps')?.scrollIntoView())
  await page.waitForTimeout(600)
  await shoot(page, `p4-${vp.name}-apps.png`)

  // Insights
  await page.evaluate(() =>
    document.querySelector('#insights-preview')?.scrollIntoView(),
  )
  await page.waitForTimeout(500)
  await shoot(page, `p4-${vp.name}-insights.png`)

  // Footer
  await page.evaluate(() => document.querySelector('footer')?.scrollIntoView())
  await page.waitForTimeout(400)
  await shoot(page, `p4-${vp.name}-footer.png`)

  // Globe padding metrics on home
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  const metrics = await page.evaluate(() => {
    const stage = document.querySelector('.home-stage__globe-stage')
    const canvas = document.querySelector('.globe-root canvas')
    if (!stage || !canvas) return null
    const s = stage.getBoundingClientRect()
    const c = canvas.getBoundingClientRect()
    return {
      stageH: Math.round(s.height),
      canvasH: Math.round(c.height),
      topPad: Math.round(c.top - s.top),
      bottomPad: Math.round(s.bottom - c.bottom),
    }
  })
  console.log(`${vp.name} globeMetrics`, JSON.stringify(metrics))

  await context.close()
}

console.log('consoleErrors', consoleErrors)
await browser.close()
