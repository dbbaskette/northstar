import { create } from 'zustand'
import axios from 'axios'

interface AuthState {
  accessToken: string | null
  user: { id: string; email: string; username: string; displayName: string; role: string } | null
  isAuthenticated: boolean
  login: (
    email: string,
    password: string,
    totpCode?: string,
  ) => Promise<void | { twoFactorRequired: true } | { pendingApproval: true }>
  register: (
    email: string,
    username: string,
    password: string,
    displayName: string,
  ) => Promise<void | { pendingApproval: true }>
  refresh: () => Promise<void>
  logout: () => void
  setAuth: (token: string, user: AuthState['user']) => void
  // Used by the SSO callback flow: hash-borne access token, fetch the
  // user record fresh, mark authenticated.
  hydrateFromAccessToken: (token: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token, user) => set({ accessToken: token, user, isAuthenticated: true }),

  login: async (email, password, totpCode) => {
    try {
      const res = await axios.post('/api/v1/auth/login', {
        email,
        password,
        totp_code: totpCode,
      })
      if (res.data.two_factor_required) {
        return { twoFactorRequired: true } as const
      }
      if (res.data.pending_approval) {
        return { pendingApproval: true } as const
      }
      set({
        accessToken: res.data.access_token,
        user: res.data.user,
        isAuthenticated: true,
      })
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { pending_approval?: boolean } } }
      if (e.response?.status === 403 && e.response.data?.pending_approval) {
        return { pendingApproval: true } as const
      }
      throw err
    }
  },

  register: async (email, username, password, displayName) => {
    const res = await axios.post('/api/v1/auth/register', {
      email,
      username,
      password,
      display_name: displayName,
    })
    if (res.data.pending_approval) {
      return { pendingApproval: true } as const
    }
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

  hydrateFromAccessToken: async (token) => {
    const res = await axios.get('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    set({
      accessToken: token,
      user: res.data,
      isAuthenticated: true,
    })
  },
}))
