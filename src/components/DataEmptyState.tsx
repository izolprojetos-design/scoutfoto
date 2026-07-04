import { ShieldAlert, Inbox, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export type LoadState =
  | { kind: 'ok' }
  | { kind: 'empty' }
  | { kind: 'denied'; message?: string }
  | { kind: 'error'; message: string };

/**
 * Classifica um erro do PostgREST/Supabase como negação de permissão.
 * Códigos comuns: 42501 (insufficient_privilege), PGRST301 (JWT expired/invalid),
 * PGRST116 (row not found via RLS). Mensagens contendo "permission" / "policy" / "RLS".
 */
export function classifyLoadError(error: unknown, rowsReturned: number): LoadState {
  if (!error) {
    return rowsReturned === 0 ? { kind: 'empty' } : { kind: 'ok' };
  }
  const err = error as { code?: string; message?: string; status?: number };
  const code = (err.code ?? '').toString();
  const msg = (err.message ?? '').toLowerCase();
  const status = err.status ?? 0;

  const isDenied =
    status === 401 ||
    status === 403 ||
    code === '42501' ||
    code === 'PGRST301' ||
    code === 'PGRST116' ||
    msg.includes('permission') ||
    msg.includes('not authorized') ||
    msg.includes('rls') ||
    msg.includes('policy');

  if (isDenied) return { kind: 'denied', message: err.message };
  return { kind: 'error', message: err.message ?? 'Erro desconhecido' };
}

interface Props {
  state: LoadState;
  emptyTitle?: string;
  emptyDescription?: string;
  icon?: React.ReactNode;
}

export function DataEmptyState({ state, emptyTitle, emptyDescription, icon }: Props) {
  const navigate = useNavigate();

  if (state.kind === 'ok') return null;

  if (state.kind === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-amber-500/30 bg-amber-500/5">
        <ShieldAlert className="h-10 w-10 text-amber-500 mb-3" />
        <h3 className="text-lg font-bold mb-1">Sem permissão para ver estes dados</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          Os dados existem, mas seu perfil não tem autorização para lê-los. Peça a um administrador
          para liberar as permissões de visualização de integrantes/fotos.
        </p>
        {state.message && (
          <p className="text-[11px] text-muted-foreground/70 font-mono mb-4">{state.message}</p>
        )}
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
          Voltar ao Início
        </Button>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-destructive/30 bg-destructive/5">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <h3 className="text-lg font-bold mb-1">Falha ao carregar dados</h3>
        <p className="text-sm text-muted-foreground max-w-md">{state.message}</p>
      </div>
    );
  }

  // empty
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      {icon ?? <Inbox className="h-10 w-10 opacity-30 mb-2" />}
      <p className="font-medium">{emptyTitle ?? 'Nenhum registro encontrado'}</p>
      {emptyDescription && <p className="text-xs mt-1">{emptyDescription}</p>}
    </div>
  );
}
