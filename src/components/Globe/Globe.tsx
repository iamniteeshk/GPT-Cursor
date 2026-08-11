import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { lotteryRegions, getMarketById } from '@/data'
import type { LotteryRegion } from '@/data'
import { loadEarthTextures } from '@/lib/earthTexture'
import { createHighlightCanvas } from '@/lib/regionHighlight'

export function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

function focusQuaternion(lat: number, lng: number) {
  const point = latLngToVector3(lat, lng, 1).normalize()
  const target = new THREE.Vector3(0, 0.1, 1).normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(point, target)
  const polish = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0.05, 0, -0.025),
  )
  return polish.multiply(q)
}

function Atmosphere({ radius, mobile }: { radius: number; mobile: boolean }) {
  return (
    <mesh scale={mobile ? [1.045, 1.045, 1.045] : [1.055, 1.055, 1.055]}>
      <sphereGeometry args={[radius, mobile ? 48 : 64, mobile ? 48 : 64]} />
      <shaderMaterial
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{ glowColor: { value: new THREE.Color('#6ec8ef') } }}
        vertexShader={`
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 glowColor;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.58 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.6);
            gl_FragColor = vec4(glowColor, clamp(intensity * 0.72, 0.0, 0.65));
          }
        `}
      />
    </mesh>
  )
}

function HighlightLayer({
  radius,
  countryIds,
  accent,
  mobile,
}: {
  radius: number
  countryIds: number[]
  accent: string
  mobile: boolean
}) {
  const [map, setMap] = useState<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    let cancelled = false
    createHighlightCanvas(
      countryIds,
      accent,
      mobile ? 1536 : 2048,
      mobile ? 768 : 1024,
    ).then((canvas) => {
      if (cancelled) return
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      setMap(tex)
    })
    return () => {
      cancelled = true
    }
  }, [countryIds, accent, mobile])

  if (!map || !countryIds.length) return null

  return (
    <mesh scale={[1.005, 1.005, 1.005]}>
      <sphereGeometry args={[radius, mobile ? 48 : 64, mobile ? 48 : 64]} />
      <meshBasicMaterial
        map={map}
        transparent
        depthWrite={false}
        opacity={1}
        toneMapped={false}
      />
    </mesh>
  )
}

function RegionMarker({
  region,
  radius,
  selected,
  onSelect,
  controlsRef,
}: {
  region: LotteryRegion
  radius: number
  selected: boolean
  onSelect: (id: string) => void
  controlsRef: RefObject<OrbitControlsImpl | null>
}) {
  const group = useRef<THREE.Group>(null)
  const pos = useMemo(
    () => latLngToVector3(region.lat, region.lng, radius + 0.028),
    [region.lat, region.lng, radius],
  )
  const color = region.accent
  const quat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize())
    return q
  }, [pos])

  useFrame(({ clock }) => {
    if (!group.current) return
    const pulse =
      1 +
      Math.sin(clock.elapsedTime * 2.2 + region.lat) * (selected ? 0.12 : 0.04)
    group.current.scale.setScalar(selected ? pulse * 1.2 : pulse)
  })

  const select = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onSelect(region.id)
  }

  return (
    <group ref={group} position={pos} quaternion={quat}>
      <mesh
        onPointerDown={select}
        onClick={select}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
          if (controlsRef.current) controlsRef.current.enableRotate = false
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
          if (controlsRef.current) controlsRef.current.enableRotate = true
        }}
      >
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh raycast={() => null}>
          <ringGeometry args={[0.065, 0.092, 48]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh raycast={() => null}>
        <sphereGeometry args={[selected ? 0.042 : 0.03, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 2.2 : 1.15}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function Earth({
  reducedMotion,
  selectedId,
  onSelect,
  controlsRef,
  mobile,
  colorMap,
}: {
  reducedMotion: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  controlsRef: RefObject<OrbitControlsImpl | null>
  mobile: boolean
  colorMap: THREE.Texture
}) {
  const group = useRef<THREE.Group>(null)
  const radius = 1.38
  const targetQ = useRef(new THREE.Quaternion())
  const selected = selectedId ? getMarketById(selectedId) : undefined

  useEffect(() => {
    if (!selected) return
    targetQ.current = focusQuaternion(selected.lat, selected.lng)
  }, [selected])

  useFrame((_, delta) => {
    if (!group.current) return
    if (selected && !reducedMotion) {
      group.current.quaternion.slerp(targetQ.current, 1 - Math.exp(-delta * 2.0))
    } else if (selected && reducedMotion) {
      group.current.quaternion.copy(targetQ.current)
    }
  })

  const segs = mobile ? 48 : 72

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[radius, segs, segs]} />
        <meshBasicMaterial
          map={colorMap}
          toneMapped={false}
        />
      </mesh>
      {selected && (
        <HighlightLayer
          radius={radius}
          countryIds={selected.highlightCountryIds}
          accent={selected.accent}
          mobile={mobile}
        />
      )}
      <Atmosphere radius={radius} mobile={mobile} />
      {lotteryRegions.map((region) => (
        <RegionMarker
          key={region.id}
          region={region}
          radius={radius}
          selected={selectedId === region.id}
          onSelect={onSelect}
          controlsRef={controlsRef}
        />
      ))}
    </group>
  )
}

