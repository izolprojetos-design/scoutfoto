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
  const { user, loading, roles, hasRole, mfaRequired, mfaVerified, setMfaVerified } = useAuth();
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
      const msg = `[ProtectedRoute] Acesso negado a "${currentPath}": falta o papel "${requiredRole}". Papéis: [${roles.join(', ')}]. Redirecionando para /profile.`;
      console.warn(msg);
      window.dispatchEvent(new CustomEvent('route-redirect', { detail: { message: msg, type: 'warn' } }));
      return <Navigate to="/profile" replace />;
    }
  }

  if (requiredPermission && !hasPermission(requiredPermission) && !hasRole('admin')) {
    // Basic fallback logic: if they fail a specific permission check, 
    // we should only redirect if it's a critical mismatch.
    // However, if the user manually navigates to a module they should see (e.g. via sidebar), 
    // the sidebar already handles the 'show' logic.
    const currentPath = window.location.pathname;

    if (currentPath !== '/profile') {
      const msg = `[ProtectedRoute] Acesso negado a "${currentPath}": falta a permissão "${requiredPermission}". Redirecionando para /profile.`;
      console.warn(msg);
      window.dispatchEvent(new CustomEvent('route-redirect', { detail: { message: msg, type: 'warn' } }));
      return <Navigate to="/profile" replace />;
    }
  }

  return <>{children ?? <Outlet />}</>;
};

export default ProtectedRoute;
