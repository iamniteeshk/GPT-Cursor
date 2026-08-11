import { feature } from 'topojson-client'
import { geoEquirectangular, geoPath, geoGraticule10 } from 'd3-geo'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection } from 'geojson'
import * as THREE from 'three'

type LandTopology = Topology<{ land: GeometryCollection }>
type CountriesTopology = Topology<{ countries: GeometryCollection }>

const COLOR_URL = '/textures/earth-color.png?v=6'
const SPECULAR_URL = '/textures/earth-specular.png?v=6'

let cachedMaps: {
  color: THREE.Texture
  specular: THREE.Texture
} | null = null
let cachedPromise: Promise<{
  color: THREE.Texture
  specular: THREE.Texture
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

/**
 * Muted production Earth map:
 * deep blue ocean, slate-olive land, crisp borders, subtle terrain.
 * Active regions are painted separately via highlight overlay.
 */
export async function createEarthMaps(
  width = 3072,
  height = 1536,
): Promise<{ color: HTMLCanvasElement; specular: HTMLCanvasElement }> {
  const color = document.createElement('canvas')
  color.width = width
  color.height = height
  const ctx = color.getContext('2d')!

  const specular = document.createElement('canvas')
  specular.width = width
  specular.height = height
  const sctx = specular.getContext('2d')!

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

  const { land, countries } = await loadTopology()
  const projection = geoEquirectangular()
    .fitSize([width, height], { type: 'Sphere' })
    .precision(0.15)
  const path = geoPath(projection, ctx)
  const spath = geoPath(projection, sctx)

  // Muted but readable slate-sage land (holds up under tone mapping)
  ctx.beginPath()
  path(land)
  ctx.fillStyle = '#8fa67a'
  ctx.fill()

  // Soft interior variation
  ctx.beginPath()
  path(land)
  ctx.fillStyle = 'rgba(92, 110, 82, 0.35)'
  ctx.fill()

  const img = ctx.getImageData(0, 0, width, height)
  const data = img.data
  const rnd = mulberry32(99)
  for (let i = 0; i < data.length; i += 12) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // Land pixels are greener/olive than ocean
    if (g > r + 5 && g > b + 8 && g > 70) {
      const n = (rnd() - 0.5) * 20
      const warm = rnd() > 0.7 ? 8 : 0
      data[i] = Math.max(0, Math.min(255, r + n + warm))
      data[i + 1] = Math.max(0, Math.min(255, g + n))
      data[i + 2] = Math.max(0, Math.min(255, b + n * 0.4 - warm * 0.3))
    }
  }
  ctx.putImageData(img, 0, 0)

  sctx.beginPath()
  spath(land)
  sctx.fillStyle = '#d0d0d0'
  sctx.fill()

  // Country borders — readable silhouette without dominating
  ctx.beginPath()
  path(countries)
  ctx.strokeStyle = 'rgba(232, 238, 230, 0.55)'
  ctx.lineWidth = Math.max(1, width / 1800)
  ctx.lineJoin = 'round'
  ctx.stroke()

  // Coastline rim for continent recognition
  ctx.beginPath()
  path(land)
  ctx.strokeStyle = 'rgba(210, 225, 205, 0.7)'
  ctx.lineWidth = Math.max(1.4, width / 1400)
  ctx.stroke()

  // Secondary latitude/longitude grid
  ctx.beginPath()
  path(geoGraticule10())
  ctx.strokeStyle = 'rgba(245, 196, 81, 0.07)'
  ctx.lineWidth = 0.65
  ctx.stroke()

  return { color, specular }
}

function prepareTexture(
  tex: THREE.Texture,
  {
    srgb,
    anisotropy,
  }: {
    srgb?: boolean
    anisotropy: number
  },
) {
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/**
 * Prefer pre-baked local world textures for instant recognizable Earth.
 * Falls back to runtime TopoJSON canvas generation if assets fail.
 */
export async function loadEarthTextures(
  mobile = false,
): Promise<{ color: THREE.Texture; specular: THREE.Texture }> {
  if (cachedMaps) return cachedMaps
  if (cachedPromise) return cachedPromise

  cachedPromise = (async () => {
    const loader = new THREE.TextureLoader()
    const anisotropy = mobile ? 4 : 8

    try {
      const [color, specular] = await Promise.all([
        loader.loadAsync(COLOR_URL),
        loader.loadAsync(SPECULAR_URL),
      ])
      prepareTexture(color, { srgb: true, anisotropy })
      prepareTexture(specular, { anisotropy: mobile ? 2 : 4 })
      cachedMaps = { color, specular }
      return cachedMaps
    } catch {
      const { color, specular } = await createEarthMaps(
        mobile ? 2048 : 3072,
        mobile ? 1024 : 1536,
      )
      const colorMap = prepareTexture(new THREE.CanvasTexture(color), {
        srgb: true,
        anisotropy,
      })
      const specularMap = prepareTexture(new THREE.CanvasTexture(specular), {
        anisotropy: mobile ? 2 : 4,
      })
      cachedMaps = { color: colorMap, specular: specularMap }
      return cachedMaps
    }
  })().catch((err) => {
    cachedPromise = null
    throw err
  })

  return cachedPromise
}

/** @deprecated use createEarthMaps / loadEarthTextures */
export async function createEarthCanvas(width = 3072, height = 1536) {
  const maps = await createEarthMaps(width, height)
  return maps.color
}

export function clearEarthTextureCache() {
  cachedMaps = null
  cachedPromise = null
}
