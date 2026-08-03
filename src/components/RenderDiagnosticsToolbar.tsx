import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bug, Download, Eye, EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { clearRenderLog, exportRenderLog } from '@/lib/useRenderDiagnostics';

/**
 * Floating toolbar to toggle render debug + "no effects" mode without
 * needing to open the browser console. Visible only when either flag is on
 * OR when URL has `?debug=1`. To first enable, open with `?debug=1`.
 */
export default function RenderDiagnosticsToolbar() {
  const [debugOn, setDebugOn] = useState(false);
  const [noFx, setNoFx] = useState<'0' | '1' | 'auto'>('0');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const forceShow = url.searchParams.get('debug') === '1';
    const d = localStorage.getItem('debug:renders') === '1';
    const n = (localStorage.getItem('ui:no-effects') as '0' | '1' | 'auto' | null) ?? '0';
    setDebugOn(d);
    setNoFx(n);
    setVisible(forceShow || d || n === '1' || n === 'auto');

    const sync = () => {
      setNoFx((localStorage.getItem('ui:no-effects') as '0' | '1' | 'auto' | null) ?? '0');
      setVisible(true);
    };
    window.addEventListener('ui:no-effects-changed', sync);
    return () => window.removeEventListener('ui:no-effects-changed', sync);
  }, []);

  if (!visible) return null;

  const toggleDebug = () => {
    const next = !debugOn;
    localStorage.setItem('debug:renders', next ? '1' : '0');
    toast.message(next ? 'Debug de renders ativado — recarregando…' : 'Debug de renders desativado — recarregando…');
    setTimeout(() => window.location.reload(), 400);
  };

  const toggleNoFx = () => {
    const next = noFx === '1' || noFx === 'auto' ? '0' : '1';
    localStorage.setItem('ui:no-effects', next);
    setNoFx(next as '0' | '1');
    window.dispatchEvent(new Event('ui:no-effects-changed'));
    toast.success(next === '1' ? 'Modo sem efeitos ativado' : 'Efeitos restaurados');
  };

  const handleExport = () => {
    exportRenderLog();
    toast.success('Log exportado como .txt');
  };

  const handleClear = () => {
    clearRenderLog();
    toast.success('Log limpo');
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-1 rounded-lg border bg-background/95 p-1.5 shadow-lg backdrop-blur-sm">
      <Button
        size="sm"
        variant={debugOn ? 'default' : 'outline'}
        onClick={toggleDebug}
        className="h-8 gap-1.5 text-xs"
        title="Ativa/desativa logs [render] no console e captura para exportação"
      >
        <Bug className="h-3.5 w-3.5" />
        {debugOn ? 'Debug ON' : 'Debug OFF'}
      </Button>
      <Button
        size="sm"
        variant={noFx === '0' ? 'outline' : 'default'}
        onClick={toggleNoFx}
        className="h-8 gap-1.5 text-xs"
        title="Remove animações/transições para evitar flicker"
      >
        {noFx === '0' ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        {noFx === 'auto' ? 'Sem FX (auto)' : noFx === '1' ? 'Sem FX' : 'Com FX'}
      </Button>
      {debugOn && (
        <>
          <Button size="sm" variant="outline" onClick={handleExport} className="h-8 gap-1.5 text-xs" title="Exportar log .txt">
            <Download className="h-3.5 w-3.5" />
            .txt
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClear} className="h-8 w-8 p-0" title="Limpar log">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}

/** Hook to read current "no effects" state in components, reactive to changes. */
export function useNoEffects(): boolean {
  const [v, setV] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const s = localStorage.getItem('ui:no-effects');
    return s === '1' || s === 'auto';
  });
  useEffect(() => {
    const sync = () => {
      const s = localStorage.getItem('ui:no-effects');
      setV(s === '1' || s === 'auto');
    };
    window.addEventListener('ui:no-effects-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('ui:no-effects-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return v;
}
