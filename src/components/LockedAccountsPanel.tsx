import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Unlock, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LockedRow {
  email: string;
  failed_count: number;
  last_failed_at: string;
  locked_until: string | null;
  is_locked: boolean;
}

const LockedAccountsPanel = () => {
  const [rows, setRows] = useState<LockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_locked_logins');
    if (error) {
      toast.error('Erro ao carregar contas bloqueadas');
      setRows([]);
    } else {
      setRows((data as LockedRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const unlock = async (email: string) => {
    setUnlocking(email);
    const { error } = await supabase.rpc('admin_unlock_login', { p_email: email });
    if (error) {
      toast.error('Erro ao desbloquear: ' + error.message);
    } else {
      toast.success(`Conta ${email} desbloqueada`);
      await load();
    }
    setUnlocking(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Contas com tentativas falhadas
          </CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Contas são bloqueadas automaticamente por 15 minutos após 5 tentativas falhadas. Você pode desbloquear manualmente abaixo.
        </p>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma conta com tentativas falhadas no momento.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Última tentativa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.email}>
                    <TableCell className="font-medium">{r.email}</TableCell>
                    <TableCell>{r.failed_count}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(r.last_failed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {r.is_locked && r.locked_until ? (
                        <Badge variant="destructive">
                          Bloqueada até {format(new Date(r.locked_until), "HH:mm", { locale: ptBR })}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Liberada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => unlock(r.email)}
                        disabled={unlocking === r.email}
                        className="gap-2"
                      >
                        {unlocking === r.email ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5" />
                        )}
                        Desbloquear
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LockedAccountsPanel;
