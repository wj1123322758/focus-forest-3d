import { DURATION_PRESETS, useFocusStore } from '../store/focusStore'

export default function DurationPicker() {
  const durationMin = useFocusStore((s) => s.durationMin)
  const status = useFocusStore((s) => s.status)
  const setDuration = useFocusStore((s) => s.setDuration)

  // setDuration ignores calls while a session runs; mirror that in the UI so
  // the chips never look clickable when they would be a no-op.
  const locked = status === 'running' || status === 'paused'

  return (
    <div className="duration-picker">
      <span className="duration-picker__label">专注时长</span>
      <div className="duration-picker__chips">
        {DURATION_PRESETS.map((min) => (
          <button
            key={min}
            type="button"
            className={`duration-picker__chip${
              min === durationMin ? ' is-selected' : ''
            }`}
            onClick={() => setDuration(min)}
            disabled={locked}
            aria-pressed={min === durationMin}
            aria-label={`专注时长 ${min} 分钟${
              locked ? '（会话进行中，已锁定）' : ''
            }`}
          >
            {min} 分钟
          </button>
        ))}
      </div>
    </div>
  )
}
