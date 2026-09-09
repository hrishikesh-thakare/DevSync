import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

/**
 * Gate for routes that require a session. Assumes `AuthBootstrap` has already
 * resolved `isInitializing`, so it never renders a loading state of its own.
 *
 * The attempted location is stashed on navigation state so the login page can
 * return the user where they were headed.
 */
export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
