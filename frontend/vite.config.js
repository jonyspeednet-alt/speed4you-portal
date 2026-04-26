import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const envDir = dirname(fileURLToPath(import.meta.url))
  const env = loadEnv(mode, envDir, '')
  const isProd = mode === 'production'

  return {
    base: env.VITE_APP_BASE || '/',
    plugins: [
      react({
        // Faster JSX transform
        jsxRuntime: 'automatic',
      }),
    ],
    build: {
      // Target modern browsers for smaller bundles
      target: ['es2020', 'chrome80', 'firefox78', 'safari14'],
      // Reduce chunk size warning limit for better performance
      chunkSizeWarningLimit: 400,
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Source maps only in dev
      sourcemap: !isProd,
      // Enable minification
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd,
        },
      },
      rollupOptions: {
        output: {
          // Better asset naming for cache busting
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined

            // React core — loaded first, cached longest
            if (id.includes('react-dom') || id.includes('react/')) {
              return 'react-vendor'
            }
            // Router
            if (id.includes('react-router')) {
              return 'router-vendor'
            }
            // TanStack Query
            if (id.includes('@tanstack')) {
              return 'query-vendor'
            }
            // Virtualization
            if (id.includes('react-window')) {
              return 'ui-vendor'
            }
            // Split large vendor chunks
            if (id.includes('node_modules')) {
              const module = id.split('node_modules/')[1].split('/')[0];
              if (module.startsWith('@')) {
                return `vendor-${module.split('/')[0]}`;
              }
              return `vendor-${module}`;
            }
            // Everything else
            return 'vendor'
          },
        },
      },
    },
    // Optimize deps pre-bundling
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
      ],
    },
    server: {
      host: '127.0.0.1',
      port: 4173,
      // Faster HMR
      hmr: { overlay: true },
      proxy: {
        '/portal-api': {
          target: `http://127.0.0.1:${env.BACKEND_PORT || 3001}`,
          rewrite: (path) => path.replace(/^\/portal-api/, ''),
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
  }
})
