import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ScoutHistoryProps {
  scoutId: string;
}

interface AuditEntry {
  id: string;
  action: string;
  created_at: string;
  details: any;
  before_data: any;
  after_data: any;
}

const ACTION_LABELS: Record<string, string> = {
  create_user: 'Cadastro',
  data_update: 'Atualização de dados',
  edit: 'Edição',
  upload: 'Upload de foto',
  delete: 'Remoção',
  status_change: 'Mudança de status',
  section_change: 'Mudança de seção',
  view: 'Visualização',
  download: 'Download',
};

const ScoutHistory = ({ scoutId }: ScoutHistoryProps) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Filter rows where details->>scout_id matches OR before/after has scout_id
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, created_at, details, before_data, after_data')
        .or(
          `details->>scout_id.eq.${scoutId},before_data->>scout_id.eq.${scoutId},after_data->>scout_id.eq.${scoutId},details->>id.eq.${scoutId}`,
        )
        .order('created_at', { ascending: false })
        .limit(100);

      if (!cancelled) {
        if (error) {
          console.warn('[ScoutHistory] error:', error.message);
          setEntries([]);
        } else {
          setEntries((data as AuditEntry[]) || []);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scoutId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <History className="mx-auto mb-2 h-6 w-6 opacity-60" />
        Nenhum registro de histórico encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const date = new Date(e.created_at);
        return (
          <div key={e.id} className="rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="font-normal text-xs">
                {ACTION_LABELS[e.action] || e.action}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {date.toLocaleDateString('pt-BR')}{' '}
                {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {e.details && Object.keys(e.details).length > 0 && (
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs whitespace-pre-wrap break-words">
                {JSON.stringify(e.details, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ScoutHistory;
