import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'uploader' | 'viewer' | 'chefe' | 'dirigente';
  requiredPermission?: PermissionKey;
}

const ProtectedRoute = ({ children, requiredRole, requiredPermission }: ProtectedRouteProps) => {
  const { user, loading, hasRole } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();

  if (loading || permLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole && !hasRole(requiredRole) && !hasRole('admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission) && !hasRole('admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
