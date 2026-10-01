import { useMemo } from 'react'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  MeshStandardNodeMaterial,
  PlaneGeometry,
} from 'three/webgpu'
import { attribute } from 'three/tsl'
import { PALETTE } from '../shared/sceneConfig'
import { hash01, islandHeight, islandSlope, ISLAND_TERRAIN_RADIUS } from '../shared/terrain'

// The height field is displaced on a plane, not a CircleGeometry fan: the fan
// only owns one center vertex, so its radial profile collapses into linear
// wedges and the hill ring would vanish. The square corners bottom out at
// -1.5m, hidden by the opaque ocean plane at y=0.
const TERRAIN_SIZE = ISLAND_TERRAIN_RADIUS * 2
const TERRAIN_SEGMENTS = 200

const SAND_TOP = 0.4
const WET_SHORE_SHADE = 0.78
const WET_DEEP_SHADE = 0.5
const ROCK_SLOPE_START = 0.45
const ROCK_SLOPE_END = 0.75

// ColorManagement converts these hex strings into the linear working space on
// construction, so the vertex attribute stays linear too (no manual cast).
const SAND_WET = new Color(PALETTE.sandWet)
const SAND = new Color(PALETTE.sand)
const GRASS = new Color(PALETTE.grass)
const GRASS_DARK = new Color(PALETTE.grassDark)
const ROCK = new Color(PALETTE.rock)
const ROCK_DARK = new Color(PALETTE.rockDark)

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// Lattice value noise on top of the shared hash01: the shading wobble must be
// deterministic and come from the same hash the asset placement uses.
const latticeNoise = (x: number, z: number, salt: number): number => {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const u = smoothstep(xi, xi + 1, x)
  const v = smoothstep(zi, zi + 1, z)
  const a = hash01((xi & 1023) | ((zi & 1023) << 10), salt)
  const b = hash01(((xi + 1) & 1023) | ((zi & 1023) << 10), salt)
  const c = hash01((xi & 1023) | (((zi + 1) & 1023) << 10), salt)
  const d = hash01(((xi + 1) & 1023) | (((zi + 1) & 1023) << 10), salt)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

const wobbleNoise = (x: number, z: number, salt: number): number =>
  latticeNoise(x, z, salt) * 0.68 + latticeNoise(x * 2.07, z * 1.93, salt + 17) * 0.32

const scratchColor = new Color()

const shadeVertex = (x: number, z: number, y: number, out: Color): void => {
  if (y < 0) {
    // Sea floor: wet sand, darkened with depth so the shoreline reads as a
    // bright rim against the darker bottom.
    const depth = Math.min(1, -y / 1.5)
    const shade = WET_DEEP_SHADE + (WET_SHORE_SHADE - WET_DEEP_SHADE) * (1 - depth)
    out.copy(SAND_WET).multiplyScalar(shade)
    return
  }
  if (y < SAND_TOP) {
    // Beach: wet sand blending into dry sand as the ground dries out.
    out.copy(SAND_WET).lerp(SAND, y / SAND_TOP)
    out.multiplyScalar(0.94 + 0.12 * wobbleNoise(x * 0.35, z * 0.35, 41))
    return
  }
  // Inland grass, with a two-octave brightness wobble so the large slopes are
  // never a flat wash of green.
  out.copy(GRASS).lerp(GRASS_DARK, wobbleNoise(x * 0.09, z * 0.09, 53) * 0.7)
  // Steep faces and the near-shore bank bare their rock.
  const rockiness = smoothstep(ROCK_SLOPE_START, ROCK_SLOPE_END, islandSlope(x, z))
  if (rockiness > 0) {
    scratchColor.copy(ROCK).lerp(ROCK_DARK, wobbleNoise(x * 0.33, z * 0.33, 67))
    out.lerp(scratchColor, rockiness)
  }
}

const buildTerrainGeometry = (): BufferGeometry => {
  const geometry = new PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
  geometry.rotateX(-Math.PI / 2)

  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  const color = new Color()

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)
    const y = islandHeight(x, z)
    position.setY(i, y)
    shadeVertex(x, z, y, color)
    colors[i * 3 + 0] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  position.needsUpdate = true
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  return geometry
}

export default function Island() {
  // One-time CPU work: both objects live for the whole session.
  const geometry = useMemo(buildTerrainGeometry, [])
  const material = useMemo(() => {
    const nodeMaterial = new MeshStandardNodeMaterial({
      roughness: 0.95,
      metalness: 0,
    })
    nodeMaterial.colorNode = attribute('color', 'vec3')
    return nodeMaterial
  }, [])

  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}
