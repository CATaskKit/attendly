import React, { type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import './index.css';
import { initNative } from './native';
import { AuthProvider, useAuth } from './lib/auth';
import Login from './employee/Login';
import EmployeeApp from './employee/EmployeeApp';

function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, authed } = useAuth();
  if (loading) return null;
  if (!authed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const router = createHashRouter([
  { path: '/', element: <Login /> },
  { path: '/app', element: <RequireAuth><EmployeeApp /></RequireAuth> },
]);

void initNative();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
