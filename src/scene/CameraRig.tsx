import type { ElementRef } from 'react'
import { useEffect, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { MathUtils } from 'three/webgpu'
import { useFocusStore } from '../store/focusStore'
import { onZoomRequest } from '../cameraBus'
import {
  CAMERA_MAX_DISTANCE,
  CAMERA_MAX_POLAR,
  CAMERA_MIN_DISTANCE,
  CAMERA_TARGET,
} from './shared/sceneConfig'

// Owns the camera: OrbitControls for orbit/zoom, the zoom bus for HUD buttons,
// and the idle auto-orbit. Zoom intents go through the same distance clamp
// OrbitControls applies to wheel/pinch, so every input stays in sync.
export default function CameraRig() {
  const status = useFocusStore((s) => s.status)
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null)

  useEffect(
    () =>
      onZoomRequest((factor) => {
        const controls = controlsRef.current
        if (!controls) return
        const offset = controls.object.position.clone().sub(controls.target)
        const distance = MathUtils.clamp(
          offset.length() * factor,
          controls.minDistance,
          controls.maxDistance,
        )
        controls.object.position.copy(controls.target).add(offset.setLength(distance))
        controls.update()
      }),
    [],
  )

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={CAMERA_MIN_DISTANCE}
      maxDistance={CAMERA_MAX_DISTANCE}
      minPolarAngle={0}
      maxPolarAngle={CAMERA_MAX_POLAR}
      target={CAMERA_TARGET}
      autoRotate={status === 'idle'}
      autoRotateSpeed={0.4}
    />
  )
}
