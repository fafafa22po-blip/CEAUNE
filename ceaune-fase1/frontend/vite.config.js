import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,   // necesario en Docker sobre Windows
      interval: 500,
    },
    proxy: {
      '/auth':         { target: 'http://backend:8000', changeOrigin: true },
      '/asistencia':   { target: 'http://backend:8000', changeOrigin: true },
      '/estudiantes':  { target: 'http://backend:8000', changeOrigin: true },
      '/apoderado':    { target: 'http://backend:8000', changeOrigin: true },
      '/comunicados':  { target: 'http://backend:8000', changeOrigin: true },
    },
  },
})
