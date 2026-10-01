import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import {
  BackSide,
  Mesh,
  MeshBasicNodeMaterial,
  PMREMGenerator,
  Scene as CaptureScene,
  SphereGeometry,
} from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'
import {
  cameraPosition,
  dot,
  float,
  mix,
  normalize,
  oneMinus,
  positionWorld,
  pow,
  saturate,
  smoothstep,
  vec3,
} from 'three/tsl'
import { Color } from 'three/webgpu'
import { PALETTE, SUN_DIRECTION } from '../shared/sceneConfig'

// The dome must reach past the fog far plane (900) so the zenith-to-horizon
// gradient is not flattened to the fog colour along the horizon line.
const SKY_RADIUS = 1500

// The PMREM cube camera has to contain the dome, so its far plane exceeds the
// radius; near is 1 so the island itself never clips the capture.
const PMREM_NEAR = 1
const PMREM_FAR = 2000

// Angular radius of the disc in radians. Slightly oversized so it still reads
// as a stylised sun on small screens.
const DISC_COS = Math.cos(0.018)
const DISC_SOFT_COS = Math.cos(0.026)

const SKY_GEOMETRY = new SphereGeometry(SKY_RADIUS, 64, 32)

const SUN_DIRECTION_NODE = vec3(SUN_DIRECTION[0], SUN_DIRECTION[1], SUN_DIRECTION[2])

// sRGB hex -> linear-space vec3 constant. TSL color() const nodes do not blend
// correctly inside mix() here, so the conversion happens in JS, where
// ColorManagement still applies.
const palette = (hex: string) => {
  const c = new Color(hex)
  return vec3(c.r, c.g, c.b)
}

// Procedural sky as a view direction function: zenith gradient, a warm band
// hugging the horizon, and the sun disc with two power-falloff glow layers.
// Palette hexes become linear-space vec3 constants in JS and every blend
// stage lands in a var: chained mix() calls over TSL colour constants
// silently drop the blend on this path. Every number that shares a vec3 slot
// goes through float(), and all smoothstep bands keep edge0 < edge1.
function buildSkyColorNode() {
  const view = normalize(positionWorld.sub(cameraPosition))
  const altitude = view.y

  // Near-level cameras only ever see the lowest slice of the dome, so the
  // gradient has to climb fast or the sky reads as a flat haze.
  const gradient = mix(
    palette(PALETTE.skyHorizon),
    palette(PALETTE.skyZenith),
    pow(saturate(altitude), float(0.34)),
  ).toVar('skyGradient')

  // Warm air just above the horizon, where the ocean fogs out into the sky.
  const horizonWarm = oneMinus(smoothstep(float(0), float(0.2), altitude)).toVar('horizonWarm')
  let shade = gradient.add(palette(PALETTE.sunGlow).mul(horizonWarm).mul(float(0.18)))

  // Broad haze plus a tight corona, both aligned with the directional light.
  const sunDot = dot(view, SUN_DIRECTION_NODE)
  const glow = pow(saturate(sunDot), float(48))
    .mul(float(0.3))
    .add(pow(saturate(sunDot), float(640)).mul(float(0.5)))
  shade = shade.add(palette(PALETTE.sunGlow).mul(glow)).toVar('skyShade')

  // Crisp disc: 1 inside the edge, 0 outside. (The oneMinus that used to sit
  // here inverted the mask and painted the whole dome in the disc colour.)
  const disc = smoothstep(float(DISC_SOFT_COS), float(DISC_COS), sunDot).toVar('sunDiscMask')
  return mix(shade, palette(PALETTE.sunDisc), disc)
}

// Shared by the visible dome and the PMREM capture. Material and geometry are
// module-level (never per frame) and must not be disposed with the capture.
const SKY_MATERIAL = new MeshBasicNodeMaterial({
  side: BackSide,
  depthWrite: false,
  // The horizon band already matches the fog colour, so fog would only wash
  // the dome out to a single tone.
  fog: false,
})

// A lit basic node material folds scene.environment into its outgoing light
// (and bakes in an extra ambient term); the dome is the source of that
// environment, so it has to stay strictly unlit.
SKY_MATERIAL.lights = false
SKY_MATERIAL.colorNode = buildSkyColorNode()

export default function SkyDome() {
  // R3F v9 types the renderer as WebGLRenderer, but the app runs the unified
  // WebGPURenderer (WebGL2 fallback). The cast is truthful at runtime.
  const renderer = useThree((state) => state.gl) as unknown as WebGPURenderer
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    let cancelled = false
    let releaseEnv: (() => void) | null = null

    // Throwaway scene holding a copy of the very same dome mesh: what the
    // water reflects is exactly what the camera sees. Nothing here is
    // disposed but the PMREM generator and its render target.
    const captureEnvironment = () => {
      if (cancelled) return

      // PMREM throws when the backend is not up yet. The R3F gl factory
      // normally awaits renderer.init(), so this is a no-op guard; init()
      // is cached and resolves immediately once the renderer is ready.
      if (renderer.hasInitialized() === false) {
        void renderer.init().then(captureEnvironment).catch(() => {
          // Without a PMREM the water simply loses its sky reflection.
        })
        return
      }

      const pmrem = new PMREMGenerator(renderer)
      const captureScene = new CaptureScene()
      const captureMesh = new Mesh(SKY_GEOMETRY, SKY_MATERIAL)
      captureScene.add(captureMesh)

      const env = pmrem.fromScene(captureScene, 0, PMREM_NEAR, PMREM_FAR)
      scene.environment = env.texture

      releaseEnv = () => {
        scene.environment = null
        captureScene.remove(captureMesh)
        env.dispose()
        pmrem.dispose()
      }
    }

    captureEnvironment()

    return () => {
      cancelled = true
      releaseEnv?.()
    }
  }, [renderer, scene])

  return (
    <mesh geometry={SKY_GEOMETRY} material={SKY_MATERIAL} frustumCulled={false} />
  )
}
