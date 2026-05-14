import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      navigate(user ? '/dashboard' : '/login', { replace: true });
    }
  }, [user, loading, navigate]);

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
