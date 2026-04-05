import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

// Adjuntar token en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Manejar 401 globalmente (excluir el login para no recargar la página al fallar)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const esLoginEndpoint = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !esLoginEndpoint) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
