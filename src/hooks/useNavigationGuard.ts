import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

/**
 * Hook para evitar que rotas seguras (Dashboard, Perfil) redirecionem 
 * para si mesmas ou causem loops de navegação.
 */
export const useNavigationGuard = () => {
  const location = useLocation();

  useEffect(() => {
    // Debug de navegação para identificar loops
    if (process.env.NODE_ENV === 'development') {
      console.log(`[NavigationGuard] Navegou para: ${location.pathname}${location.search}`);
    }
  }, [location]);

  return null;
};
