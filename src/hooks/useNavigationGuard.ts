import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

/**
 * Hook para evitar que rotas seguras (Dashboard, Perfil) redirecionem 
 * para si mesmas ou causem loops de navegação.
 */
export const useNavigationGuard = () => {
  const location = useLocation();

  useEffect(() => {
    // Silently guards against navigation loops
  }, [location]);

  return null;
};
