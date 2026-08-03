import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    // Só agimos quando o carregamento inicial de auth e permissões terminar
    if (!authLoading && !permLoading) {
      if (user) {
        // Tenta recuperar a última rota acessada
        const lastRoute = localStorage.getItem('last_accessed_route');
        
        // Validação extra: se a última rota for a própria Index ou login, evitamos o loop
        const targetRoute = lastRoute && lastRoute !== '/' && lastRoute !== '/login' ? lastRoute : '/dashboard';
        
        console.log(`[Index] Usuário autenticado, indo para ${targetRoute}`);
        
        // Use timeout to ensure any pending state updates are processed
        const timer = setTimeout(() => {
          navigate(targetRoute, { replace: true });
        }, 0);
        return () => clearTimeout(timer);
      } else {
        console.log("[Index] Usuário não autenticado, indo para /login");
        navigate('/login', { replace: true });
      }
    }
  }, [user, authLoading, permLoading, navigate]);

  return (
    <>
      <Helmet>
        <title>ScoutFoto — Banco de Imagens Escoteiro</title>
        <meta name="description" content="Plataforma do Grupo Escoteiro Monte Caburaí (12º GEMC) para organizar fotos, eventos e integrantes em um só lugar." />
        <link rel="canonical" href="https://scoutfoto.app/" />
      </Helmet>
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando ScoutFoto...</p>
        </div>
      </main>
    </>
  );
};

export default Index;
