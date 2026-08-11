/**
 * Regenerates local Earth textures via headless Chromium + TopoJSON.
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
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/local/bin/google-chrome',
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
  ocean.addColorStop(0, '#07182a')
  ocean.addColorStop(0.22, '#0c3350')
  ocean.addColorStop(0.5, '#11486a')
  ocean.addColorStop(0.78, '#0c3350')
  ocean.addColorStop(1, '#07182a')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, width, height)

  sctx.fillStyle = '#222222'
  sctx.fillRect(0, 0, width, height)

  const projection = geoEquirectangular()
    .fitSize([width, height], { type: 'Sphere' })
    .precision(0.1)
  const path = geoPath(projection, ctx)
  const spath = geoPath(projection, sctx)

  ctx.beginPath()
  path(land)
  ctx.fillStyle = '#8fa67a'
  ctx.fill()

  const img = ctx.getImageData(0, 0, width, height)
  const data = img.data
  const rnd = mulberry32(77)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (g > r + 4 && g > b + 5 && g > 90) {
        const latBand = Math.sin((y / height) * Math.PI)
        const n = (rnd() - 0.5) * 14
        const shade = latBand * 10
        data[i] = Math.max(0, Math.min(255, r + n + shade * 0.4))
        data[i + 1] = Math.max(0, Math.min(255, g + n + shade * 0.2))
        data[i + 2] = Math.max(0, Math.min(255, b + n * 0.3 - shade * 0.15))
      }
    }
  }
  ctx.putImageData(img, 0, 0)

  sctx.beginPath()
  spath(land)
  sctx.fillStyle = '#d2d2d2'
  sctx.fill()

  ctx.beginPath()
  path(countries)
  ctx.strokeStyle = 'rgba(248, 252, 245, 0.72)'
  ctx.lineWidth = Math.max(1.25, width / 1500)
  ctx.lineJoin = 'round'
  ctx.stroke()

  ctx.beginPath()
  path(land)
  ctx.strokeStyle = 'rgba(236, 245, 230, 0.85)'
  ctx.lineWidth = Math.max(1.7, width / 1200)
  ctx.stroke()

  ctx.beginPath()
  path(geoGraticule10())
  ctx.strokeStyle = 'rgba(245, 196, 81, 0.08)'
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
