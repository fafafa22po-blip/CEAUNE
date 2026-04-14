import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 500,
    },
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  build: {
    // Subir límite a 1 MB para que no aparezcan warnings en chunks legítimamente grandes
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // Función en lugar de objeto para no fallar si algún paquete no está presente
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // React core — cambia poco, se cachea bien en el navegador
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) {
            return 'vendor-react'
          }
          // QR scanner WASM — el más pesado, va en su propio chunk
          if (id.includes('/qr-scanner/')) {
            return 'vendor-qrscanner'
          }
          // Capacitor bridge y plugins — solo se activan en APK nativa
          if (id.includes('@capacitor/') || id.includes('@capacitor-mlkit/')) {
            return 'vendor-capacitor'
          }
          // Utilidades
          if (
            id.includes('/axios/') ||
            id.includes('/date-fns/') ||
            id.includes('/react-hot-toast/') ||
            id.includes('@tanstack/')
          ) {
            return 'vendor-utils'
          }
        },
      },
    },
  },
})
