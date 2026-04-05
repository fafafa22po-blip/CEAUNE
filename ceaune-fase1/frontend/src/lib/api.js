import axios from 'axios'

// En Docker: baseURL='' → Vite proxy redirige al backend
// Local sin Docker: VITE_API_URL=http://localhost:8000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ceaune_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ceaune_token')
      localStorage.removeItem('ceaune_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
