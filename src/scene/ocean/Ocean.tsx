import { useMemo } from 'react'
import { PlaneGeometry } from 'three/webgpu'
import { OCEAN_SEGMENTS, OCEAN_SIZE } from '../shared/sceneConfig'
import { createWaterMaterial } from './waterMaterial'

// The sea is a single flat plane at the world origin: the material carries
// every visual detail (waves, foam, shore lines), so there is nothing for this
// component to update per frame — geometry and material are built once.
export default function Ocean() {
  const geometry = useMemo(
    () => new PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEGMENTS, OCEAN_SEGMENTS),
    [],
  )
  const material = useMemo(() => createWaterMaterial(), [])

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      material={material}
      receiveShadow={false}
    />
  )
}
