import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const APP_VERSION_KEY = 'scoutfoto_app_version';

const clearCachesAndReload = async () => {
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    localStorage.removeItem(APP_VERSION_KEY);
  } catch {
    // ignore
  }
  window.location.reload();
};

const UpdateCheckCard = () => {
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch('/?_t=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!res.ok) throw new Error('fetch failed');

      const html = await res.text();
      const currentScript = document.querySelector(
        'script[type="module"][src^="/src/"], script[type="module"][src^="/assets/"]'
      );
      const currentSrc = currentScript?.getAttribute('src') || '';
      const isOutdated = currentSrc && !html.includes(currentSrc);

      if (isOutdated) {
        toast.info('Nova versão disponível', {
          id: 'app-update-available',
          description: 'Clique em "Atualizar agora" para aplicar.',
          duration: Infinity,
          action: {
            label: 'Atualizar agora',
            onClick: () => clearCachesAndReload(),
          },
        });
      } else {
        toast.success('Você já está na versão mais recente.');
      }
    } catch {
      toast.error('Não foi possível verificar atualizações. Tente novamente.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="h-4 w-4" />
          Atualizações do app
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          O ScoutFoto verifica novas versões automaticamente. Use o botão abaixo
          para forçar uma verificação manual agora.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleCheck}
            disabled={checking}
            variant="outline"
            className="gap-2"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Verificar atualizações
          </Button>
          <Button
            onClick={clearCachesAndReload}
            variant="ghost"
            className="gap-2"
          >
            Limpar cache e recarregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UpdateCheckCard;
