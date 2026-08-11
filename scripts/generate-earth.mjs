/**
 * Regenerates local Earth textures via headless Chromium + TopoJSON.
 * Dark muted land, deep ocean, subtle borders — recognizable continents.
 * Run: node scripts/generate-earth.mjs
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
const outDir = join(publicDir, 'textures')
mkdirSync(outDir, { recursive: true })

const mime = {
  '.json': 'application/json',
  '.png': 'image/png',
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const filePath = join(publicDir, decodeURIComponent(url.pathname))
  try {
    const data = readFileSync(filePath)
    res.writeHead(200, {
      'Content-Type': mime[extname(filePath)] || 'application/octet-stream',
    })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('missing')
  }
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const page = await browser.newPage()
await page.goto(`http://127.0.0.1:${port}/data/land-110m.json`, {
  waitUntil: 'domcontentloaded',
})

const result = await page.evaluate(async () => {
  const [{ geoEquirectangular, geoPath, geoGraticule10 }, topo] =
    await Promise.all([
      import('https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm'),
      import('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm'),
    ])

  const [landTopo, countriesTopo] = await Promise.all([
    fetch('/data/land-110m.json').then((r) => r.json()),
    fetch('/data/countries-110m.json').then((r) => r.json()),
  ])

  const land = topo.feature(landTopo, landTopo.objects.land)
  const countries = topo.feature(countriesTopo, countriesTopo.objects.countries)

  const width = 2048
  const height = 1024

  function mulberry32(seed) {
    return () => {
      let t = (seed += 0x6d2b79f5)
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const color = document.createElement('canvas')
  color.width = width
  color.height = height
  const ctx = color.getContext('2d')

  // Deep navy ocean with equatorial lift
  const ocean = ctx.createLinearGradient(0, 0, 0, height)
  ocean.addColorStop(0, '#061525')
  ocean.addColorStop(0.22, '#0a2e48')
  ocean.addColorStop(0.5, '#0e4060')
  ocean.addColorStop(0.78, '#0a2e48')
  ocean.addColorStop(1, '#061525')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, width, height)

  // Soft ocean depth patches
  const rand = mulberry32(42)
  for (let i = 0; i < 40; i++) {
    const x = rand() * width
    const y = rand() * height
    const r = 50 + rand() * 170
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(45, 120, 160, 0.1)')
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const projection = geoEquirectangular()
    .fitSize([width, height], { type: 'Sphere' })
    .precision(0.1)
  const path = geoPath(projection, ctx)

  // Dark muted land — not bright UI green
  ctx.beginPath()
  path(land)
  ctx.fillStyle = '#4d5c4a'
  ctx.fill()

  // Soft terrain variation (latitude bands + grain)
  const img = ctx.getImageData(0, 0, width, height)
  const data = img.data
  const rnd = mulberry32(77)
  for (let y = 0; y < height; y++) {
    const latBand = Math.sin((y / height) * Math.PI)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      // Land: greenish olive against blue ocean
      if (g > r + 4 && g > b + 6 && g > 55) {
        const n = (rnd() - 0.5) * 16
        const warm = rnd() > 0.78 ? 7 : 0
        const arid = latBand < 0.35 || latBand > 0.78 ? -6 : latBand * 8
        data[i] = Math.max(0, Math.min(255, r + n + warm + arid * 0.35))
        data[i + 1] = Math.max(0, Math.min(255, g + n + arid * 0.15))
        data[i + 2] = Math.max(0, Math.min(255, b + n * 0.35 - warm * 0.4))
      }
    }
  }
  ctx.putImageData(img, 0, 0)

  // Subtle country borders
  ctx.beginPath()
  path(countries)
  ctx.strokeStyle = 'rgba(170, 190, 175, 0.38)'
  ctx.lineWidth = Math.max(0.9, width / 2000)
  ctx.lineJoin = 'round'
  ctx.stroke()

  // Coastline silhouette — key for continent recognition
  ctx.beginPath()
  path(land)
  ctx.strokeStyle = 'rgba(190, 210, 195, 0.55)'
  ctx.lineWidth = Math.max(1.35, width / 1500)
  ctx.stroke()

  // Secondary lat/lng grid
  ctx.beginPath()
  path(geoGraticule10())
  ctx.strokeStyle = 'rgba(245, 196, 81, 0.06)'
  ctx.lineWidth = 0.6
  ctx.stroke()

  return { color: color.toDataURL('image/png') }
})

writeFileSync(
  join(outDir, 'earth-color.png'),
  Buffer.from(result.color.split(',')[1], 'base64'),
)

await browser.close()
server.close()
console.log('Wrote public/textures/earth-color.png')
