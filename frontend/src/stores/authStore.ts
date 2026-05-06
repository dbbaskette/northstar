import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import axios from 'axios'

interface AuthUser {
  id: string
  email: string
  username: string
  displayName: string
  role: string
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
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
  setAuth: (token: string, user: AuthUser | null) => void
  // Used by the SSO callback flow: hash-borne access + refresh tokens,
  // fetch the user record fresh, mark authenticated.
  hydrateFromTokens: (accessToken: string, refreshToken?: string) => Promise<void>
}

// Persisted via localStorage so a page refresh keeps the session alive.
// Access tokens are short-lived (~15min) — when an API call gets a 401
// the axios interceptor in api/client.ts uses the refresh token to mint
// a new access token without bouncing the user to /login.
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) =>
        set({ accessToken: token, user, isAuthenticated: !!user }),

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
            refreshToken: res.data.refresh_token,
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
          refreshToken: res.data.refresh_token,
          user: res.data.user,
          isAuthenticated: true,
        })
      },

      refresh: async () => {
        const refreshToken = get().refreshToken
        if (!refreshToken) {
          throw new Error('no refresh token')
        }
        const res = await axios.post('/api/v1/auth/refresh', {
          refresh_token: refreshToken,
        })
        set({ accessToken: res.data.access_token })
      },

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),

      hydrateFromTokens: async (accessToken, refreshToken) => {
        const res = await axios.get('/api/v1/users/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        set({
          accessToken,
          refreshToken: refreshToken ?? get().refreshToken,
          user: res.data,
          isAuthenticated: true,
        })
      },
    }),
    {
      name: 'northstar-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
