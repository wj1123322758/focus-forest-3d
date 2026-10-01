import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'dead'

export interface ForestTree {
  id: string
  plantedAt: number
  durationMin: number
}

export interface FocusState {
  status: SessionStatus
  durationMin: number
  elapsedSec: number
  totalElapsedSec: number
  treesGrown: number
  forest: ForestTree[]
  progress: number
  remainingSec: number
  start: (durationMin?: number) => void
  pause: () => void
  resume: () => void
  giveUp: () => void
  reset: () => void
  tick: (dtSec: number) => void
  setDuration: (min: number) => void
}

export const DURATION_PRESETS = [15, 25, 45, 60]

const MINUTE = 60
const FOREST_CAP = 60

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

const newTreeId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const derive = (elapsedSec: number, durationMin: number) => {
  const total = durationMin * MINUTE
  return {
    progress: total > 0 ? clamp01(elapsedSec / total) : 0,
    remainingSec: Math.max(0, Math.ceil(total - elapsedSec)),
  }
}

const isSessionActive = (s: FocusState): boolean =>
  s.status === 'running' || s.status === 'paused'

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      durationMin: 25,
      elapsedSec: 0,
      totalElapsedSec: 0,
      treesGrown: 0,
      forest: [],
      progress: 0,
      remainingSec: 25 * MINUTE,

      start: (durationMin) => {
        const dur = durationMin ?? get().durationMin
        set({
          status: 'running',
          durationMin: dur,
          elapsedSec: 0,
          ...derive(0, dur),
        })
      },

      pause: () => {
        if (get().status === 'running') set({ status: 'paused' })
      },

      resume: () => {
        if (get().status === 'paused') set({ status: 'running' })
      },

      giveUp: () => {
        if (isSessionActive(get())) set({ status: 'dead' })
      },

      reset: () => {
        set({ status: 'idle', elapsedSec: 0, ...derive(0, get().durationMin) })
      },

      tick: (dtSec) => {
        const s = get()
        if (s.status !== 'running' || dtSec <= 0) return
        const elapsedSec = s.elapsedSec + dtSec
        const total = s.durationMin * MINUTE
        if (elapsedSec >= total) {
          const tree: ForestTree = {
            id: newTreeId(),
            plantedAt: Date.now(),
            durationMin: s.durationMin,
          }
          set({
            status: 'completed',
            elapsedSec: total,
            progress: 1,
            remainingSec: 0,
            treesGrown: s.treesGrown + 1,
            totalElapsedSec: s.totalElapsedSec + total,
            forest: [...s.forest, tree].slice(-FOREST_CAP),
          })
        } else {
          set({ elapsedSec, ...derive(elapsedSec, s.durationMin) })
        }
      },

      setDuration: (min) => {
        if (isSessionActive(get()) || min <= 0) return
        set({ durationMin: min, elapsedSec: 0, ...derive(0, min) })
      },
    }),
    {
      name: 'focus-forest-3d',
      version: 1,
      partialize: ({ forest, treesGrown, totalElapsedSec, durationMin }) => ({
        forest,
        treesGrown,
        totalElapsedSec,
        durationMin,
      }),
    },
  ),
)
