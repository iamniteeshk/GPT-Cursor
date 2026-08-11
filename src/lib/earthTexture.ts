import { feature } from 'topojson-client'
import { geoEquirectangular, geoPath, geoGraticule10 } from 'd3-geo'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection } from 'geojson'

type LandTopology = Topology<{ land: GeometryCollection }>
type CountriesTopology = Topology<{ countries: GeometryCollection }>

let cachedTexture: HTMLCanvasElement | null = null
let cachedKey = ''
let cachedPromise: Promise<HTMLCanvasElement> | null = null

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

  const land = feature(landTopo, landTopo.objects.land) as FeatureCollection
  const countries = feature(
    countriesTopo,
    countriesTopo.objects.countries,
  ) as FeatureCollection

  return { land, countries }
}

export async function createEarthCanvas(
  width = 2048,
  height = 1024,
): Promise<HTMLCanvasElement> {
  const key = `${width}x${height}`
  if (cachedTexture && cachedKey === key) return cachedTexture
  if (cachedPromise && cachedKey === key) return cachedPromise

  cachedKey = key
  cachedPromise = (async () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const ocean = ctx.createLinearGradient(0, 0, 0, height)
    ocean.addColorStop(0, '#0a2438')
    ocean.addColorStop(0.35, '#0d3d5c')
    ocean.addColorStop(0.5, '#114d6e')
    ocean.addColorStop(0.65, '#0d3d5c')
    ocean.addColorStop(1, '#0a2438')
    ctx.fillStyle = ocean
    ctx.fillRect(0, 0, width, height)

    // Soft depth pools
    for (let i = 0; i < 28; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const r = 50 + Math.random() * 140
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(55, 140, 180, 0.09)')
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const { land, countries } = await loadTopology()

    const projection = geoEquirectangular()
      .fitSize([width, height], { type: 'Sphere' })
      .precision(0.3)
    const path = geoPath(projection, ctx)

    // Land fill
    ctx.beginPath()
    path(land)
    ctx.fillStyle = '#1f5f4a'
    ctx.fill()

    // Soft land highlight
    ctx.beginPath()
    path(land)
    ctx.fillStyle = 'rgba(90, 170, 135, 0.22)'
    ctx.fill()

    // Country borders
    ctx.beginPath()
    path(countries)
    ctx.strokeStyle = 'rgba(210, 235, 225, 0.38)'
    ctx.lineWidth = 1
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Coastline emphasis
    ctx.beginPath()
    path(land)
    ctx.strokeStyle = 'rgba(160, 220, 190, 0.35)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    // Graticule
    ctx.beginPath()
    path(geoGraticule10())
    ctx.strokeStyle = 'rgba(245, 196, 81, 0.1)'
    ctx.lineWidth = 0.7
    ctx.stroke()

    // Specular lights
    ctx.fillStyle = 'rgba(255, 225, 150, 0.3)'
    for (let i = 0; i < 240; i++) {
      const x = Math.random() * width
      const y = height * 0.2 + Math.random() * height * 0.52
      ctx.beginPath()
      ctx.arc(x, y, Math.random() * 1.35, 0, Math.PI * 2)
      ctx.fill()
    }

    cachedTexture = canvas
    return canvas
  })().catch((err) => {
    cachedPromise = null
    cachedKey = ''
    throw err
  })

  return cachedPromise
}

export function clearEarthTextureCache() {
  cachedTexture = null
  cachedPromise = null
  cachedKey = ''
}
