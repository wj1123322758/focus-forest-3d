import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { PALETTE } from '../shared/sceneConfig'
import { hash01 } from '../shared/terrain'

// Shore mist: a low, soft ring of water vapour straddling the waterline.
// Point primitives collapse to 1 pixel on a WebGPU backend, so the motes are
// instanced camera-facing quads re-oriented every frame. Drift is a slow rise
// plus an orbit of the island; all randomness comes from the shared hash so
// the field is identical on every refresh.

const MIST_COUNT = 240

const RING_INNER = 21
const RING_OUTER = 29
const RADIAL_SWAY = 0.12
const SWAY_FREQUENCY = 0.15

const HEIGHT_MIN = 0.1
const HEIGHT_MAX = 1.2
const RISE_MIN = 0.02
const RISE_MAX = 0.06
const ORBIT_MIN = 0.02
const ORBIT_MAX = 0.06

const SCALE_MIN = 0.25
const SCALE_MAX = 0.6
// Instance colors multiply the base material color; the dim end keeps the
// band soft instead of a wall of white. MeshBasicNodeMaterial picks up
// InstancedMesh.instanceColor automatically, no TSL color graph needed.
const TINT_MIN = 0.4
const TINT_MAX = 0.7

const MIST_GEOMETRY = new THREE.PlaneGeometry(1, 1)
const MIST_MATERIAL = new THREE.MeshBasicNodeMaterial({
  color: PALETTE.foam,
  transparent: true,
  opacity: 0.13,
  depthWrite: false,
  side: THREE.DoubleSide,
})

const FOAM_COLOR = new THREE.Color(PALETTE.foam)
const dummy = new THREE.Object3D()
const tintColor = new THREE.Color()
const cameraPosition = new THREE.Vector3()
const lookTarget = new THREE.Vector3()

interface Mote {
  angle: number
  radius: number
  y: number
  rise: number
  orbit: number
  phase: number
  scale: number
  tint: number
}

function buildMotes(): Mote[] {
  const motes: Mote[] = []

  for (let i = 0; i < MIST_COUNT; i++) {
    // Stay clear of both band edges so the radial sway below can never push
    // a mote out of the ring.
    const radius = RING_INNER + 0.2 + hash01(i, 3) * (RING_OUTER - RING_INNER - 0.4)
    // Orbit is stored as an angular rate derived from the linear speed, so
    // outer motes still need a full period to circle the island.
    const linearSpeed = ORBIT_MIN + hash01(i, 4) * (ORBIT_MAX - ORBIT_MIN)

    motes.push({
      angle: hash01(i, 1) * Math.PI * 2,
      radius,
      y: HEIGHT_MIN + hash01(i, 2) * (HEIGHT_MAX - HEIGHT_MIN),
      rise: RISE_MIN + hash01(i, 5) * (RISE_MAX - RISE_MIN),
      orbit: linearSpeed / radius,
      phase: hash01(i, 6) * Math.PI * 2,
      scale: SCALE_MIN + hash01(i, 7) * (SCALE_MAX - SCALE_MIN),
      tint: TINT_MIN + hash01(i, 8) * (TINT_MAX - TINT_MIN),
    })
  }

  return motes
}

const MOTES = buildMotes()

export default function Atmosphere() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const camera = useThree((s) => s.camera)

  // Static per-instance data lives on the mesh object, which only exists
  // after mount; a layout effect fills it before the first paint.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    // Matrices are rewritten every frame, so upload them as dynamic.
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    for (let i = 0; i < MOTES.length; i++) {
      mesh.setColorAt(i, tintColor.copy(FOAM_COLOR).multiplyScalar(MOTES[i].tint))
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const dt = Math.min(delta, 0.1)
    const time = state.clock.elapsedTime

    // lookAt wants the camera in the mesh's local space; converting through
    // the mesh keeps this correct if the component is rendered under a
    // transformed parent.
    mesh.updateWorldMatrix(true, false)
    camera.getWorldPosition(cameraPosition)
    lookTarget.copy(cameraPosition)
    mesh.worldToLocal(lookTarget)

    for (let i = 0; i < MOTES.length; i++) {
      const mote = MOTES[i]
      mote.angle += mote.orbit * dt
      mote.y += mote.rise * dt
      if (mote.y > HEIGHT_MAX) mote.y = HEIGHT_MIN

      // Radial breathing keeps the band from reading as a hard ring.
      const radius = mote.radius + Math.sin(time * SWAY_FREQUENCY + mote.phase) * RADIAL_SWAY
      dummy.position.set(Math.cos(mote.angle) * radius, mote.y, Math.sin(mote.angle) * radius)
      dummy.lookAt(lookTarget)
      dummy.scale.setScalar(mote.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[MIST_GEOMETRY, MIST_MATERIAL, MIST_COUNT]}
      frustumCulled={false}
    />
  )
}
