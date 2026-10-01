import type { SessionStatus } from '../store/focusStore'
import { useFocusStore } from '../store/focusStore'

type PrimaryAction = { label: string; aria: string }

const PRIMARY: Record<SessionStatus, PrimaryAction> = {
  idle: { label: '开始专注', aria: '开始专注' },
  running: { label: '暂停', aria: '暂停专注' },
  paused: { label: '继续', aria: '继续专注' },
  // After a session ends, the primary button opens a fresh session again.
  completed: { label: '开始专注', aria: '再次开始专注' },
  dead: { label: '开始专注', aria: '重新开始专注' },
}

export default function Controls() {
  const status = useFocusStore((s) => s.status)
  const start = useFocusStore((s) => s.start)
  const pause = useFocusStore((s) => s.pause)
  const resume = useFocusStore((s) => s.resume)
  const giveUp = useFocusStore((s) => s.giveUp)

  const sessionActive = status === 'running' || status === 'paused'
  const sessionOver = status === 'dead' || status === 'completed'

  const handlePrimary = (): void => {
    if (status === 'running') pause()
    else if (status === 'paused') resume()
    else start()
  }

  const handleGiveUp = (): void => {
    if (window.confirm('现在离开，这棵树会枯萎。确定放弃吗？')) giveUp()
  }

  const primary = PRIMARY[status]

  return (
    <div className="controls">
      <button
        type="button"
        className="hud-button hud-button--primary"
        onClick={handlePrimary}
        aria-label={primary.aria}
      >
        {primary.label}
      </button>
      {sessionActive && (
        <button
          type="button"
          className="hud-button hud-button--danger"
          onClick={handleGiveUp}
          aria-label="放弃本次专注"
        >
          放弃
        </button>
      )}
      {sessionOver && (
        <button
          type="button"
          className="hud-button hud-button--ghost"
          onClick={() => start()}
          aria-label="重新开始专注"
        >
          重新开始
        </button>
      )}
    </div>
  )
}
