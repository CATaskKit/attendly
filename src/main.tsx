import React, { Suspense, lazy, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import './index.css';
import { initNative } from './native';
import { AuthProvider, useAuth, type Role } from './lib/auth';
import { ErrorBoundary } from './lib/ErrorBoundary';
import Login from './employee/Login';
import EmployeeApp from './employee/EmployeeApp';
import NoWorkspace from './employee/NoWorkspace';

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

// Gate the app on having a session AND belonging to an org. `allowNoOrg` is for
// the /no-workspace screen itself, which is the one place an org-less account is
// meant to land. While the profile is still loading (null) we don't redirect —
// we only divert once we know the account has no org_id.
function RequireAuth({ children, allowNoOrg = false }: { children: ReactNode; allowNoOrg?: boolean }) {
  const { loading, authed, profile } = useAuth();
  if (loading) return null;
  if (!authed) return <Navigate to="/" replace />;
  if (!allowNoOrg && profile && !profile.org_id) return <Navigate to="/no-workspace" replace />;
  return <>{children}</>;
}

// `requireOrg` blocks org-less accounts (used for the admin console). Onboarding
// intentionally leaves it off, since that's where an org-less owner creates one.
function RequireRole({ roles, requireOrg = false, children }: { roles: Role[]; requireOrg?: boolean; children: ReactNode }) {
  const { loading, authed, role, profile } = useAuth();
  if (loading) return null;
  if (!authed) return <Navigate to="/" replace />;
  if (!roles.includes(role)) return <Navigate to="/app" replace />;
  if (requireOrg && profile && !profile.org_id) return <Navigate to="/no-workspace" replace />;
  return <>{children}</>;
}

const router = createHashRouter([
  { path: '/', element: <Login /> },
  { path: '/no-workspace', element: <RequireAuth allowNoOrg><NoWorkspace /></RequireAuth> },
  { path: '/app', element: <RequireAuth><EmployeeApp /></RequireAuth> },
  { path: '/admin', element: <RequireRole roles={['owner', 'hr', 'manager']} requireOrg><Suspense fallback={<RouteFallback />}><AdminApp /></Suspense></RequireRole> },
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
