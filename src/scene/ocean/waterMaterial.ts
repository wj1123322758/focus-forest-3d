import { Color } from 'three'

// Procedural ocean surface. Ripples, shore foam and the wet-sand trace all
// live in the fragment shader: the geometry stays a flat plane (normal-only
// scheme), so the whole sea is one static draw call with no per-frame CPU work
// — TSL's `time` uniform drives the animation by itself.
import { MeshPhysicalNodeMaterial } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import {
  Fn,
  cameraPosition,
  cameraViewMatrix,
  float,
  mix,
  mx_fractal_noise_float_2d,
  normalize,
  oneMinus,
  positionWorld,
  pow,
  saturate,
  smoothstep,
  time,
  uniform,
  vec2,
  vec3,
} from 'three/tsl'
import { PALETTE, SHORE_RADIUS } from '../shared/sceneConfig'

// mx_* noise is loosely typed in TSL; narrow the result before it reaches a
// typed slot.
const asFloat = (n: Node): Node<'float'> => n as Node<'float'>

/** Finite-difference step (m) that turns the height field into a normal. */
const WAVE_STEP = 0.35
/** High-frequency chop fades out between these radii, keeping the horizon clean. */
const CHOP_FADE_NEAR = 150
const CHOP_FADE_FAR = 300

/**
 * Wave height at a world-space xz point: a broad swell plus a faster chop
 * crossing it at another angle. `detail` (1 near the camera, 0 far away) damps
 * the high-frequency layer so fine detail never aliases at the horizon.
 */
const waveHeight = Fn(([p, detail]: [Node<'vec2'>, Node<'float'>]) => {
  const swell = asFloat(
    mx_fractal_noise_float_2d(
      p.mul(float(0.045)).add(vec2(time.mul(0.035), time.mul(0.014))),
      2,
      2.15,
      0.55,
    ),
  )
  const chop = asFloat(
    mx_fractal_noise_float_2d(
      p.mul(float(0.22)).sub(vec2(time.mul(0.11), time.mul(0.06))),
      2,
      2.3,
      0.5,
    ),
  )
  // The plane never moves, so these amplitudes are normal-strength dials
  // rather than real wave heights.
  return swell.mul(float(0.38)).add(chop.mul(float(0.14)).mul(detail))
})

/** Inverted ramp: 0 below `near`, 1 beyond `far`. */
const falloff = (near: Node<'float'>, far: Node<'float'>, x: Node<'float'>): Node<'float'> =>
  oneMinus(smoothstep(near, far, x))

/** Two scrolling fbm layers remapped to 0..1 — the base for surf breakup. */
const surfNoise = Fn(([p]: [Node<'vec2'>]) => {
  const fast = asFloat(
    mx_fractal_noise_float_2d(
      p.mul(float(0.32)).add(vec2(time.mul(0.5), time.mul(0.22))),
      2,
      2.1,
      0.5,
    ),
  )
  const slow = asFloat(
    mx_fractal_noise_float_2d(
      p.mul(float(0.085)).sub(vec2(time.mul(0.07), time.mul(0.16))),
      2,
      2,
      0.5,
    ),
  )
  return fast
    .mul(float(0.5))
    .add(float(0.5))
    .mul(float(0.55))
    .add(slow.mul(float(0.5)).add(float(0.5)).mul(float(0.45)))
})

