import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, PCFShadowMap, WebGPURenderer } from 'three/webgpu'
import SkyDome from './sky/SkyDome'
import SunLight from './sky/SunLight'
import Island from './island/Island'
import Ocean from './ocean/Ocean'
import Rocks from './island/Rocks'
import ShorePlants from './props/ShorePlants'
import Atmosphere from './props/Atmosphere'
import Tree from './Tree'
import ForestPlot from './ForestPlot'
import CameraRig from './CameraRig'
import {
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_POSITION,
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
} from './shared/sceneConfig'

// One renderer for every device: WebGPURenderer silently runs on a WebGL2
// backend when WebGPU is missing, so the same node materials and TSL shaders
// work from flagships down to old in-app browsers. The factory is async
// because device acquisition is; R3F mounts children only once it resolves.
// (The canvas is typed as EventTarget because that is R3F's OffscreenCanvas.)
const createRenderer = async (defaults: { canvas: HTMLCanvasElement | EventTarget }) => {
  const renderer = new WebGPURenderer({
    canvas: defaults.canvas as HTMLCanvasElement,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  await renderer.init()
  return renderer
}

export default function Scene() {
  return (
    <Canvas
      gl={createRenderer}
      dpr={[1, 2]}
      shadows={{ type: PCFShadowMap }}
      camera={{
        position: CAMERA_POSITION,
        fov: CAMERA_FOV,
        near: 0.1,
        far: CAMERA_FAR,
      }}
    >
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />

      <SkyDome />
      <SunLight />

      <Ocean />
      <Island />
      <Rocks />
      <ShorePlants />
      <Atmosphere />

      <Tree />
      <ForestPlot />

      <CameraRig />
    </Canvas>
  )
}
