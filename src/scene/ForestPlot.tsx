import { useMemo } from 'react'
import {
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardNodeMaterial,
} from 'three/webgpu'
import { useFocusStore } from '../store/focusStore'
import { FOREST_RING_INNER, FOREST_RING_OUTER, PALETTE } from './shared/sceneConfig'
import { hash01, islandHeight } from './shared/terrain'

// Ring of previously grown trees on the island's slope. Each placement is
// derived from the tree id so a page refresh never reshuffles the forest.

const MAX_PLOT_TREES = 30

const TRUNK_HEIGHT = 1
const TRUNK_GEOMETRY = new CylinderGeometry(0.045, 0.11, TRUNK_HEIGHT, 7, 1)
const FOLIAGE_LOW = new IcosahedronGeometry(0.42, 1)
const FOLIAGE_TOP = new IcosahedronGeometry(0.3, 1)
const TRUNK_MATERIAL = new MeshStandardNodeMaterial({
  color: PALETTE.trunk,
  roughness: 0.92,
  metalness: 0,
})
const FOLIAGE_MATERIAL = new MeshStandardNodeMaterial({
  color: PALETTE.leafFresh,
  roughness: 0.8,
  metalness: 0,
  flatShading: true,
})

interface PlotTree {
  id: string
  position: [number, number, number]
  rotationY: number
  scale: number
}

interface StaticTreeProps {
  position: [number, number, number]
  rotationY: number
  scale: number
}

function StaticTree({ position, rotationY, scale }: StaticTreeProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh
        castShadow
        geometry={TRUNK_GEOMETRY}
        material={TRUNK_MATERIAL}
        position={[0, TRUNK_HEIGHT / 2, 0]}
      />
      <mesh
        castShadow
        geometry={FOLIAGE_LOW}
        material={FOLIAGE_MATERIAL}
        position={[0, 1.12, 0]}
      />
      <mesh
        castShadow
        geometry={FOLIAGE_TOP}
        material={FOLIAGE_MATERIAL}
        position={[0.08, 1.58, -0.05]}
      />
    </group>
  )
}

export default function ForestPlot() {
  const forest = useFocusStore((s) => s.forest)

  const trees = useMemo<PlotTree[]>(() => {
    const recent = forest.slice(-MAX_PLOT_TREES)
    const count = recent.length
    if (count === 0) return []

    const step = (Math.PI * 2) / count
    const jitterSpan = step * 0.28

    return recent.map((tree, index): PlotTree => {
      const id = tree.id
      // Two stable 0..1 draws per axis: the ring angle and the ring radius.
      const angleJitter = (hash01(1, index * 2 + 1) - 0.5) * 2 * jitterSpan
      const radiusJitter = hash01(1, index * 2 + 2)
      const angle = index * step + angleJitter
      const radius = FOREST_RING_INNER + radiusJitter * (FOREST_RING_OUTER - FOREST_RING_INNER)
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      // Longer sessions yield bigger trees, with a per-tree size jitter.
      const sizeJitter = 0.85 + hash01(1, index * 2 + 3) * 0.3
      const scale = (0.55 + 0.35 * Math.min(1, tree.durationMin / 60)) * sizeJitter

      return {
        id,
        position: [x, islandHeight(x, z), z],
        rotationY: hash01(1, index * 2 + 4) * Math.PI * 2,
        scale,
      }
    })
  }, [forest])

  return (
    <group>
      {trees.map((tree) => (
        <StaticTree
          key={tree.id}
          position={tree.position}
          rotationY={tree.rotationY}
          scale={tree.scale}
        />
      ))}
    </group>
  )
}