export function createWaterMaterial(): MeshPhysicalNodeMaterial {
  const material = new MeshPhysicalNodeMaterial()
  material.metalness = 0
  material.roughness = 0.08
  // Water's index of refraction: dielectric highlights, not metal ones.
  material.ior = 1.33
  // The sky env already carries most of the reflection; damping it lets the
  // water body colour read instead of turning every grazing angle to haze.
  material.envMapIntensity = 0.7

  const shoreRadius = uniform(SHORE_RADIUS)
  // Palette hex -> linear-space vec3 constants. (TSL color() const nodes do
  // not blend correctly inside mix() on this path, so the conversion happens
  // in JS where ColorManagement still applies.)
  const palette = (hex: string) => {
    const c = new Color(hex)
    return vec3(c.r, c.g, c.b)
  }
  const deepWater = palette(PALETTE.waterDeep)
  const shallowWater = palette(PALETTE.waterShallow)
  const scatter = palette(PALETTE.waterScatter)
  const wetSand = palette(PALETTE.sandWet)
  const foamColor = palette(PALETTE.foam)

  const waveXz = positionWorld.xz
  const dist = waveXz.length()
  const detail = falloff(float(CHOP_FADE_NEAR), float(CHOP_FADE_FAR), dist)

  // --- wave normals ------------------------------------------------------
  // Sample the height field at p, p+dx and p+dz and build the gradient by
  // finite differences; the resulting normal is the only place waves show up.
  const height = waveHeight(waveXz, detail)
  const dhdx = waveHeight(waveXz.add(vec2(float(WAVE_STEP), float(0))), detail)
    .sub(height)
    .div(float(WAVE_STEP))
  const dhdz = waveHeight(waveXz.add(vec2(float(0), float(WAVE_STEP))), detail)
    .sub(height)
    .div(float(WAVE_STEP))
  const waveNormal = normalize(vec3(dhdx.negate(), float(1), dhdz.negate()))
  // normalNode is consumed in view space, so rotate the world normal over.
  material.normalNode = waveNormal.transformNormalByViewMatrix(cameraViewMatrix).normalize()

  // --- water body --------------------------------------------------------
  // Shallow where the seabed shows through near the island, deep offshore.
  const body = mix(
    shallowWater,
    deepWater,
    smoothstep(shoreRadius.add(float(6)), shoreRadius.add(float(46)), dist),
  )
  // Looking along the surface, sunlight scattered back through the water
  // column brightens the sea and keeps grazing views from going flat black.
  const viewDir = normalize(cameraPosition.sub(positionWorld))
  const waterColor = mix(
    body,
    scatter,
    pow(oneMinus(saturate(viewDir.y)), float(3)).mul(float(0.35)),
  )

  // --- surf --------------------------------------------------------------
  // Two bands hugging the waterline: a wide broken-up swell zone and a tight
  // whitewater line where the waves actually break. Both are thresholded
  // against the same scrolling noise so foam reads as patches of surf that
  // roll in and out, never a solid white sheet.
  const noise01 = surfNoise(waveXz)
  const crestGate = mix(float(0.4), float(1), saturate(height.mul(float(0.5)).add(float(0.5))))
  const surfBand = smoothstep(shoreRadius.sub(float(1)), shoreRadius.add(float(3.5)), dist).mul(
    falloff(shoreRadius.add(float(9)), shoreRadius.add(float(16)), dist),
  )
  const breakBand = smoothstep(shoreRadius.sub(float(0.5)), shoreRadius.add(float(2.5)), dist).mul(
    falloff(shoreRadius.add(float(5)), shoreRadius.add(float(8)), dist),
  )
  const patches = smoothstep(float(0.35), float(0.72), noise01).mul(surfBand).mul(crestGate)
  const breakers = smoothstep(float(0.38), float(0.75), noise01).mul(breakBand)
  const foam = saturate(patches.add(breakers))

  // Wet seabed: a narrow dark band inside the surf where the water is only
  // centimetres deep.
  const wetBand = smoothstep(shoreRadius.sub(float(2.5)), shoreRadius.add(float(1)), dist).mul(
    falloff(shoreRadius.add(float(4.5)), shoreRadius.add(float(7.5)), dist),
  )

  // Every blend stage lands in a var: chained mix() calls confuse TSL's
  // input-type inference on this path and silently drop the blend.
  const wet = wetBand.mul(float(0.8)).toVar('wet')
  const surf = foam.mul(float(0.9)).toVar('surf')
  const bodyColor = mix(waterColor, wetSand, wet).toVar('bodyColor')
  material.colorNode = mix(bodyColor, foamColor, surf)

  // --- roughness ---------------------------------------------------------
  // Slight wave-driven variation breaks the sun highlight into moving glitter
  // instead of one flat mirror; a stretched low-frequency layer adds faint
  // anisotropic streaks along the wind, damped into the far field.
  const streak = asFloat(
    mx_fractal_noise_float_2d(
      vec2(waveXz.x.mul(float(0.035)), waveXz.y.mul(float(0.012))).add(
        vec2(time.mul(0.03), float(0)),
      ),
      1,
      2,
      0.5,
    ),
  )
  const gloss = mix(float(0.055), float(0.12), saturate(height.mul(float(0.5)).add(float(0.5))))
  const roughness = gloss.add(streak.mul(float(0.03)).mul(detail))
  // Foam is matte: it kills the specular wherever it sits.
  material.roughnessNode = mix(roughness, float(0.9), foam.mul(float(0.85)))
  material.metalnessNode = float(0)

  return material
}
