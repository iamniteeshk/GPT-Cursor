import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = '/opt/cursor/artifacts/screenshots'
mkdirSync(out, { recursive: true })
const base = 'http://127.0.0.1:4173'

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--enable-webgl'],
})

const consoleErrors = []
const issues = []

const viewports = [
  { name: 'd1366', width: 1366, height: 768 },
  { name: 'd1440', width: 1440, height: 900 },
  { name: 'd1920', width: 1920, height: 1080 },
  { name: 'm390', width: 390, height: 844, mobile: true },
  { name: 'm430', width: 430, height: 932, mobile: true },
  { name: 't768', width: 768, height: 1024, mobile: true },
]

async function checkPage(page, name) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`${name}: ${msg.text()}`)
  })
  page.on('pageerror', (err) => consoleErrors.push(`${name}: ${err.message}`))
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('127.0.0.1')) {
      issues.push(`${name} ${res.status()} ${res.url()}`)
    }
  })

  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  const text = await page.evaluate(() => document.body.innerText)
  for (const bad of ['LottoERY hero', 'lorem ipsum', 'TODO', 'FIXME', 'Vite', 'React App']) {
    if (text.toLowerCase().includes(bad.toLowerCase())) {
      issues.push(`${name} visible text: ${bad}`)
    }
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  if (overflow) issues.push(`${name} horizontal overflow`)

  const seo = await page.evaluate(() => {
    const g = (sel) => document.querySelector(sel)?.getAttribute('content') || document.querySelector(sel)?.getAttribute('href') || document.querySelector(sel)?.textContent
    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
      canonical: g('link[rel=canonical]'),
      desc: g('meta[name=description]'),
      ogImage: g('meta[property="og:image"]'),
      favicon: g('link[rel=icon]'),
    }
  })
  if (!seo.title.includes('LottoERY')) issues.push(`${name} title missing LottoERY`)
  if (!seo.canonical?.includes('https://lottoery.com')) issues.push(`${name} bad canonical`)
  if (!seo.ogImage?.includes('og-image.png')) issues.push(`${name} og image not png`)

  // Anchors exist
  for (const id of ['home', 'lotteries', 'apps', 'insights', 'about', 'contact', 'privacy', 'terms', 'disclaimer', 'expansion', 'apps-lucky-keralam', 'apps-mega-ball']) {
    const exists = await page.evaluate((i) => !!document.getElementById(i), id)
    if (!exists) issues.push(`${name} missing #${id}`)
  }

  const credit = await page.evaluate(() => {
    const el = document.querySelector('.footer__credit')
    return el?.textContent?.trim()
  })
  if (credit !== 'Developed by IAMNK • Powered by GNK Services') {
    issues.push(`${name} footer credit mismatch: ${credit}`)
  }

  return seo
}

// Desktop deep test
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await ctx.newPage()
  const seo = await checkPage(page, 'd1920')
  console.log('SEO', seo)

  await page.waitForSelector('.globe-root canvas, .globe-fallback__orb', { timeout: 20000 })
  await page.waitForTimeout(2000)

  for (const region of ['India', 'United States', 'Europe']) {
    await page.locator('.home-stage__region-btn', { hasText: region }).first().click()
    await page.waitForTimeout(1600)
    const panel = await page.locator('.home-stage__panel').innerText()
    console.log('region', region, panel.split('\n').slice(0, 4).join(' | '))
  }

  // Nav links
  for (const href of ['#lotteries', '#apps', '#insights', '#about']) {
    await page.locator(`.nav__links a[href="${href}"]`).click()
    await page.waitForTimeout(700)
  }

  // Footer legal
  await page.locator('footer a[href="#privacy"]').click()
  await page.waitForTimeout(500)
  await page.locator('footer a[href="#disclaimer"]').click()
  await page.waitForTimeout(400)

  await page.screenshot({ path: join(out, 'p5-d1920-final.png') })
  await page.evaluate(() => document.querySelector('#apps')?.scrollIntoView())
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(out, 'p5-d1920-apps.png') })
  await page.evaluate(() => document.querySelector('footer')?.scrollIntoView())
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(out, 'p5-d1920-footer.png') })
  await ctx.close()
}

// Mobile nav test
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await checkPage(page, 'm390')
  await page.waitForTimeout(1200)
  await page.locator('.nav__toggle').click()
  await page.waitForTimeout(400)
  const open = await page.locator('#mobile-nav.is-open').count()
  if (!open) issues.push('m390 mobile menu did not open')
  await page.screenshot({ path: join(out, 'p5-m390-menu.png') })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const closed = await page.locator('#mobile-nav.is-open').count()
  if (closed) issues.push('m390 Escape did not close menu')
  await page.locator('.nav__toggle').click()
  await page.waitForTimeout(300)
  await page.locator('.nav__mobile-link', { hasText: 'Apps' }).click()
  await page.waitForTimeout(700)
  const stillOpen = await page.locator('#mobile-nav.is-open').count()
  if (stillOpen) issues.push('m390 menu stayed open after nav')
  const bodyOverflow = await page.evaluate(() => document.body.style.overflow)
  if (bodyOverflow === 'hidden') issues.push('m390 body scroll lock stuck')
  await page.screenshot({ path: join(out, 'p5-m390-apps.png') })
  await ctx.close()
}

// Other viewports smoke
for (const vp of viewports.filter((v) => !['d1920', 'm390'].includes(v.name))) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  const page = await ctx.newPage()
  await checkPage(page, vp.name)
  await page.waitForSelector('.globe-root canvas, .globe-fallback__orb', { timeout: 20000 }).catch(() => issues.push(`${vp.name} globe missing`))
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(out, `p5-${vp.name}.png`) })
  await ctx.close()
}

// Asset checks
{
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  for (const path of ['/favicon.svg', '/og-image.png', '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/textures/earth-color.png']) {
    const res = await page.goto(base + path)
    const status = res?.status()
    console.log('asset', path, status)
    if (!status || status >= 400) issues.push(`asset ${path} status ${status}`)
  }
  await ctx.close()
}

console.log('ISSUES', issues)
console.log('CONSOLE', consoleErrors)
await browser.close()
