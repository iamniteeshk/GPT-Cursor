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
import { createEarthCanvas } from '@/lib/earthTexture'

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
  const front = new THREE.Vector3(0, 0, 1)
  return new THREE.Quaternion().setFromUnitVectors(point, front)
}

function Atmosphere({ radius, mobile }: { radius: number; mobile: boolean }) {
  return (
    <mesh scale={mobile ? [1.06, 1.06, 1.06] : [1.085, 1.085, 1.085]}>
      <sphereGeometry args={[radius, mobile ? 48 : 64, mobile ? 48 : 64]} />
      <shaderMaterial
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{
          glowColor: { value: new THREE.Color('#5ec8f0') },
        }}
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
            float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
            gl_FragColor = vec4(glowColor, intensity * 0.62);
          }
        `}
      />
    </mesh>
  )
}

function RimLight({ radius }: { radius: number }) {
  return (
    <mesh>
      <sphereGeometry args={[radius * 1.012, 64, 64]} />
      <meshBasicMaterial
        color="#9ad7ff"
        transparent
        opacity={0.07}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
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
    const up = new THREE.Vector3(0, 0, 1)
    q.setFromUnitVectors(up, pos.clone().normalize())
    return q
  }, [pos])

  useFrame(({ clock }) => {
    if (!group.current) return
    const pulse =
      1 + Math.sin(clock.elapsedTime * 2.4 + region.lat) * (selected ? 0.14 : 0.07)
    group.current.scale.setScalar(selected ? pulse * 1.28 : pulse)
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
          <ringGeometry args={[0.07, 0.095, 48]} />
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
        <sphereGeometry args={[selected ? 0.048 : 0.036, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 2.6 : 1.45}
          toneMapped={false}
        />
      </mesh>
      <mesh raycast={() => null}>
        <ringGeometry args={[0.05, 0.068, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.9 : 0.4}
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
  texture,
}: {
  reducedMotion: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  controlsRef: RefObject<OrbitControlsImpl | null>
  mobile: boolean
  texture: THREE.CanvasTexture
}) {
  const group = useRef<THREE.Group>(null)
  const radius = 1.78
  const targetQ = useRef(new THREE.Quaternion())
  const selected = lotteryRegions.find((r) => r.id === selectedId)

  useEffect(() => {
    if (!selected) return
    targetQ.current = focusQuaternion(selected.lat, selected.lng)
  }, [selected])

  useFrame((_, delta) => {
    if (!group.current) return
    if (selected && !reducedMotion) {
      group.current.quaternion.slerp(targetQ.current, 1 - Math.exp(-delta * 2.4))
    } else if (selected && reducedMotion) {
      group.current.quaternion.copy(targetQ.current)
    } else if (!reducedMotion) {
      group.current.rotation.y += delta * 0.06
    }
  })

  const segs = mobile ? 48 : 64

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[radius, segs, segs]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.78}
          metalness={0.08}
          emissive="#071520"
          emissiveIntensity={0.2}
        />
      </mesh>
      <RimLight radius={radius} />
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
  texture,
}: {
  reducedMotion: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  mobile: boolean
  texture: THREE.CanvasTexture
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const { gl } = useThree()

  useEffect(() => {
    gl.domElement.style.touchAction = 'none'
  }, [gl])

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[5.5, 2.8, 4.5]} intensity={1.65} color="#fff4df" />
      <directionalLight position={[-3, -1, -2]} intensity={0.35} color="#4FC3F7" />
      <pointLight position={[2.5, 3.5, -2]} intensity={0.4} color="#F5C451" />
      {!reducedMotion && (
        <Stars
          radius={90}
          depth={50}
          count={mobile ? 700 : 1800}
          factor={mobile ? 2.2 : 3.2}
          saturation={0}
          fade
          speed={0.35}
        />
      )}
      <Earth
        reducedMotion={reducedMotion}
        selectedId={selectedId}
        onSelect={onSelect}
        controlsRef={controlsRef}
        mobile={mobile}
        texture={texture}
      />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableRotate={!mobile}
        rotateSpeed={0.4}
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
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
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
    createEarthCanvas(mobile ? 1536 : 2048, mobile ? 768 : 1024)
      .then((canvas) => {
        if (cancelled) return
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = mobile ? 4 : 8
        tex.needsUpdate = true
        setTexture(tex)
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
      {!texture ? (
        <div className="globe-fallback" aria-hidden="true">
          <div className="globe-fallback__orb globe-fallback__orb--loading">
            <div className="globe-fallback__grid" />
          </div>
        </div>
      ) : (
        <GlobeErrorBoundary fallback={fallback}>
          <Canvas
            camera={{ position: [0, 0.2, 4.55], fov: mobile ? 36 : 34 }}
            dpr={mobile ? [1, 1.35] : [1, 1.75]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: mobile ? 'low-power' : 'high-performance',
            }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0)
            }}
          >
            <Scene
              reducedMotion={reducedMotion}
              selectedId={selectedId}
              onSelect={handleSelect}
              mobile={mobile}
              texture={texture}
            />
          </Canvas>
        </GlobeErrorBoundary>
      )}
    </div>
  )
}

export default Globe
