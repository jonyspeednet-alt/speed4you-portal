import { createBrowserRouter, Navigate } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AddContentPage from '../pages/admin/AddContentPage';
import ContentLibraryPage from '../pages/admin/ContentLibraryPage';

const adminRouter = createBrowserRouter([
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <AdminDashboard />,
      },
      {
        path: 'content',
        element: <ContentLibraryPage />,
      },
      {
        path: 'content/new',
        element: <AddContentPage />,
      },
      {
        path: 'content/:id/edit',
        element: <AddContentPage />,
      },
      {
        path: 'movies',
        element: <ContentLibraryPage />,
      },
      {
        path: 'series',
        element: <ContentLibraryPage />,
      },
      {
        path: 'users',
        element: <AdminDashboard />,
      },
      {
        path: '*',
        element: <Navigate to="/admin" replace />,
      },
    ],
  },
]);

export default adminRouter;
