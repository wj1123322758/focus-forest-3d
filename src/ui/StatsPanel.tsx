import { useFocusStore } from '../store/focusStore'

// Spec wants "x 小时 y 分", so report hours/minutes only (seconds are noise here).
function formatFocusTime(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec))
  const hours = Math.floor(safe / 3600)
  const mins = Math.floor((safe % 3600) / 60)
  return `${hours} 小时 ${mins} 分`
}

export default function StatsPanel() {
  const treesGrown = useFocusStore((s) => s.treesGrown)
  const totalElapsedSec = useFocusStore((s) => s.totalElapsedSec)
  const forestCount = useFocusStore((s) => s.forest.length)

  return (
    <section className="stats-card" aria-label="专注统计">
      <h2 className="stats-card__title">我的森林</h2>
      <ul className="stats-card__list">
        <li className="stats-card__row">
          <span className="stats-card__emoji" aria-hidden="true">
            🌳
          </span>
          <span className="stats-card__label">已种树木</span>
          <span className="stats-card__value">{treesGrown}</span>
        </li>
        <li className="stats-card__row">
          <span className="stats-card__emoji" aria-hidden="true">
            ⏱
          </span>
          <span className="stats-card__label">累计专注</span>
          <span className="stats-card__value stats-card__value--text">
            {formatFocusTime(totalElapsedSec)}
          </span>
        </li>
        <li className="stats-card__row">
          <span className="stats-card__emoji" aria-hidden="true">
            ✅
          </span>
          <span className="stats-card__label">完成次数</span>
          <span className="stats-card__value">{forestCount}</span>
        </li>
      </ul>
    </section>
  )
}
