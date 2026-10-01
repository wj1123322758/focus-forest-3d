import Controls from './Controls'
import DurationPicker from './DurationPicker'
import StatsPanel from './StatsPanel'
import TimerRing from './TimerRing'
import ZoomButtons from './ZoomButtons'
import './hud.css'

export default function HUD() {
  return (
    <div className="hud">
      {/* Top-left: brand block */}
      <header className="hud-brand">
        <h1 className="hud-brand__title">专注森林 3D</h1>
        <p className="hud-brand__subtitle">Focus Forest · React Three Fiber</p>
      </header>

      {/* Top-center: countdown ring */}
      <div className="hud-timer">
        <TimerRing />
      </div>

      {/* Top-right: session stats */}
      <StatsPanel />

      {/* Bottom-left: camera hint + zoom buttons */}
      <div className="hud-camera">
        <p className="hud-hint">拖动旋转视角 · 滚轮 · 按钮缩放</p>
        <ZoomButtons />
      </div>

      {/* Bottom-center: duration chips above the control buttons */}
      <div className="hud-dock">
        <DurationPicker />
        <Controls />
      </div>
    </div>
  )
}
