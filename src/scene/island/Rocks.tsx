import { useMemo } from 'react'
import { Color, IcosahedronGeometry, MeshStandardNodeMaterial } from 'three/webgpu'
import { PALETTE } from '../shared/sceneConfig'
import { hash01, islandHeight } from '../shared/terrain'

// A ring of sea-washed boulders just outside the shoreline: some sit on the
// beach slope, others are sunk so only their crown breaks the surface.

const ROCK_COUNT = 16
const RING_INNER = 20
const RING_OUTER = 26
const SIZE_MIN = 0.4
const SIZE_MAX = 1.6
const SUNK_MIN = 0.2
const SUNK_MAX = 0.5

// Radial displacement by vertex index: lumpy enough to look weathered, subtle
// enough that the silhouette stays boulder-like. flatShading does the rest, so
// normals never need recomputing.
const displace = (geometry: IcosahedronGeometry, salt: number): void => {
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const factor = 0.78 + 0.44 * hash01(i, salt)
    position.setXYZ(
      i,
      position.getX(i) * factor,
      position.getY(i) * factor,
      position.getZ(i) * factor,
    )
  }
  position.needsUpdate = true
}

const buildRock = (salt: number, flatten: number): IcosahedronGeometry => {
  const geometry = new IcosahedronGeometry(1, 1)
  displace(geometry, salt)
  geometry.scale(1, flatten, 1)
  return geometry
}

// A few shared blobs and tones, cycled across the rocks: cheaper than one
// geometry/material per rock and the per-rock rotation hides the repeats.
const FLATTEN = [0.62, 0.72, 0.55, 0.8]
const ROCK_GEOMETRIES = [101, 233, 349, 467].map((salt, index) =>
  buildRock(salt, FLATTEN[index]),
)

const ROCK_TONES = ['rock', 'mid', 'dark'] as const

const rockMaterial = (color: Color): MeshStandardNodeMaterial =>
  new MeshStandardNodeMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
  })

const ROCK_MATERIALS: Record<(typeof ROCK_TONES)[number], MeshStandardNodeMaterial> = {
  rock: rockMaterial(new Color(PALETTE.rock)),
  mid: rockMaterial(new Color(PALETTE.rock).lerp(new Color(PALETTE.rockDark), 0.5)),
  dark: rockMaterial(new Color(PALETTE.rockDark)),
}

interface Rock {
  key: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  geometry: IcosahedronGeometry
  material: MeshStandardNodeMaterial
}

const buildRocks = (): Rock[] => {
  const step = (Math.PI * 2) / ROCK_COUNT
  const jitter = step * 0.35

  return Array.from({ length: ROCK_COUNT }, (_, index): Rock => {
    const angle = index * step + (hash01(index, 1) - 0.5) * 2 * jitter
    const radius = RING_INNER + hash01(index, 2) * (RING_OUTER - RING_INNER)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const sink = SUNK_MIN + hash01(index, 4) * (SUNK_MAX - SUNK_MIN)
    // Pow curve biases toward small pebbles with a few big boulders mixed in.
    const scale = SIZE_MIN + (SIZE_MAX - SIZE_MIN) * Math.pow(hash01(index, 5), 1.6)

    return {
      key: `rock-${index}`,
      // Sunk pivot: the rock is planted in the terrain, not floating on it.
      position: [x, islandHeight(x, z) - sink, z],
      rotation: [
        (hash01(index, 6) - 0.5) * 0.35,
        hash01(index, 7) * Math.PI * 2,
        (hash01(index, 8) - 0.5) * 0.35,
      ],
      scale,
      geometry: ROCK_GEOMETRIES[index % ROCK_GEOMETRIES.length],
      material: ROCK_MATERIALS[ROCK_TONES[Math.floor(hash01(index, 9) * ROCK_TONES.length)]],
    }
  })
}

export default function Rocks() {
  const rocks = useMemo(buildRocks, [])

  return (
    <group>
      {rocks.map((rock) => (
        <mesh
          key={rock.key}
          castShadow
          receiveShadow
          geometry={rock.geometry}
          material={rock.material}
          position={rock.position}
          rotation={rock.rotation}
          scale={rock.scale}
        />
      ))}
    </group>
  )
}
