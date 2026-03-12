import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  image_id: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
}

interface Profile {
  user_id: string;
  name: string;
}

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  upload: { label: 'Upload', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  download: { label: 'Download', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  view: { label: 'Visualização', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-400' },
  edit: { label: 'Edição', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  delete: { label: 'Exclusão', color: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  login: { label: 'Login', color: 'bg-violet-500/10 text-violet-700 dark:text-violet-400' },
  create_event: { label: 'Criar Evento', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  change_permissions: { label: 'Permissões', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  create_user: { label: 'Criar Usuário', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' },
};

const ActivityLogsViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchUser, setSearchUser] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('user_id, name').then(({ data }) => {
      setProfiles(data || []);
    });
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, filterAction, filterDateFrom, filterDateTo]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterAction !== 'all') {
      query = query.eq('action', filterAction);
    }
    if (filterDateFrom) {
      query = query.gte('created_at', new Date(filterDateFrom).toISOString());
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      query = query.lte('created_at', to.toISOString());
    }

    const { data, count } = await query;
    setLogs((data as AuditLog[]) || []);
    setTotalCount(count || 0);
    setLoading(false);
  };

  const getUserName = (uid: string) => {
    const p = profiles.find(p => p.user_id === uid);
    return p?.name || uid.slice(0, 8);
  };

  const getActionInfo = (action: string) => ACTION_LABELS[action] || { label: action, color: 'bg-muted text-muted-foreground' };

  const filteredLogs = searchUser
    ? logs.filter(l => {
        const name = getUserName(l.user_id).toLowerCase();
        return name.includes(searchUser.toLowerCase());
      })
    : logs;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getDetails = (log: AuditLog) => {
    if (!log.details) return log.image_id?.slice(0, 8) || '—';
    const d = log.details as Record<string, unknown>;
    if (d.event_name) return String(d.event_name);
    if (d.type) return String(d.type);
    return log.image_id?.slice(0, 8) || '—';
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Logs de Atividade
          <Badge variant="secondary" className="ml-2">{totalCount} registros</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros:
          </div>
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário..."
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
          <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(0); }}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ações</SelectItem>
              <SelectItem value="upload">Upload</SelectItem>
              <SelectItem value="download">Download</SelectItem>
              <SelectItem value="view">Visualização</SelectItem>
              <SelectItem value="edit">Edição</SelectItem>
              <SelectItem value="delete">Exclusão</SelectItem>
              <SelectItem value="login">Login</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filterDateFrom}
            onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }}
            className="w-[150px] h-9"
            placeholder="De"
          />
          <Input
            type="date"
            value={filterDateTo}
            onChange={e => { setFilterDateTo(e.target.value); setPage(0); }}
            className="w-[150px] h-9"
            placeholder="Até"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}><div className="h-5 w-full animate-pulse rounded bg-muted" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map(log => {
                  const actionInfo = getActionInfo(log.action);
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{getUserName(log.user_id)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {getDetails(log)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Próxima <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityLogsViewer;
