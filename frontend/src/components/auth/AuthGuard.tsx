import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { AppShellSkeleton } from '@/components/ui/skeletons';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isInitializing, checkAuth } = useAuthStore();
  const location = useLocation();
  const showSkeleton = useDelayedFlag(isInitializing);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isInitializing) {
    return showSkeleton ? <AppShellSkeleton /> : null;
  }

  if (!isAuthenticated) {
    // Save the attempted URL for redirecting after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export const GuestGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isInitializing, checkAuth } = useAuthStore();
  const showSkeleton = useDelayedFlag(isInitializing);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isInitializing) {
    return showSkeleton ? <AppShellSkeleton /> : null;
  }

  if (isAuthenticated) {
    return <Navigate to="/workspaces" replace />;
  }

  return <>{children}</>;
};
