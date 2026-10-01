import Scene from './scene/Scene'
import SceneBoundary from './scene/SceneBoundary'
import FallbackScene from './scene/FallbackScene'
import HUD from './ui/HUD'
import { useSessionTicker } from './hooks/useSessionTicker'
import { useRendererSupport } from './hooks/useRendererSupport'

export default function App() {
  useSessionTicker()
  // WebGPURenderer falls back to a WebGL2 backend on its own, so the 3D scene
  // renders whenever either API exists; only a GPU-less device (some in-app
  // browsers, remote desktops) drops to the 2D stand-in, which keeps the
  // session logic identical instead of showing a blank page.
  const support = useRendererSupport()

  return (
    <div className="app">
      {support !== 'none' ? (
        <SceneBoundary>
          <Scene />
        </SceneBoundary>
      ) : (
        <FallbackScene />
      )}
      <div className="hud-layer">
        <HUD />
      </div>
    </div>
  )
}
