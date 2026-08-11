/**
 * Regenerates local Earth textures via headless Chromium + TopoJSON.
 * Run: node scripts/generate-earth.mjs
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { extname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
const outDir = join(publicDir, 'textures')
mkdirSync(outDir, { recursive: true })

const mime = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  let path = url.pathname
  if (path === '/') path = '/index.html'
  const filePath = join(publicDir, decodeURIComponent(path))
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
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
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

  const specular = document.createElement('canvas')
  specular.width = width
  specular.height = height
  const sctx = specular.getContext('2d')

  const ocean = ctx.createLinearGradient(0, 0, 0, height)
  ocean.addColorStop(0, '#041018')
  ocean.addColorStop(0.2, '#0a2438')
  ocean.addColorStop(0.5, '#0d3550')
  ocean.addColorStop(0.8, '#0a2438')
  ocean.addColorStop(1, '#041018')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, width, height)

  sctx.fillStyle = '#1f1f1f'
  sctx.fillRect(0, 0, width, height)

  const rand = mulberry32(42)
  for (let i = 0; i < 36; i++) {
    const x = rand() * width
    const y = rand() * height
    const r = 50 + rand() * 160
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(40, 110, 150, 0.1)')
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const projection = geoEquirectangular()
    .fitSize([width, height], { type: 'Sphere' })
    .precision(0.15)
  const path = geoPath(projection, ctx)
  const spath = geoPath(projection, sctx)

  ctx.beginPath()
  path(land)
  ctx.fillStyle = '#3f4d42'
  ctx.fill()

  ctx.beginPath()
  path(land)
  ctx.fillStyle = 'rgba(72, 88, 74, 0.45)'
  ctx.fill()

  const img = ctx.getImageData(0, 0, width, height)
  const data = img.data
  const rnd = mulberry32(99)
  for (let i = 0; i < data.length; i += 12) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (g > r + 8 && g > b + 10 && g > 55) {
      const n = (rnd() - 0.5) * 22
      const warm = rnd() > 0.72 ? 6 : 0
      data[i] = Math.max(0, Math.min(255, r + n + warm))
      data[i + 1] = Math.max(0, Math.min(255, g + n))
      data[i + 2] = Math.max(0, Math.min(255, b + n * 0.45 - warm * 0.4))
    }
  }
  ctx.putImageData(img, 0, 0)

  sctx.beginPath()
  spath(land)
  sctx.fillStyle = '#d8d8d8'
  sctx.fill()

  ctx.beginPath()
  path(countries)
  ctx.strokeStyle = 'rgba(210, 222, 214, 0.42)'
  ctx.lineWidth = Math.max(0.85, width / 2200)
  ctx.lineJoin = 'round'
  ctx.stroke()

  ctx.beginPath()
  path(land)
  ctx.strokeStyle = 'rgba(168, 190, 176, 0.55)'
  ctx.lineWidth = Math.max(1.2, width / 1600)
  ctx.stroke()

  ctx.beginPath()
  path(geoGraticule10())
  ctx.strokeStyle = 'rgba(245, 196, 81, 0.07)'
  ctx.lineWidth = 0.65
  ctx.stroke()

  return {
    color: color.toDataURL('image/png'),
    specular: specular.toDataURL('image/png'),
  }
})

function writeDataUrl(dataUrl, filePath) {
  const b64 = dataUrl.split(',')[1]
  writeFileSync(filePath, Buffer.from(b64, 'base64'))
}

writeDataUrl(result.color, join(outDir, 'earth-color.png'))
writeDataUrl(result.specular, join(outDir, 'earth-specular.png'))

await browser.close()
server.close()
console.log('Wrote textures to public/textures/')
