import { feature } from 'topojson-client'
import { geoEquirectangular, geoPath, geoGraticule10 } from 'd3-geo'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection } from 'geojson'

type LandTopology = Topology<{ land: GeometryCollection }>
type CountriesTopology = Topology<{ countries: GeometryCollection }>

let cachedColor: HTMLCanvasElement | null = null
let cachedSpec: HTMLCanvasElement | null = null
let cachedKey = ''
let cachedPromise: Promise<{
  color: HTMLCanvasElement
  specular: HTMLCanvasElement
}> | null = null

async function loadTopology(): Promise<{
  land: FeatureCollection
  countries: FeatureCollection
}> {
  const [landRes, countriesRes] = await Promise.all([
    fetch('/data/land-110m.json'),
    fetch('/data/countries-110m.json'),
  ])
  if (!landRes.ok || !countriesRes.ok) {
    throw new Error('Failed to load world atlas data')
  }

  const landTopo = (await landRes.json()) as LandTopology
  const countriesTopo = (await countriesRes.json()) as CountriesTopology

  return {
    land: feature(landTopo, landTopo.objects.land) as FeatureCollection,
    countries: feature(
      countriesTopo,
      countriesTopo.objects.countries,
    ) as FeatureCollection,
  }
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function createEarthMaps(
  width = 3072,
  height = 1536,
): Promise<{ color: HTMLCanvasElement; specular: HTMLCanvasElement }> {
  const key = `${width}x${height}`
  if (cachedColor && cachedSpec && cachedKey === key) {
    return { color: cachedColor, specular: cachedSpec }
  }
  if (cachedPromise && cachedKey === key) return cachedPromise

  cachedKey = key
  cachedPromise = (async () => {
    const color = document.createElement('canvas')
    color.width = width
    color.height = height
    const ctx = color.getContext('2d')!

    const specular = document.createElement('canvas')
    specular.width = width
    specular.height = height
    const sctx = specular.getContext('2d')!

    // Deep ocean base
    const ocean = ctx.createLinearGradient(0, 0, 0, height)
    ocean.addColorStop(0, '#071c2e')
    ocean.addColorStop(0.22, '#0a3350')
    ocean.addColorStop(0.5, '#0d4564')
    ocean.addColorStop(0.78, '#0a3350')
    ocean.addColorStop(1, '#071c2e')
    ctx.fillStyle = ocean
    ctx.fillRect(0, 0, width, height)

    // Specular/roughness map: dark = shiny ocean, light = matte land
    sctx.fillStyle = '#2a2a2a'
    sctx.fillRect(0, 0, width, height)

    const rand = mulberry32(42)
    for (let i = 0; i < 48; i++) {
      const x = rand() * width
      const y = rand() * height
      const r = 60 + rand() * 180
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(48, 130, 170, 0.11)')
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const { land, countries } = await loadTopology()
    const projection = geoEquirectangular()
      .fitSize([width, height], { type: 'Sphere' })
      .precision(0.2)
    const path = geoPath(projection, ctx)
    const spath = geoPath(projection, sctx)

    // Land base — readable teal-forest against deep ocean
    ctx.beginPath()
    path(land)
    ctx.fillStyle = '#247a5c'
    ctx.fill()

    // Interior tonal variation
    ctx.beginPath()
    path(land)
    ctx.fillStyle = 'rgba(90, 160, 120, 0.32)'
    ctx.fill()

    // Soft terrain noise
    const img = ctx.getImageData(0, 0, width, height)
    const data = img.data
    const rnd = mulberry32(99)
    for (let i = 0; i < data.length; i += 16) {
      // Sample sparse pixels for subtle grain on darker (land-ish) greens
      const g = data[i + 1]
      const b = data[i + 2]
      if (g > 70 && b < 120) {
        const n = (rnd() - 0.5) * 18
        data[i] = Math.max(0, Math.min(255, data[i] + n))
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n))
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.5))
      }
    }
    ctx.putImageData(img, 0, 0)

    // Specular: land is matte (high roughness)
    sctx.beginPath()
    spath(land)
    sctx.fillStyle = '#e8e8e8'
    sctx.fill()

    // Country borders
    ctx.beginPath()
    path(countries)
    ctx.strokeStyle = 'rgba(220, 245, 230, 0.5)'
    ctx.lineWidth = Math.max(0.9, width / 2000)
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Coastline rim
    ctx.beginPath()
    path(land)
    ctx.strokeStyle = 'rgba(170, 235, 200, 0.55)'
    ctx.lineWidth = Math.max(1.4, width / 1400)
    ctx.stroke()

    // Subtle graticule
    ctx.beginPath()
    path(geoGraticule10())
    ctx.strokeStyle = 'rgba(245, 196, 81, 0.09)'
    ctx.lineWidth = 0.7
    ctx.stroke()

    // City lights along populated latitudes
    ctx.fillStyle = 'rgba(255, 220, 150, 0.32)'
    for (let i = 0; i < 320; i++) {
      const x = rand() * width
      const y = height * 0.18 + rand() * height * 0.55
      ctx.beginPath()
      ctx.arc(x, y, rand() * 1.5, 0, Math.PI * 2)
      ctx.fill()
    }

    cachedColor = color
    cachedSpec = specular
    return { color, specular }
  })().catch((err) => {
    cachedPromise = null
    cachedKey = ''
    throw err
  })

  return cachedPromise
}

/** @deprecated use createEarthMaps */
export async function createEarthCanvas(width = 3072, height = 1536) {
  const maps = await createEarthMaps(width, height)
  return maps.color
}

export function clearEarthTextureCache() {
  cachedColor = null
  cachedSpec = null
  cachedPromise = null
  cachedKey = ''
}