/** Responsive camera so the sphere never kisses container edges. */
function CameraFraming({
  mobile,
  shortViewport,
}: {
  mobile: boolean
  shortViewport: boolean
}) {
  const { camera, size } = useThree()

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / Math.max(size.height, 1)
    const sphereRadius = 1.38
    const atmosphere = mobile ? 1.045 : 1.055
    const visualR = sphereRadius * atmosphere

    let padding = 1.34
    let fov = 28
    let y = 0.08

    if (mobile) {
      padding = shortViewport ? 1.42 : 1.36
      fov = shortViewport ? 34 : 32
      y = 0.04
    } else if (shortViewport || size.height <= 720) {
      padding = 1.46
      fov = 26
      y = 0.05
    } else if (size.height <= 800) {
      padding = 1.4
      fov = 27
      y = 0.06
    } else if (aspect > 1.75) {
      padding = 1.32
      fov = 28
    }

    const fovRad = (fov * Math.PI) / 180
    const zFromV = (visualR * padding) / Math.tan(fovRad / 2)
    const hFov = 2 * Math.atan(Math.tan(fovRad / 2) * aspect)
    const zFromH = (visualR * padding) / Math.tan(hFov / 2)
    const z = Math.max(zFromV, zFromH, mobile ? 5.6 : 5.4)

    cam.position.set(0, y, z)
    cam.fov = fov
    cam.near = 0.1
    cam.far = 200
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
  }, [camera, size, mobile, shortViewport])

  return null
}

