import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { PALETTE } from '../shared/sceneConfig'
import { hash01, islandHeight, islandSlope } from '../shared/terrain'

// Shoreline reeds/rushes: one instanced draw call of slim 4-sided cones along
// the wet side of the island. Placement is hash-derived (never Math.random)
// so a page refresh never reshuffles the shoreline, and shadows stay off
// because a few hundred tiny instances are not worth a shadow pass.

const PLANT_COUNT = 160

const RING_INNER = 8
const RING_OUTER = 22.5
const SLOPE_LIMIT = 0.45
const PLACEMENT_ATTEMPTS = 8

// A strand is pinned just above the waterline every few instances so the
// beach reads as a wetland fringe instead of a mown lawn.
const WETLAND_STRIDE = 7
const WETLAND_INNER = 22
const WETLAND_OUTER = 23

const SCALE_MIN = 0.6
const SCALE_MAX = 1.4
const TILT_LIMIT = 0.18
const GROUND_SINK = 0.01

// Instance colors multiply the base material color. 1 keeps PALETTE.grass;
// the low end is grassDark's luminance ratio, so the band fades green ->
// dark green. MeshStandardNodeMaterial picks up InstancedMesh.instanceColor
// automatically, which is why no TSL color graph is needed here.
const TINT_MIN = 0.62
const TINT_MAX = 1

const SALT = 101

const REED_GEOMETRY = new THREE.ConeGeometry(0.035, 0.5, 4)
// Shifted to stand on y=0 so instance placement is a plain terrain height.
REED_GEOMETRY.translate(0, 0.25, 0)

const REED_MATERIAL = new THREE.MeshStandardNodeMaterial({
  color: PALETTE.grass,
  roughness: 0.85,
  metalness: 0,
})

const GRASS_COLOR = new THREE.Color(PALETTE.grass)
const dummy = new THREE.Object3D()
const tintColor = new THREE.Color()

interface Reed {
  x: number
  y: number
  z: number
  rotationY: number
  tilt: number
  scale: number
  tint: number
}

function buildReeds(): Reed[] {
  const reeds: Reed[] = []

  for (let i = 0; i < PLANT_COUNT; i++) {
    const wetland = i % WETLAND_STRIDE === 1
    const inner = wetland ? WETLAND_INNER : RING_INNER
    const outer = wetland ? WETLAND_OUTER : RING_OUTER

    // Steep hillsides stay bare; a rejected candidate is retried with a new
    // salt rather than dropped, so the strand keeps its density.
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const salt = SALT + attempt * 13
      const radius = inner + hash01(i, salt) * (outer - inner)
      const angle = hash01(i, salt + 1) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (islandSlope(x, z) > SLOPE_LIMIT) continue

      reeds.push({
        x,
        y: islandHeight(x, z) - GROUND_SINK,
        z,
        rotationY: hash01(i, salt + 2) * Math.PI * 2,
        tilt: (hash01(i, salt + 3) - 0.5) * 2 * TILT_LIMIT,
        scale: SCALE_MIN + hash01(i, salt + 4) * (SCALE_MAX - SCALE_MIN),
        tint: TINT_MIN + hash01(i, salt + 5) * (TINT_MAX - TINT_MIN),
      })
      break
    }
  }

  return reeds
}

export default function ShorePlants() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const reeds = useMemo(buildReeds, [])

  // Instanced data lives on the mesh object, which only exists after mount;
  // a layout effect fills it before the first paint of the frame.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    for (let i = 0; i < reeds.length; i++) {
      const reed = reeds[i]
      dummy.position.set(reed.x, reed.y, reed.z)
      dummy.rotation.set(reed.tilt, reed.rotationY, reed.tilt * 0.6)
      dummy.scale.setScalar(reed.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, tintColor.copy(GRASS_COLOR).multiplyScalar(reed.tint))
    }

    // Rejected slopes leave empty slots at the tail; truncate the draw count.
    mesh.count = reeds.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [reeds])

  return <instancedMesh ref={meshRef} args={[REED_GEOMETRY, REED_MATERIAL, PLANT_COUNT]} />
}
