import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.jsx'
import './styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

async function cleanupLegacyServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    const legacyRegistrations = registrations.filter((registration) => (
      registration.scope.includes('/portal') || registration.scope === `${window.location.origin}/`
    ))

    await Promise.all(legacyRegistrations.map((registration) => registration.unregister()))

    if ('caches' in window) {
      const cacheNames = await window.caches.keys()
      const legacyCacheNames = cacheNames.filter((name) => name.startsWith('isp-portal-'))
      await Promise.all(legacyCacheNames.map((name) => window.caches.delete(name)))
    }
  } catch (error) {
    console.warn('Failed to clean up legacy service worker cache', error)
  }
}

cleanupLegacyServiceWorkers()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
