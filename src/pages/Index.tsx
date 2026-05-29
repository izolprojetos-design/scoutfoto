import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { canViewPhotos, canViewScouts, loading: permLoading } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !permLoading) {
      if (user) {
        // Redirecionamento baseado em permissões com log detalhado
        let destination = '/profile';
        let reason = 'Fallback padrão (sem permissões de visualização)';

        if (isAdmin || canViewPhotos) {
          destination = '/dashboard';
          reason = isAdmin ? 'Usuário é Administrador' : 'Usuário possui permissão canViewPhotos';
        } else if (canViewScouts) {
          destination = '/scouts';
          reason = 'Usuário possui permissão canViewScouts';
        }
        
        const msg = `[Index] Redirecionando para ${destination} - Motivo: ${reason}`;
        console.log(msg);
        window.dispatchEvent(new CustomEvent('route-redirect', { detail: { message: msg, type: 'info' } }));
        navigate(destination, { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [user, authLoading, permLoading, canViewPhotos, canViewScouts, isAdmin, navigate]);

  return (
    <>
      <Helmet>
        <title>ScoutFoto — Banco de Imagens Escoteiro</title>
        <meta name="description" content="Plataforma do Grupo Escoteiro Monte Caburaí (12º GEMC) para organizar fotos, eventos e integrantes em um só lugar." />
        <link rel="canonical" href="https://scoutfoto.app/" />
        <meta property="og:title" content="ScoutFoto — Banco de Imagens Escoteiro" />
        <meta property="og:description" content="Plataforma do Grupo Escoteiro Monte Caburaí (12º GEMC) para organizar fotos, eventos e integrantes em um só lugar." />
        <meta property="og:url" content="https://scoutfoto.app/" />
      </Helmet>
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    </>
  );
};

export default Index;
