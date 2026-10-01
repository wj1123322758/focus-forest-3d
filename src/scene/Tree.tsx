import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  MathUtils,
  MeshStandardNodeMaterial,
} from 'three/webgpu'
import type { Group, Mesh } from 'three/webgpu'
import { useFocusStore } from '../store/focusStore'
import { islandHeight } from './shared/terrain'
import { PALETTE } from './shared/sceneConfig'

// The one and only tree species: a tapered trunk with three flat-shaded foliage
// blobs. All metrics below are meters at full growth.

const TRUNK_RADIUS_TOP = 0.06
const TRUNK_RADIUS_BOTTOM = 0.16
const TRUNK_HEIGHT = 1.55

const FOLIAGE_RADII = [0.62, 0.5, 0.38]
const FOLIAGE_POSITIONS: Array<[number, number, number]> = [
  [0, 1.68, 0],
  [0.26, 2.16, -0.14],
  [-0.12, 2.66, 0.18],
]
const FOLIAGE_ROTATIONS: Array<[number, number, number]> = [
  [0.1, 0.5, 0.14],
  [-0.08, 1.8, -0.16],
  [0.14, 3.1, 0.1],
]

const SEED_RADIUS = 0.085
const SEED_LIFT = 0.09
const BUD_SCALE: [number, number, number] = [0.75, 1.6, 0.75]

// The clearing is a flat plateau, so the tree roots sit at one fixed height.
const PLATEAU_Y = islandHeight(0, 0)

// The overview camera sits ~47m out; a plain 2m sapling would be a speck, so
// the hero tree is grown larger than the real metrics above suggest.
const HERO_SCALE = 1.7

// Growth never scales to exactly zero so the sprout stays clickable/visible.
const GROWTH_FLOOR = 0.08
const GROWTH_LAMBDA = 1.8
const SEED_FADE_END = 0.14

const SWAY_AMPLITUDE = 0.035
const LEAN_ANGLE = 0.25
const DROOP_DISTANCE = 0.45
const LEAF_SHRINK = 0.16
const WILT_LAMBDA = 0.9
const BLOOM_LAMBDA = 1.5

const FRESH_COLOR = new Color(PALETTE.leafFresh)
const RIPE_COLOR = new Color(PALETTE.leafRipe)
const WILT_COLOR = new Color(PALETTE.leafWilt)

// Shared, immutable geometries: created once at module level, never per frame.
const trunkGeometry = new CylinderGeometry(
  TRUNK_RADIUS_TOP,
  TRUNK_RADIUS_BOTTOM,
  TRUNK_HEIGHT,
  9,
  1,
)
const foliageGeometries = FOLIAGE_RADII.map(
  (radius) => new IcosahedronGeometry(radius, 1),
)
const seedGeometry = new IcosahedronGeometry(SEED_RADIUS, 0)
const budGeometry = new IcosahedronGeometry(0.05, 0)

const scratchColor = new Color()

