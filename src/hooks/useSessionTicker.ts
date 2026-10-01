import { useEffect } from 'react'
import { useFocusStore } from '../store/focusStore'

// Keeps the session clock moving while a focus session runs; background tabs
// throttle intervals, so each tick is derived from the real elapsed wall time.
const MAX_STEP_SEC = 5

export function useSessionTicker(): void {
  const status = useFocusStore((s) => s.status)
  const tick = useFocusStore((s) => s.tick)

  useEffect(() => {
    if (status !== 'running') return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      tick(Math.min(dt, MAX_STEP_SEC))
    }, 1000)
    return () => window.clearInterval(id)
  }, [status, tick])
}
