import React, { Suspense, lazy, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import './index.css';
import { initNative } from './native';
import { AuthProvider, useAuth, type Role } from './lib/auth';
import { ErrorBoundary } from './lib/ErrorBoundary';
import Login from './employee/Login';
import EmployeeApp from './employee/EmployeeApp';

// Admin console + onboarding are a web-only, desktop surface — they're never
// reached on the mobile app. Code-split them so the (mobile) employee bundle
// doesn't carry the admin UI or its heavy deps (e.g. xlsx) at startup.
const AdminApp = lazy(() => import('./admin/AdminApp'));
const OnboardingApp = lazy(() => import('./onboarding/OnboardingApp'));

// Minimal full-screen fallback in the app's light theme colour, so a lazy
// chunk loading never flashes a blank/odd background.
function RouteFallback() {
  return <div style={{ height: '100vh', background: '#f4f6fa' }} />;
}

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
  { path: '/admin', element: <RequireRole roles={['owner', 'hr', 'manager']}><Suspense fallback={<RouteFallback />}><AdminApp /></Suspense></RequireRole> },
  { path: '/onboarding', element: <RequireRole roles={['owner', 'hr']}><Suspense fallback={<RouteFallback />}><OnboardingApp /></Suspense></RequireRole> },
]);

void initNative();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
