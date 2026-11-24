import { create } from 'zustand'

export type Shot = { blob: Blob; mirrored: boolean; clip: Blob[] }

interface BoothState {
  shots: (Shot | null)[]
  layoutId: string
  themeId: string
  setShot: (index: number, shot: Shot) => void
  setLayout: (id: string) => void
  setTheme: (id: string) => void
  reset: () => void
  saveMirrored: boolean
  setSaveMirrored: (v: boolean) => void
}

export const SHOT_COUNT = 4

export const useBooth = create<BoothState>()((set) => ({
  shots: Array(SHOT_COUNT).fill(null),
  layoutId: 'strip-1x4',
  themeId: 'pink',
  setShot: (index, shot) =>
    set((s) => {
      const shots = [...s.shots]
      shots[index] = shot
      return { shots }
    }),
  setLayout: (layoutId) => set({ layoutId }),
  setTheme: (themeId) => set({ themeId }),
  reset: () => set({ shots: Array(SHOT_COUNT).fill(null) }),
  saveMirrored: true,
  setSaveMirrored: (saveMirrored) => set({ saveMirrored }),
}))