export default function Tree() {
  const status = useFocusStore((s) => s.status)
  const progress = useFocusStore((s) => s.progress)

  // Internal animation state (damped every frame, never re-created).
  const growthRef = useRef(0)
  const wiltRef = useRef(0)
  const bloomRef = useRef(0)

  const growRef = useRef<Group>(null)
  const tiltRef = useRef<Group>(null)
  const droopRef = useRef<Group>(null)
  const seedRef = useRef<Group>(null)
  const foliageRefs = useRef<Array<Mesh | null>>([])

  const trunkMaterial = useMemo(
    () =>
      new MeshStandardNodeMaterial({
        color: PALETTE.trunk,
        roughness: 0.9,
        metalness: 0,
      }),
    [],
  )
  const foliageMaterial = useMemo(
    () =>
      new MeshStandardNodeMaterial({
        color: FRESH_COLOR,
        roughness: 0.75,
        metalness: 0,
        flatShading: true,
      }),
    [],
  )
  const seedMaterial = useMemo(
    () =>
      new MeshStandardNodeMaterial({
        color: PALETTE.trunk,
        roughness: 0.85,
        metalness: 0,
        transparent: true,
        opacity: 1,
      }),
    [],
  )
  const budMaterial = useMemo(
    () =>
      new MeshStandardNodeMaterial({
        color: '#9ccf5e',
        roughness: 0.7,
        metalness: 0,
        transparent: true,
        opacity: 1,
      }),
    [],
  )

  const wiltTarget = status === 'dead' ? 1 : 0
  const bloomTarget = status === 'completed' ? 1 : 0

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const time = state.clock.elapsedTime

    // A withered tree keeps whatever size it reached; other states drive growth.
    let growthTarget = 0
    if (status === 'dead') growthTarget = growthRef.current
    else if (status === 'completed') growthTarget = 1
    else if (status === 'running' || status === 'paused') growthTarget = progress

    growthRef.current = MathUtils.damp(
      growthRef.current,
      growthTarget,
      GROWTH_LAMBDA,
      dt,
    )
    const growth = growthRef.current

    wiltRef.current = MathUtils.damp(wiltRef.current, wiltTarget, WILT_LAMBDA, dt)
    bloomRef.current = MathUtils.damp(bloomRef.current, bloomTarget, BLOOM_LAMBDA, dt)
    const wither = wiltRef.current
    const bloom = bloomRef.current

    // Leaf tone: fresh -> fuller green on completion -> brown-grey when dead.
    scratchColor.copy(FRESH_COLOR).lerp(RIPE_COLOR, bloom).lerp(WILT_COLOR, wither)
    foliageMaterial.color.copy(scratchColor)

    if (growRef.current) {
      growRef.current.scale.setScalar(GROWTH_FLOOR + (1 - GROWTH_FLOOR) * growth)
    }

    const sway =
      Math.sin(time * 1.25) * SWAY_AMPLITUDE +
      Math.sin(time * 0.63 + 1.7) * SWAY_AMPLITUDE * 0.45
    if (tiltRef.current) {
      // Sway fades out as the withered trunk locks into its lean.
      tiltRef.current.rotation.z = sway * (1 - wither) + LEAN_ANGLE * wither
      tiltRef.current.rotation.x = sway * 0.4
    }

    if (droopRef.current) droopRef.current.position.y = DROOP_DISTANCE * wither

    const leafScale = 1 - LEAF_SHRINK * wither
    for (let i = 0; i < foliageRefs.current.length; i++) {
      foliageRefs.current[i]?.scale.setScalar(leafScale)
    }

    // Seedling fades out as soon as real foliage takes over.
    const seedFade = 1 - MathUtils.smoothstep(growth, 0, SEED_FADE_END)
    seedMaterial.opacity = seedFade
    budMaterial.opacity = seedFade * 0.95
    if (seedRef.current) {
      seedRef.current.visible = seedFade > 0.01
      seedRef.current.position.y = PLATEAU_Y + 0.012 * Math.sin(time * 1.6) * seedFade
    }
  })

  return (
    // Scaled up from the original 2m sapling so the hero tree still reads at
    // the overview camera distance; the history trees stay small around it.
    <group position={[0, PLATEAU_Y, 0]} scale={HERO_SCALE}>
      <group ref={growRef}>
        <group ref={tiltRef}>
          <mesh
            castShadow
            geometry={trunkGeometry}
            material={trunkMaterial}
            position={[0, TRUNK_HEIGHT / 2, 0]}
          />
          <group ref={droopRef}>
            {FOLIAGE_RADII.map((_, index) => (
              <mesh
                key={index}
                ref={(node) => {
                  foliageRefs.current[index] = node
                }}
                castShadow
                geometry={foliageGeometries[index]}
                material={foliageMaterial}
                position={FOLIAGE_POSITIONS[index]}
                rotation={FOLIAGE_ROTATIONS[index]}
              />
            ))}
          </group>
        </group>
      </group>

      <group ref={seedRef}>
        <mesh
          castShadow
          geometry={seedGeometry}
          material={seedMaterial}
          position={[0, SEED_LIFT, 0]}
          scale={[1, 0.85, 1]}
        />
        <mesh
          castShadow
          geometry={budGeometry}
          material={budMaterial}
          position={[0, 0.2, 0]}
          scale={BUD_SCALE}
        />
      </group>
    </group>
  )
}
