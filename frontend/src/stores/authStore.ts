import { create } from 'zustand'
import axios from 'axios'

interface AuthState {
  accessToken: string | null
  user: { id: string; email: string; username: string; displayName: string; role: string } | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string, displayName: string) => Promise<void>
  refresh: () => Promise<void>
  logout: () => void
  setAuth: (token: string, user: AuthState['user']) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token, user) => set({ accessToken: token, user, isAuthenticated: true }),

  login: async (email, password) => {
    const res = await axios.post('/api/v1/auth/login', { email, password })
    set({
      accessToken: res.data.access_token,
      user: res.data.user,
      isAuthenticated: true,
    })
  },

  register: async (email, username, password, displayName) => {
    const res = await axios.post('/api/v1/auth/register', {
      email,
      username,
      password,
      display_name: displayName,
    })
    set({
      accessToken: res.data.access_token,
      user: res.data.user,
      isAuthenticated: true,
    })
  },

  refresh: async () => {
    const res = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
    set({ accessToken: res.data.access_token })
  },

  logout: () => set({ accessToken: null, user: null, isAuthenticated: false }),
}))
