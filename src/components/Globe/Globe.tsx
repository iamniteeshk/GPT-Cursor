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
import { lotteryRegions } from '@/data'
import type { LotteryRegion } from '@/data'
import { createEarthMaps } from '@/lib/earthTexture'

export function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

/** Rotate so region faces camera while keeping full-sphere silhouette readable. */
function focusQuaternion(lat: number, lng: number) {
  const point = latLngToVector3(lat, lng, 1).normalize()
  // Slightly above center so more globe mass sits in frame beneath the marker
  const target = new THREE.Vector3(0, 0.18, 1).normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(point, target)
  const polish = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0.08, 0, -0.04),
  )
  return polish.multiply(q)
}

function Atmosphere({ radius, mobile }: { radius: number; mobile: boolean }) {
  return (
    <mesh scale={mobile ? [1.055, 1.055, 1.055] : [1.07, 1.07, 1.07]}>
      <sphereGeometry args={[radius, mobile ? 48 : 64, mobile ? 48 : 64]} />
      <shaderMaterial
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{
          glowColor: { value: new THREE.Color('#6ec8ef') },
        }}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vWorldPos;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorldPos = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
        fragmentShader={`
          uniform vec3 glowColor;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.55 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
            gl_FragColor = vec4(glowColor, clamp(intensity * 0.85, 0.0, 0.75));
          }
        `}
      />
    </mesh>
  )
}

