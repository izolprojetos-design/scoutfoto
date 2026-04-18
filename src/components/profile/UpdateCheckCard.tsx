import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const APP_VERSION_KEY = 'scoutfoto_app_version';

const BUILD_TIME = import.meta.env.VITE_BUILD_TIME || '__dev__';

const formatBuildTime = (raw: string) => {
  if (raw === '__dev__') return 'Desenvolvimento';
  try {
    return format(new Date(raw), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return raw;
  }
};

const shortVersion = (raw: string) => {
  if (raw === '__dev__') return 'dev';
  // Compact: YYYYMMDD-HHMM from ISO
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return raw.slice(0, 16);
  return `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}`;
};

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

  const copyVersion = async () => {
    try {
      await navigator.clipboard.writeText(BUILD_TIME);
      toast.success('Versão copiada para a área de transferência');
    } catch {
      toast.error('Não foi possível copiar');
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
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Versão instalada</span>
                <button
                  onClick={copyVersion}
                  className="text-xs text-primary hover:underline"
                  type="button"
                >
                  Copiar
                </button>
              </div>
              <p className="font-mono text-sm font-semibold">{shortVersion(BUILD_TIME)}</p>
              <p className="text-xs text-muted-foreground">
                Publicada em {formatBuildTime(BUILD_TIME)}
              </p>
            </div>
          </div>
        </div>

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

