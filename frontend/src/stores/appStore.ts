import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  activeTeamId: string | null
  setActiveTeam: (id: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTeamId: null,
      setActiveTeam: (id) => set({ activeTeamId: id }),
    }),
    {
      name: 'northstar-app',
    },
  ),
)
