import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { lotteryRegions } from '@/data'
import type { LotteryRegion } from '@/data'

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

function createEarthTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, '#0a1a2e')
  gradient.addColorStop(0.35, '#0d3a5c')
  gradient.addColorStop(0.5, '#0e4d6e')
  gradient.addColorStop(0.65, '#0d3a5c')
  gradient.addColorStop(1, '#0a1a2e')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#1a5c45'
  const continents = [
    [
      [280, 220],
      [340, 180],
      [380, 240],
      [360, 360],
      [320, 480],
      [300, 560],
      [340, 680],
      [300, 780],
      [260, 720],
      [240, 560],
      [220, 400],
      [240, 280],
    ],
    [
      [980, 220],
      [1080, 200],
      [1140, 260],
      [1120, 340],
      [1080, 420],
      [1100, 560],
      [1060, 700],
      [1020, 760],
      [980, 680],
      [960, 520],
      [940, 400],
      [960, 280],
    ],
    [
      [1180, 180],
      [1400, 160],
      [1580, 220],
      [1680, 300],
      [1620, 400],
      [1500, 460],
      [1380, 420],
      [1280, 360],
      [1200, 280],
    ],
    [
      [1560, 680],
      [1680, 660],
      [1740, 720],
      [1680, 780],
      [1580, 760],
    ],
    [
      [1320, 420],
      [1360, 440],
      [1380, 520],
      [1340, 560],
      [1300, 500],
    ],
  ]

  for (const poly of continents) {
    ctx.beginPath()
    poly.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(245, 196, 81, 0.12)'
  ctx.lineWidth = 1
  for (let i = 0; i < 12; i++) {
    const y = (i / 12) * canvas.height
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }
  for (let i = 0; i < 24; i++) {
    const x = (i / 24) * canvas.width
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(245, 196, 81, 0.35)'
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * canvas.width
    const y = 180 + Math.random() * 640
    const r = Math.random() * 1.8
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function Atmosphere({ radius }: { radius: number }) {
  return (
    <mesh scale={[1.08, 1.08, 1.08]}>
      <sphereGeometry args={[radius, 64, 64]} />
      <shaderMaterial
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{
          glowColor: { value: new THREE.Color('#4FC3F7') },
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
            float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
            gl_FragColor = vec4(glowColor, intensity * 0.55);
          }
        `}
      />
    </mesh>
  )
}

function RegionMarker({
  region,
  radius,
  selected,
  onSelect,
}: {
  region: LotteryRegion
  radius: number
  selected: boolean
  onSelect: (id: string) => void
}) {
  const group = useRef<THREE.Group>(null)
  const pos = useMemo(
    () => latLngToVector3(region.lat, region.lng, radius + 0.02),
    [region.lat, region.lng, radius],
  )
  const color = region.accent

  useFrame(({ clock }) => {
    if (!group.current) return
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2 + region.lat) * 0.12
    group.current.scale.setScalar(selected ? pulse * 1.25 : pulse)
  })

  return (
    <group ref={group} position={pos}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onSelect(region.id)
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[0.038, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 2.2 : 1.4}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.055, 0.078, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.9 : 0.45}
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
}: {
  reducedMotion: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const group = useRef<THREE.Group>(null)
  const radius = 1.6
  const texture = useMemo(() => createEarthTexture(), [])

  useFrame((_, delta) => {
    if (!group.current || reducedMotion) return
    group.current.rotation.y += delta * 0.08
  })

  return (
    <group ref={group} rotation={[0.2, -0.8, 0]}>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.72}
          metalness={0.18}
          emissive="#041018"
          emissiveIntensity={0.35}
        />
      </mesh>
      <Atmosphere radius={radius} />
      {lotteryRegions.map((region) => (
        <RegionMarker
          key={region.id}
          region={region}
          radius={radius}
          selected={selectedId === region.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  )
}

function Scene({
  reducedMotion,
  selectedId,
  onSelect,
}: {
  reducedMotion: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 3, 5]} intensity={1.35} color="#fff6e0" />
      <pointLight position={[-4, -2, -3]} intensity={0.6} color="#4FC3F7" />
      <pointLight position={[2, 4, -2]} intensity={0.35} color="#F5C451" />
      {!reducedMotion && (
        <Stars
          radius={80}
          depth={40}
          count={1600}
          factor={3}
          saturation={0}
          fade
          speed={0.4}
        />
      )}
      <Earth
        reducedMotion={reducedMotion}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        rotateSpeed={0.45}
        autoRotate={false}
        minPolarAngle={Math.PI * 0.25}
        maxPolarAngle={Math.PI * 0.75}
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
  const handleSelect = onSelect ?? (() => undefined)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', handler)

    try {
      const canvas = document.createElement('canvas')
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) setWebglOk(false)
    } catch {
      setWebglOk(false)
    }

    return () => mq.removeEventListener('change', handler)
  }, [])

  const fallback = (
    <GlobeFallback selectedId={selectedId} onSelect={handleSelect} />
  )

  if (!webglOk) {
    return <div className={`globe-root ${className}`}>{fallback}</div>
  }

  return (
    <div className={`globe-root ${className}`}>
      <GlobeErrorBoundary fallback={fallback}>
        <Canvas
          camera={{ position: [0, 0.4, 4.6], fov: 42 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0)
          }}
        >
          <Scene
            reducedMotion={reducedMotion}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </Canvas>
      </GlobeErrorBoundary>
    </div>
  )
}

export default Globe
