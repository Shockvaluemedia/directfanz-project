'use client';

import { useRoleAuth } from '@/hooks/use-role-auth';
import { UserRole } from '@/types/database';
import { ReactNode } from 'react';

interface RoleGuardProps {
  children: ReactNode;
  requiredRole?: UserRole;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
}

// Component to protect content based on user role
export function RoleGuard({
  children,
  requiredRole,
  fallback = null,
  loadingComponent = <div>Loading...</div>,
}: RoleGuardProps) {
  const { isLoading, isAuthenticated, hasRequiredRole } = useRoleAuth(requiredRole);

  if (isLoading) {
    return <>{loadingComponent}</>;
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  if (requiredRole && !hasRequiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Specific role guard components
export function ArtistGuard({
  children,
  fallback = null,
  loadingComponent = <div>Loading...</div>,
}: Omit<RoleGuardProps, 'requiredRole'>) {
  return (
    <RoleGuard
      requiredRole={UserRole.ARTIST}
      fallback={fallback}
      loadingComponent={loadingComponent}
    >
      {children}
    </RoleGuard>
  );
}

export function FanGuard({
  children,
  fallback = null,
  loadingComponent = <div>Loading...</div>,
}: Omit<RoleGuardProps, 'requiredRole'>) {
  return (
    <RoleGuard requiredRole={UserRole.FAN} fallback={fallback} loadingComponent={loadingComponent}>
      {children}
    </RoleGuard>
  );
}

// Authentication guard (any authenticated user)
export function AuthGuard({
  children,
  fallback = null,
  loadingComponent = <div>Loading...</div>,
}: Omit<RoleGuardProps, 'requiredRole'>) {
  return (
    <RoleGuard fallback={fallback} loadingComponent={loadingComponent}>
      {children}
    </RoleGuard>
  );
}

// Conditional rendering components
interface ConditionalRenderProps {
  children: ReactNode;
}

export function ShowForArtist({ children }: ConditionalRenderProps) {
  const { isArtist, isLoading } = useRoleAuth();

  if (isLoading || !isArtist) return null;
  return <>{children}</>;
}

export function ShowForFan({ children }: ConditionalRenderProps) {
  const { isFan, isLoading } = useRoleAuth();

  if (isLoading || !isFan) return null;
  return <>{children}</>;
}

export function ShowForAuthenticated({ children }: ConditionalRenderProps) {
  const { isAuthenticated, isLoading } = useRoleAuth();

  if (isLoading || !isAuthenticated) return null;
  return <>{children}</>;
}
