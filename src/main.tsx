import React, { type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import './index.css';
import { initNative } from './native';
import { AuthProvider, useAuth, type Role } from './lib/auth';
import Login from './employee/Login';
import EmployeeApp from './employee/EmployeeApp';
import AdminApp from './admin/AdminApp';

function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, authed } = useAuth();
  if (loading) return null;
  if (!authed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { loading, authed, role } = useAuth();
  if (loading) return null;
  if (!authed) return <Navigate to="/" replace />;
  if (!roles.includes(role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

const router = createHashRouter([
  { path: '/', element: <Login /> },
  { path: '/app', element: <RequireAuth><EmployeeApp /></RequireAuth> },
  { path: '/admin', element: <RequireRole roles={['owner', 'hr', 'manager']}><AdminApp /></RequireRole> },
]);

void initNative();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
