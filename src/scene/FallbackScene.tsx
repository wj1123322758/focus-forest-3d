import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useFocusStore } from '../store/focusStore'
import './fallback.css'

// 2D stand-in for browsers without WebGL. Mirrors the growth/wilt state
// machine of Tree.tsx: idle -> seedling, running/paused -> progress-driven
// growth, completed -> full size, dead -> frozen size plus a withered look.
// CSS transitions smooth the 1 Hz store updates the same way the 3D tree's
// damping does.

interface View {
  growth: number
  withered: boolean
}

const LEAVES = [
  { className: 'fallback-tree__leaf--low', style: { left: 2, bottom: 4, width: 76, height: 76 } },
  { className: 'fallback-tree__leaf--mid', style: { right: 0, bottom: 34, width: 60, height: 60 } },
  { className: 'fallback-tree__leaf--top', style: { left: 44, bottom: 66, width: 48, height: 48 } },
] as const

export default function FallbackScene() {
  const status = useFocusStore((s) => s.status)
  const progress = useFocusStore((s) => s.progress)
  const [view, setView] = useState<View>({ growth: 0, withered: false })
  const frozenGrowth = useRef(0)

  useEffect(() => {
    if (status === 'dead') {
      setView({ growth: frozenGrowth.current, withered: true })
      return
    }
    const growth =
      status === 'completed'
        ? 1
        : status === 'running' || status === 'paused'
          ? progress
          : 0
    frozenGrowth.current = growth
    setView({ growth, withered: false })
  }, [status, progress])

  const treeStyle = { '--growth': view.growth } as CSSProperties

  return (
    <div className="fallback-scene">
      <div className="fallback-sky" />
      <div className="fallback-sun" />
      <div className="fallback-cloud fallback-cloud--a" />
      <div className="fallback-cloud fallback-cloud--b" />
      <div className="fallback-cloud fallback-cloud--c" />

      <div className="fallback-ground" />
      <div className="fallback-motes">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className={`fallback-mote fallback-mote--${index}`} />
        ))}
      </div>

      <div className={`fallback-tree${view.withered ? ' is-withered' : ''}`} style={treeStyle}>
        <div className="fallback-tree__inner">
          <div className="fallback-tree__crown">
            {LEAVES.map((leaf) => (
              <span
                key={leaf.className}
                className={`fallback-tree__leaf ${leaf.className}`}
                style={leaf.style}
              />
            ))}
          </div>
          <div className="fallback-tree__trunk" />
        </div>
      </div>

      <p className="fallback-notice">当前为 2D 兼容模式 · 设备不支持 WebGPU / WebGL</p>
    </div>
  )
}