function Scene({
  reducedMotion,
  selectedId,
  onSelect,
  mobile,
  shortViewport,
  colorMap,
}: {
  reducedMotion: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  mobile: boolean
  shortViewport: boolean
  colorMap: THREE.Texture
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const { gl } = useThree()

  useEffect(() => {
    gl.domElement.style.touchAction = 'none'
  }, [gl])

  return (
    <>
      <CameraFraming mobile={mobile} shortViewport={shortViewport} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#b8d4e8', '#0a1622', 0.55]} />
      <directionalLight position={[5.2, 2.8, 4]} intensity={1.35} color="#fff8ea" />
      <directionalLight position={[-3.2, -0.8, -2.2]} intensity={0.35} color="#5eb0d8" />
      <pointLight position={[2, 3, -2.5]} intensity={0.28} color="#F5C451" />
      {!reducedMotion && (
        <Stars
          radius={100}
          depth={50}
          count={mobile ? 320 : 1100}
          factor={mobile ? 1.8 : 2.8}
          saturation={0}
          fade
          speed={0.22}
        />
      )}
      <Earth
        reducedMotion={reducedMotion}
        selectedId={selectedId}
        onSelect={onSelect}
        controlsRef={controlsRef}
        mobile={mobile}
        colorMap={colorMap}
      />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableRotate
        enableDamping={!reducedMotion}
        dampingFactor={0.08}
        rotateSpeed={mobile ? 0.55 : 0.4}
        autoRotate={false}
        minPolarAngle={Math.PI * 0.28}
        maxPolarAngle={Math.PI * 0.72}
      />
    </>
  )
}

function GlobeFallback({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div
      className="globe-fallback"
      role="group"
      aria-label="Simplified world map of LottoERY lottery regions"
    >
      <div className="globe-fallback__orb">
        <div className="globe-fallback__grid" />
        {lotteryRegions.map((region, i) => (
          <button
            key={region.id}
            type="button"
            className={`globe-fallback__marker ${selectedId === region.id ? 'is-active' : ''}`}
            style={
              {
                '--accent': region.accent,
                '--x': `${22 + i * 26}%`,
                '--y': `${34 + (i % 2) * 18}%`,
              } as React.CSSProperties
            }
            onClick={() => onSelect(region.id)}
            aria-label={`${region.region}: ${region.lottery}. ${region.status === 'available' ? 'Available' : 'Coming Soon'}`}
            aria-pressed={selectedId === region.id}
          />
        ))}
      </div>
      <p className="globe-fallback__hint">
        Interactive 3D globe unavailable. Use the region buttons to explore
        markets.
      </p>
    </div>
  )
}

class GlobeErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

export interface GlobeProps {
  selectedId?: string | null
  onSelect?: (id: string) => void
  className?: string
}

export function Globe({
  selectedId = null,
  onSelect,
  className = '',
}: GlobeProps) {
  const [webglOk, setWebglOk] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [shortViewport, setShortViewport] = useState(false)
  const [maps, setMaps] = useState<{
    color: THREE.Texture
  } | null>(null)
  const handleSelect = onSelect ?? (() => undefined)

  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mqMobile = window.matchMedia('(max-width: 768px)')
    const mqShort = window.matchMedia('(max-height: 800px)')
    setReducedMotion(mqMotion.matches)
    setMobile(mqMobile.matches)
    setShortViewport(mqShort.matches)

    const onMotion = () => setReducedMotion(mqMotion.matches)
    const onMobile = () => setMobile(mqMobile.matches)
    const onShort = () => setShortViewport(mqShort.matches)
    mqMotion.addEventListener('change', onMotion)
    mqMobile.addEventListener('change', onMobile)
    mqShort.addEventListener('change', onShort)

    try {
      const canvas = document.createElement('canvas')
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) setWebglOk(false)
    } catch {
      setWebglOk(false)
    }

    let cancelled = false
    loadEarthTextures(mqMobile.matches)
      .then((loaded) => {
        if (!cancelled) setMaps(loaded)
      })
      .catch(() => {
        if (!cancelled) setWebglOk(false)
      })

    return () => {
      cancelled = true
      mqMotion.removeEventListener('change', onMotion)
      mqMobile.removeEventListener('change', onMobile)
      mqShort.removeEventListener('change', onShort)
    }
  }, [])

  const selected = selectedId ? getMarketById(selectedId) : undefined
  const fallback = (
    <GlobeFallback selectedId={selectedId} onSelect={handleSelect} />
  )

  if (!webglOk) {
    return <div className={`globe-root ${className}`}>{fallback}</div>
  }

  return (
    <div
      className={`globe-root ${className}`}
      role="img"
      aria-label={
        selected
          ? `Earth globe focused on ${selected.region}. Drag to rotate. Use region buttons for keyboard access.`
          : 'Interactive Earth globe with LottoERY lottery regions. Drag to rotate.'
      }
    >
      <p className="sr-only">
        Lottery regions: India (Lucky Keralam), United States (Mega Ball), Europe
        (Coming Soon). Use the region buttons next to the globe to select a
        market.
      </p>
      {!maps ? (
        <div className="globe-fallback" aria-hidden="true">
          <div className="globe-fallback__orb globe-fallback__orb--loading">
            <div className="globe-fallback__grid" />
          </div>
        </div>
      ) : (
        <GlobeErrorBoundary fallback={fallback}>
          <Canvas
            camera={{ position: [0, 0.08, 5.8], fov: 28 }}
            dpr={mobile ? [1, 1.35] : [1, 1.65]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: mobile ? 'low-power' : 'high-performance',
            }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0)
              gl.toneMapping = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 1.15
            }}
          >
            <Scene
              reducedMotion={reducedMotion}
              selectedId={selectedId}
              onSelect={handleSelect}
              mobile={mobile}
              shortViewport={shortViewport}
              colorMap={maps.color}
            />
          </Canvas>
        </GlobeErrorBoundary>
      )}
    </div>
  )
}

export default Globe
