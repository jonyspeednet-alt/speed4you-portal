import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const envDir = dirname(fileURLToPath(import.meta.url))
  const env = loadEnv(mode, envDir, '')

  return {
    base: env.VITE_APP_BASE || '/',
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-router')) {
                return 'router-vendor'
              }

              if (id.includes('react')) {
                return 'react-vendor'
              }

              return 'vendor'
            }
          },
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: 4173,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
  }
})
