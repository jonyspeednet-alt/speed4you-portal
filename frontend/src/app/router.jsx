import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { RouteErrorBoundary } from '../components/feedback/ErrorBoundary.jsx';
import MainSiteLayout from '../layouts/MainSiteLayout';
import AdminLayout from '../layouts/AdminLayout';

const HomePage = lazy(() => import('../pages/HomePage'));
const BrowsePage = lazy(() => import('../pages/BrowsePage'));
const MovieDetailsPage = lazy(() => import('../pages/MovieDetailsPage'));
const SeriesDetailsPage = lazy(() => import('../pages/SeriesDetailsPage'));
const WatchlistPage = lazy(() => import('../pages/WatchlistPage'));
const PlayerPage = lazy(() => import('../pages/PlayerPage'));
const TVPage = lazy(() => import('../pages/TVPage'));
const AccessPage = lazy(() => import('../pages/AccessPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AddContentPage = lazy(() => import('../pages/admin/AddContentPage'));
const ContentLibraryPage = lazy(() => import('../pages/admin/ContentLibraryPage'));

const basename = import.meta.env.VITE_ROUTER_BASENAME || '/';
const fallbackStyles = {
  minHeight: '40vh',
  display: 'grid',
  placeItems: 'center',
  color: 'rgba(255,255,255,0.72)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

function withRouteFallback(element) {
  return (
    <Suspense fallback={<div style={fallbackStyles}>Loading...</div>}>
      {element}
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainSiteLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: withRouteFallback(<HomePage />),
      },
      {
        path: 'browse',
        element: withRouteFallback(<BrowsePage />),
      },
      {
        path: 'movies',
        element: withRouteFallback(<BrowsePage type="movie" />),
      },
      {
        path: 'series',
        element: withRouteFallback(<BrowsePage type="series" />),
      },
      {
        path: 'search',
        element: <Navigate to="/browse" replace />,
      },
      {
        path: 'movies/:slug',
        element: withRouteFallback(<MovieDetailsPage />),
      },
      {
        path: 'series/:slug',
        element: withRouteFallback(<SeriesDetailsPage />),
      },
      {
        path: 'watchlist',
        element: withRouteFallback(<WatchlistPage />),
      },
      {
        path: 'watch/:contentId',
        element: withRouteFallback(<PlayerPage />),
      },
      {
        path: 'tv',
        element: withRouteFallback(<TVPage />),
      },
      {
        path: 'access',
        element: withRouteFallback(<AccessPage />),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: withRouteFallback(<AdminDashboard />),
      },
      {
        path: 'content',
        element: withRouteFallback(<ContentLibraryPage />),
      },
      {
        path: 'content/new',
        element: withRouteFallback(<AddContentPage />),
      },
      {
        path: 'content/:id/edit',
        element: withRouteFallback(<AddContentPage />),
      },
      {
        path: 'movies',
        element: withRouteFallback(<ContentLibraryPage />),
      },
      {
        path: 'series',
        element: withRouteFallback(<ContentLibraryPage />),
      },
      {
        path: '*',
        element: <Navigate to="/admin" replace />,
      },
    ],
  },
  {
    path: '/login',
    element: withRouteFallback(<LoginPage />),
  },
], {
  basename,
});

function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
