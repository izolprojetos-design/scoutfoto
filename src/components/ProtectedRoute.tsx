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
    const isMainRoute = currentPath === '/' || currentPath === '/dashboard';
    
    // Se for rota principal e falhar, tentamos o próximo lugar seguro antes do perfil
    if (currentPath !== '/profile') {
      const msg = `[ProtectedRoute] Acesso negado a "${currentPath}": falta o papel "${requiredRole}". Papéis: [${roles.join(', ')}].`;
      console.warn(msg);
      window.dispatchEvent(new CustomEvent('route-redirect', { detail: { message: msg, type: 'warn' } }));
      
      if (isMainRoute && hasPermission('view_scouts')) {
        return <Navigate to="/scouts" replace />;
      }
      return <Navigate to="/profile" replace />;
    }
  }

  if (requiredPermission && !hasPermission(requiredPermission) && !hasRole('admin')) {
    const currentPath = window.location.pathname;
    const isMainRoute = currentPath === '/' || currentPath === '/dashboard';

    if (currentPath !== '/profile') {
      const msg = `[ProtectedRoute] Acesso negado a "${currentPath}": falta a permissão "${requiredPermission}".`;
      console.warn(msg);
      window.dispatchEvent(new CustomEvent('route-redirect', { detail: { message: msg, type: 'warn' } }));
      
      if (isMainRoute && hasPermission('view_scouts')) {
        return <Navigate to="/scouts" replace />;
      }
      return <Navigate to="/profile" replace />;
    }
  }

  return <>{children ?? <Outlet />}</>;
};

export default ProtectedRoute;
