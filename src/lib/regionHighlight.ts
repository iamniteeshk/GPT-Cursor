import { feature } from 'topojson-client'
import { geoEquirectangular, geoPath } from 'd3-geo'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection, Feature, Geometry } from 'geojson'

type CountriesTopology = Topology<{ countries: GeometryCollection }>

let countriesCache: FeatureCollection | null = null

async function loadCountries(): Promise<FeatureCollection> {
  if (countriesCache) return countriesCache
  const res = await fetch('/data/countries-110m.json')
  if (!res.ok) throw new Error('Failed to load countries')
  const topo = (await res.json()) as CountriesTopology
  countriesCache = feature(
    topo,
    topo.objects.countries,
  ) as FeatureCollection
  return countriesCache
}

function countryId(f: Feature): number | null {
  if (f.id == null) return null
  const n = typeof f.id === 'number' ? f.id : Number(f.id)
  return Number.isFinite(n) ? n : null
}

/**
 * Equirectangular highlight for active lottery region only.
 * Transparent elsewhere — world map stays muted; selection pops in accent.
 */
export async function createHighlightCanvas(
  countryIds: number[],
  accent = '#F5C451',
  width = 2048,
  height = 1024,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, width, height)

  if (!countryIds.length) return canvas

  const countries = await loadCountries()
  const idSet = new Set(countryIds)
  const matched = countries.features.filter((f) => {
    const id = countryId(f)
    return id != null && idSet.has(id)
  })

  if (!matched.length) return canvas

  const projection = geoEquirectangular()
    .fitSize([width, height], { type: 'Sphere' })
    .precision(0.25)
  const path = geoPath(projection, ctx)

  const fc: FeatureCollection = {
    type: 'FeatureCollection',
    features: matched as Feature<Geometry>[],
  }

  // Soft accent wash — keep underlying continents readable
  ctx.beginPath()
  path(fc)
  ctx.fillStyle = accent
  ctx.globalAlpha = countryIds.length > 5 ? 0.18 : 0.26
  ctx.fill()
  ctx.globalAlpha = 1

  // Inner glow rim
  ctx.beginPath()
  path(fc)
  ctx.strokeStyle = accent
  ctx.lineWidth = Math.max(2.4, width / 650)
  ctx.globalAlpha = countryIds.length > 5 ? 0.55 : 0.72
  ctx.stroke()

  // Crisp outer border
  ctx.beginPath()
  path(fc)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(1.2, width / 1200)
  ctx.globalAlpha = 0.6
  ctx.stroke()
  ctx.globalAlpha = 1

  return canvas
}
