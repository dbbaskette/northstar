import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeState {
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    { name: 'northstar-theme' },
  ),
)

export function resolvedTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyTheme(pref: ThemePreference) {
  const theme = resolvedTheme(pref)
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
