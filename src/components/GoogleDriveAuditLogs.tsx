import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, AlertCircle } from 'lucide-react';

interface AuditLog {
  id: string;
  created_at: string;
  user_id: string;
  action: string;
  details: {
    reason: string;
    url: string;
    type: string;
    event_id?: string;
    requested_label?: string;
  };
  profiles?: {
    name: string;
  };
}

export const GoogleDriveAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      // Fetch audit logs that are access_denied and related to drive
      const { data } = await supabase
        .from('audit_logs')
        .select('*, profiles(name)')
        .eq('action', 'access_denied')
        .order('created_at', { ascending: false });

      const driveLogs = (data as any[] || []).filter(log => 
        log.details?.reason === 'type_blocked' || 
        log.details?.reason === 'global_drive_disabled' ||
        log.details?.reason === 'missing_google_drive_links_permission'
      );
      
      setLogs(driveLogs);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Tentativas Bloqueadas
        </CardTitle>
        <CardDescription>Visualização de tentativas de inclusão de links negadas pelo sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Evento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length > 0 ? logs.map(log => (
              <TableRow key={log.id}>
                <TableCell className="text-xs">
                  {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                </TableCell>
                <TableCell>{log.profiles?.name || 'Desconhecido'}</TableCell>
                <TableCell>
                  <Badge variant="outline">{log.details.requested_label || log.details.type}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {log.details.reason === 'global_drive_disabled' ? 'Drive Global Desativado' : 'Tipo Bloqueado'}
                </TableCell>
                <TableCell className="text-xs">
                  {log.details.event_id || 'N/A'}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Nenhuma tentativa bloqueada registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
