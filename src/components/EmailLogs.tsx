import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, CheckCircle2, XCircle, Clock, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmailLog {
  id: string;
  recipient: string;
  template_name: string;
  status: 'sent' | 'failed' | 'delivered' | 'bounced';
  error_message: string | null;
  created_at: string;
}

const EmailLogs = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!error) {
        setLogs(data as EmailLog[]);
      }
      setLoading(false);
    };

    fetchLogs();

    // Subscribe to new logs
    const channel = supabase
      .channel('email-logs-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_logs' }, (payload) => {
        setLogs(prev => [payload.new as EmailLog, ...prev.slice(0, 99)]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredLogs = logs.filter(log => 
    log.recipient.toLowerCase().includes(search.toLowerCase()) ||
    (log.template_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'sent':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1"><CheckCircle2 className="h-3 w-3" /> {status === 'delivered' ? 'Entregue' : 'Enviado'}</Badge>;
      case 'failed':
      case 'bounced':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {status === 'failed' ? 'Falhou' : 'Retornou'}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Logs de E-mails Transacionais
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar destinatário..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatário</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data/Hora</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando logs...</TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum log encontrado.</TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{log.recipient}</TableCell>
                  <TableCell>
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                      {log.template_name || 'N/A'}
                    </code>
                  </TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    {log.error_message && (
                      <span className="text-[10px] text-destructive italic truncate max-w-[150px] inline-block">
                        {log.error_message}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <p className="text-[10px] text-muted-foreground text-center">
        E-mails enviados via notify.scoutfoto.app. O status é atualizado via webhook em tempo real.
      </p>
    </div>
  );
};

export default EmailLogs;
