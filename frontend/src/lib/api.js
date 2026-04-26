import axios from 'axios'

// En producción (Vercel) usamos el proxy /backend/* → el browser nunca hace
// cross-origin y el error "No CORS header" desaparece por completo.
// En local dev se usa VITE_API_URL (Railway directo) o localhost.
const BASE_URL = import.meta.env.PROD
  ? '/backend'
  : (import.meta.env.VITE_API_URL || 'http://localhost:8000')

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
})

// Adjuntar access token en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Cola de requests que esperan el refresh
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
  failedQueue = []
}

const limpiarSesionYRedirigir = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('usuario')
  localStorage.removeItem('modo_sesion')
  window.location.href = '/login'
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const url = original?.url || ''

    // No intentar refresh en estos endpoints para evitar bucles
    const esEndpointAuth = url.includes('/auth/login') || url.includes('/auth/refresh')

    if (error.response?.status === 401 && !esEndpointAuth && !original._retry) {
      const refreshToken = localStorage.getItem('refresh_token')

      if (!refreshToken) {
        limpiarSesionYRedirigir()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Encolar el request original hasta que el refresh termine
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refresh_token: refreshToken },
        )
        const { access_token, refresh_token: nuevo_refresh } = data
        localStorage.setItem('token', access_token)
        if (nuevo_refresh) localStorage.setItem('refresh_token', nuevo_refresh)
        api.defaults.headers.common.Authorization = `Bearer ${access_token}`
        processQueue(null, access_token)
        original.headers.Authorization = `Bearer ${access_token}`
        return api(original)
      } catch (refreshError) {
        processQueue(refreshError, null)
        limpiarSesionYRedirigir()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default api