function CloudLayer({
  radius,
  mobile,
  reducedMotion,
}: {
  radius: number
  mobile: boolean
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Mesh>(null)
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = mobile ? 1024 : 1536
    c.height = mobile ? 512 : 768
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    const rand = () => Math.random()
    for (let i = 0; i < (mobile ? 90 : 160); i++) {
      const x = rand() * c.width
      const y = c.height * 0.15 + rand() * c.height * 0.7
      const r = 18 + rand() * 55
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.22)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [mobile])

  useFrame((_, delta) => {
    if (!ref.current || reducedMotion) return
    ref.current.rotation.y += delta * 0.015
  })

  return (
    <mesh ref={ref} scale={[1.018, 1.018, 1.018]}>
      <sphereGeometry args={[radius, mobile ? 32 : 48, mobile ? 32 : 48]} />
      <meshStandardMaterial
        map={texture}
        transparent
        opacity={0.28}
        depthWrite={false}
        roughness={1}
        metalness={0}
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
    () => latLngToVector3(region.lat, region.lng, radius + 0.03),
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
      Math.sin(clock.elapsedTime * 2.2 + region.lat) * (selected ? 0.12 : 0.06)
    group.current.scale.setScalar(selected ? pulse * 1.22 : pulse)
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
          if (controlsRef.current) controlsRef.current.enabled = false
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
          if (controlsRef.current) controlsRef.current.enabled = true
        }}
      >
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {selected && (
        <mesh raycast={() => null}>
          <ringGeometry args={[0.065, 0.09, 48]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh raycast={() => null}>
        <sphereGeometry args={[selected ? 0.045 : 0.034, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 2.4 : 1.35}
          toneMapped={false}
        />
      </mesh>
      <mesh raycast={() => null}>
        <ringGeometry args={[0.048, 0.064, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.85 : 0.38}
          side={THREE.DoubleSide}
          depthWrite={false}
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
  specularMap,
}: {
  reducedMotion: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  controlsRef: RefObject<OrbitControlsImpl | null>
  mobile: boolean
  colorMap: THREE.CanvasTexture
  specularMap: THREE.CanvasTexture
}) {
  const group = useRef<THREE.Group>(null)
  const radius = 1.65
  const targetQ = useRef(new THREE.Quaternion())
  const selected = lotteryRegions.find((r) => r.id === selectedId)

  useEffect(() => {
    if (!selected) return
    targetQ.current = focusQuaternion(selected.lat, selected.lng)
  }, [selected])

  useFrame((_, delta) => {
    if (!group.current) return
    if (selected && !reducedMotion) {
      group.current.quaternion.slerp(targetQ.current, 1 - Math.exp(-delta * 2.1))
    } else if (selected && reducedMotion) {
      group.current.quaternion.copy(targetQ.current)
    } else if (!reducedMotion) {
      group.current.rotation.y += delta * 0.05
    }
  })

  const segs = mobile ? 48 : 72

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[radius, segs, segs]} />
        <meshStandardMaterial
          map={colorMap}
          roughnessMap={specularMap}
          roughness={0.55}
          metalness={0.12}
          emissive="#050d16"
          emissiveIntensity={0.15}
        />
      </mesh>
      {!mobile && (
        <CloudLayer
          radius={radius}
          mobile={mobile}
          reducedMotion={!!reducedMotion}
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

function Scene({
  reducedMotion,
  selectedId,
  onSelect,
  mobile,
  colorMap,
  specularMap,
}: {
  reducedMotion: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  mobile: boolean
  colorMap: THREE.CanvasTexture
  specularMap: THREE.CanvasTexture
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const { gl } = useThree()

  useEffect(() => {
    gl.domElement.style.touchAction = 'none'
  }, [gl])

  return (
    <>
      <ambientLight intensity={0.28} />
      {/* Key light — creates spherical terminator */}
      <directionalLight
        position={[6, 2.2, 3.5]}
        intensity={2.05}
        color="#fff1d6"
      />
      {/* Fill */}
      <directionalLight
        position={[-4, -1.5, -2]}
        intensity={0.45}
        color="#4aa8d8"
      />
      {/* Rim / gold accent */}
      <pointLight position={[2.2, 3.2, -3]} intensity={0.55} color="#F5C451" />
      {!reducedMotion && (
        <Stars
          radius={100}
          depth={55}
          count={mobile ? 650 : 2000}
          factor={mobile ? 2 : 3.4}
          saturation={0}
          fade
          speed={0.3}
        />
      )}
      <Earth
        reducedMotion={reducedMotion}
        selectedId={selectedId}
        onSelect={onSelect}
        controlsRef={controlsRef}
        mobile={mobile}
        colorMap={colorMap}
        specularMap={specularMap}
      />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableRotate={!mobile}
        rotateSpeed={0.35}
        autoRotate={false}
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.7}
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
    <div className="globe-fallback" role="img" aria-label="LottoERY global lottery map">
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
            aria-label={`${region.region}: ${region.lottery}`}
          />
        ))}
      </div>
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
  const [maps, setMaps] = useState<{
    color: THREE.CanvasTexture
    specular: THREE.CanvasTexture
  } | null>(null)
  const handleSelect = onSelect ?? (() => undefined)

  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mqMobile = window.matchMedia('(max-width: 768px)')
    setReducedMotion(mqMotion.matches)
    setMobile(mqMobile.matches)

    const onMotion = () => setReducedMotion(mqMotion.matches)
    const onMobile = () => setMobile(mqMobile.matches)
    mqMotion.addEventListener('change', onMotion)
    mqMobile.addEventListener('change', onMobile)

    try {
      const canvas = document.createElement('canvas')
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) setWebglOk(false)
    } catch {
      setWebglOk(false)
    }

    let cancelled = false
    createEarthMaps(mobile ? 2048 : 3072, mobile ? 1024 : 1536)
      .then(({ color, specular }) => {
        if (cancelled) return
        const colorMap = new THREE.CanvasTexture(color)
        colorMap.colorSpace = THREE.SRGBColorSpace
        colorMap.anisotropy = mobile ? 4 : 8
        colorMap.needsUpdate = true
        const specularMap = new THREE.CanvasTexture(specular)
        specularMap.anisotropy = mobile ? 2 : 4
        specularMap.needsUpdate = true
        setMaps({ color: colorMap, specular: specularMap })
      })
      .catch(() => {
        if (!cancelled) setWebglOk(false)
      })

    return () => {
      cancelled = true
      mqMotion.removeEventListener('change', onMotion)
      mqMobile.removeEventListener('change', onMobile)
    }
  }, [mobile])

  const fallback = (
    <GlobeFallback selectedId={selectedId} onSelect={handleSelect} />
  )

  if (!webglOk) {
    return <div className={`globe-root ${className}`}>{fallback}</div>
  }

  return (
    <div className={`globe-root ${className}`}>
      {!maps ? (
        <div className="globe-fallback" aria-hidden="true">
          <div className="globe-fallback__orb globe-fallback__orb--loading">
            <div className="globe-fallback__grid" />
          </div>
        </div>
      ) : (
        <GlobeErrorBoundary fallback={fallback}>
          <Canvas
            camera={{
              position: [0, 0.25, mobile ? 5.1 : 5.45],
              fov: mobile ? 34 : 30,
            }}
            dpr={mobile ? [1, 1.35] : [1, 1.75]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: mobile ? 'low-power' : 'high-performance',
            }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0)
              gl.toneMapping = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 1.12
            }}
          >
            <Scene
              reducedMotion={reducedMotion}
              selectedId={selectedId}
              onSelect={handleSelect}
              mobile={mobile}
              colorMap={maps.color}
              specularMap={maps.specular}
            />
          </Canvas>
        </GlobeErrorBoundary>
      )}
    </div>
  )
}

export default Globe
