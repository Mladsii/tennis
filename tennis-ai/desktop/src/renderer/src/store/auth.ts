import { create } from 'zustand'
import { login as apiLogin } from '../api/auth'

interface AuthState {
  accessToken: string | null
  isLoading: boolean
  error: string | null
  init: () => void
  login: (phone: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  isLoading: false,
  error: null,

  init: () => {
    const token = localStorage.getItem('access_token')
    set({ accessToken: token })
  },

  login: async (phone, password) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await apiLogin(phone, password)
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      set({ accessToken: tokens.access_token, isLoading: false })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string }; status?: number }; message?: string; code?: string }
      const detail = axiosErr?.response?.data?.detail
      const status = axiosErr?.response?.status
      const code = axiosErr?.code
      const msg = axiosErr?.message

      let errorText = 'Ошибка входа. Проверьте телефон и пароль.'
      if (detail) {
        errorText = detail
      } else if (code === 'ERR_NETWORK' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        errorText = `Нет соединения с сервером (${code}). Проверьте сеть или брандмауэр.`
      } else if (code === 'ECONNABORTED') {
        errorText = 'Сервер не отвечает (таймаут). Попробуйте позже.'
      } else if (status) {
        errorText = `Ошибка сервера: ${status}`
      } else if (msg) {
        errorText = `Ошибка: ${msg}`
      }

      set({ error: errorText, isLoading: false })
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ accessToken: null })
  },
}))
