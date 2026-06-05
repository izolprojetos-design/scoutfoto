import { Navigate, Outlet, useLocation } from 'react-router-dom';
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
  const { user, loading: authLoading, roles, hasRole, mfaRequired, mfaVerified, setMfaVerified } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();
  const { pathname, search } = useLocation();

  const loading = authLoading || permLoading;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    if (pathname === '/login') return <>{children ?? <Outlet />}</>;
    return <Navigate to="/login" replace />;
  }

  // MFA challenge required
  if (mfaRequired && !mfaVerified) {
    return <MFAVerify onVerified={() => setMfaVerified(true)} />;
  }

  // Destino padrão seguro
  const defaultSafeRoute = '/dashboard';

  // Se o usuário está no Dashboard ou Perfil, ele está em um lugar "seguro"
  // Adicionada "/" como safe path para que a Index possa gerenciar o redirecionamento sem bloqueios de RLS aqui
  const isSafePath = pathname === '/dashboard' || pathname === '/profile' || pathname === '/';

  if (!isSafePath && requiredRole && !hasRole(requiredRole) && !hasRole('admin')) {
    const msg = `[ProtectedRoute] Acesso negado a "${pathname}": falta o papel "${requiredRole}".`;
    console.warn(msg);
    
    // Evita loop: se a rota que falhou já era o destino padrão, para tudo
    if (pathname === defaultSafeRoute) return <>{children ?? <Outlet />}</>;

    localStorage.removeItem('last_accessed_route');
    return <Navigate to={defaultSafeRoute} replace />;
  }

  if (!isSafePath && requiredPermission && !hasPermission(requiredPermission) && !hasRole('admin')) {
    const msg = `[ProtectedRoute] Acesso negado a "${pathname}": falta a permissão "${requiredPermission}".`;
    console.warn(msg);
    
    if (pathname === defaultSafeRoute) return <>{children ?? <Outlet />}</>;

    localStorage.removeItem('last_accessed_route');
    return <Navigate to={defaultSafeRoute} replace />;
  }

  return <>{children ?? <Outlet />}</>;
};

export default ProtectedRoute;
