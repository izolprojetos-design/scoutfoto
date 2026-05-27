import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';
import MFAVerify from '@/components/MFAVerify';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requiredRole?: 'admin' | 'viewer' | 'voluntario' | 'dirigente_gestor';
  requiredPermission?: PermissionKey;
}

const ProtectedRoute = ({ children, requiredRole, requiredPermission }: ProtectedRouteProps) => {
  const { user, loading, hasRole, mfaRequired, mfaVerified, setMfaVerified } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();

  if (loading || permLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // MFA challenge required
  if (mfaRequired && !mfaVerified) {
    return <MFAVerify onVerified={() => setMfaVerified(true)} />;
  }

  if (requiredRole && !hasRole(requiredRole) && !hasRole('admin')) {
    const currentPath = window.location.pathname;
    if (currentPath !== '/profile') {
      console.warn(`Access denied: missing role ${requiredRole}. Redirecting to profile.`);
      return <Navigate to="/profile" replace />;
    }
  }

  if (requiredPermission && !hasPermission(requiredPermission) && !hasRole('admin')) {
    const currentPath = window.location.pathname;
    if (currentPath !== '/profile') {
      console.warn(`Access denied: missing permission ${requiredPermission}. Redirecting to profile.`);
      return <Navigate to="/profile" replace />;
    }
  }

  return <>{children ?? <Outlet />}</>;
};

export default ProtectedRoute;
