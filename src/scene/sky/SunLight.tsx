import { PALETTE, SUN_DIRECTION, SUN_DISTANCE } from '../shared/sceneConfig'

// Placed along the same direction the sky dome draws the sun, so the light and
// the visible disc line up. Distance comes from the shared contract.
const SUN_POSITION: [number, number, number] = [
  SUN_DIRECTION[0] * SUN_DISTANCE,
  SUN_DIRECTION[1] * SUN_DISTANCE,
  SUN_DIRECTION[2] * SUN_DISTANCE,
]

const SUN_INTENSITY = 2.6
const HEMISPHERE_INTENSITY = 0.7

// The shadow camera wraps the whole island (radius 30) with a small margin;
// near/far are chosen so only the island region is ever shadow-tested.
const SHADOW_EXTENT = 32
const SHADOW_NEAR = 1
const SHADOW_FAR = 300

export default function SunLight() {
  return (
    <>
      <directionalLight
        castShadow
        position={SUN_POSITION}
        color={PALETTE.sunLight}
        intensity={SUN_INTENSITY}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={SHADOW_NEAR}
        shadow-camera-far={SHADOW_FAR}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      {/* Bounce from sky and ground; an ambientLight on top would wash it out. */}
      <hemisphereLight
        color={PALETTE.skyLight}
        groundColor={PALETTE.groundBounce}
        intensity={HEMISPHERE_INTENSITY}
      />
    </>
  )
}
