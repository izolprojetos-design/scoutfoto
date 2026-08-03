import { useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw, CheckCircle2, DownloadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const clearCachesAndReload = async () => {
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    localStorage.removeItem('scoutfoto_app_version');
  } catch {
    // ignore
  }
  window.location.reload();
};

const DataFreshnessIndicator = () => {
  const isFetching = useIsFetching();
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const queryClient = useQueryClient();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleRefresh = () => {
    queryClient.invalidateQueries();
    toast.info("Atualizando todos os dados…", { id: "refresh-all", duration: 2000 });
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
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
      toast.error('Não foi possível verificar atualizações.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  if (isFetching > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Atualizando dados…</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!isOnline) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-amber-500">
            <CloudOff className="h-3.5 w-3.5" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Offline — dados do cache local</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Dados atualizados</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleRefresh}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Forçar atualização</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {checkingUpdate ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <DownloadCloud className="h-3.5 w-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Verificar atualizações</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default DataFreshnessIndicator;
