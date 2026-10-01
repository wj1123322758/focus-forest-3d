import type { SessionStatus } from '../store/focusStore'
import { useFocusStore } from '../store/focusStore'

const RADIUS = 92
const CENTER = 110
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: '准备开始',
  running: '专注中',
  paused: '已暂停',
  completed: '已完成 🌱',
  dead: '已放弃',
}

function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.ceil(totalSec))
  const mm = Math.floor(safe / 60)
  const ss = safe % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export default function TimerRing() {
  const remainingSec = useFocusStore((s) => s.remainingSec)
  const progress = useFocusStore((s) => s.progress)
  const status = useFocusStore((s) => s.status)

  const time = formatClock(remainingSec)
  const label = STATUS_LABEL[status]
  const dashOffset = CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)))

  return (
    <div className={`timer-ring timer-ring--${status}`}>
      <div className="timer-ring__disc">
        <svg
          className="timer-ring__svg"
          viewBox="0 0 220 220"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="timerRingStroke"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#2f7d4f" />
              <stop offset="55%" stopColor="#6fcf97" />
              <stop offset="100%" stopColor="#c9f2a6" />
            </linearGradient>
          </defs>
          <circle
            className="timer-ring__track"
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
          />
          <circle
            className="timer-ring__progress"
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="timer-ring__center">
          <div className="timer-ring__time">{time}</div>
          <div className="timer-ring__status">{label}</div>
        </div>
      </div>
    </div>
  )
}
