import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Activity, Search, ChevronLeft, ChevronRight, Filter, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  image_id: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  ip_address: string | null;
}

interface Profile {
  user_id: string;
  name: string;
}

interface SecurityAlert {
  type: 'warning' | 'critical';
  message: string;
  count: number;
  user?: string;
}

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, { label: string; color: string; risk: 'low' | 'medium' | 'high' }> = {
  upload: { label: 'Upload', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', risk: 'low' },
  download: { label: 'Download', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', risk: 'low' },
  view: { label: 'Visualização', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-400', risk: 'low' },
  edit: { label: 'Edição', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', risk: 'medium' },
  delete: { label: 'Exclusão', color: 'bg-red-500/10 text-red-700 dark:text-red-400', risk: 'high' },
  login: { label: 'Login', color: 'bg-violet-500/10 text-violet-700 dark:text-violet-400', risk: 'low' },
  login_failed: { label: 'Login Falhou', color: 'bg-red-500/10 text-red-700 dark:text-red-400', risk: 'high' },
  logout: { label: 'Logout', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-400', risk: 'low' },
  password_changed: { label: 'Senha Alterada', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', risk: 'medium' },
  password_reset: { label: 'Reset de Senha', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', risk: 'medium' },
  account_locked: { label: 'Conta Bloqueada', color: 'bg-red-500/10 text-red-700 dark:text-red-400', risk: 'high' },
  logout_all_sessions: { label: 'Logout Global', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', risk: 'high' },
  session_revoked_password_change: { label: 'Sessão Revogada', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', risk: 'medium' },
  remote_device_removed: { label: 'Dispositivo Removido', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', risk: 'medium' },
  create_event: { label: 'Criar Evento', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', risk: 'low' },
  change_permissions: { label: 'Permissões', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', risk: 'high' },
  create_user: { label: 'Criar Usuário', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400', risk: 'medium' },
  data_update: { label: 'Atualização', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', risk: 'medium' },
  access_denied: { label: 'Acesso Negado', color: 'bg-red-500/10 text-red-700 dark:text-red-400', risk: 'high' },
  mfa_enabled: { label: '2FA Ativado', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', risk: 'low' },
  mfa_disabled: { label: '2FA Desativado', color: 'bg-red-500/10 text-red-700 dark:text-red-400', risk: 'high' },
  add_external_link: { label: 'Novo Link', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', risk: 'low' },
  edit_external_link: { label: 'Link Editado', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', risk: 'medium' },
  delete_external_link: { label: 'Link Excluído', color: 'bg-red-500/10 text-red-700 dark:text-red-400', risk: 'high' },
};

const RISK_ICON: Record<string, React.ReactNode> = {
  low: null,
  medium: <AlertTriangle className="h-3 w-3 text-amber-500" />,
  high: <ShieldAlert className="h-3 w-3 text-red-500" />,
};

const ActivityLogsViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const [searchUser, setSearchUser] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('user_id, name').then(({ data }) => {
      setProfiles(data || []);
    });
    detectAlerts();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, filterAction, filterDateFrom, filterDateTo]);

  const detectAlerts = async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Failed logins in last hour
    const { count: failedLogins } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login_failed')
      .gte('created_at', oneHourAgo);

    // Access denied in last hour
    const { count: accessDenied } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'access_denied')
      .gte('created_at', oneHourAgo);

    const newAlerts: SecurityAlert[] = [];
    if ((failedLogins || 0) >= 3) {
      newAlerts.push({
        type: 'critical',
        message: `${failedLogins} tentativas de login falharam na última hora`,
        count: failedLogins || 0,
      });
    }
    if ((accessDenied || 0) >= 3) {
      newAlerts.push({
        type: 'warning',
        message: `${accessDenied} acessos negados na última hora`,
        count: accessDenied || 0,
      });
    }
    setAlerts(newAlerts);
  };

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterAction !== 'all') query = query.eq('action', filterAction);
    if (filterDateFrom) query = query.gte('created_at', new Date(filterDateFrom).toISOString());
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
    if (uid === '00000000-0000-0000-0000-000000000000') return 'Anônimo';
    const p = profiles.find(p => p.user_id === uid);
    return p?.name || uid.slice(0, 8);
  };

  const getActionInfo = (action: string) => ACTION_LABELS[action] || { label: action, color: 'bg-muted text-muted-foreground', risk: 'low' as const };

  const filteredLogs = searchUser
    ? logs.filter(l => getUserName(l.user_id).toLowerCase().includes(searchUser.toLowerCase()))
    : logs;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getDetails = (log: AuditLog) => {
    if (!log.details) return log.image_id?.slice(0, 8) || '—';
    const d = log.details as Record<string, unknown>;
    if (d.event_name) return String(d.event_name);
    if (d.email) return String(d.email);
    if (d.type) return String(d.type);
    if (d.reason) return String(d.reason);
    return log.image_id?.slice(0, 8) || '—';
  };

  const hasBeforeAfter = (log: AuditLog) => {
    return (log.before_data && Object.keys(log.before_data).length > 0) ||
           (log.after_data && Object.keys(log.after_data).length > 0);
  };

  return (
    <div className="space-y-4">
      {/* Security Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <Card key={i} className={`border-0 shadow-md ${alert.type === 'critical' ? 'bg-red-500/5 border-l-4 border-l-red-500' : 'bg-amber-500/5 border-l-4 border-l-amber-500'}`}>
              <CardContent className="flex items-center gap-3 py-3">
                {alert.type === 'critical' ? (
                  <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                )}
                <span className="text-sm font-medium">{alert.message}</span>
                <Badge variant={alert.type === 'critical' ? 'destructive' : 'secondary'} className="ml-auto">
                  {alert.type === 'critical' ? 'Crítico' : 'Alerta'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
              <SelectTrigger className="w-[170px] h-9">
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
                <SelectItem value="login_failed">Login Falhou</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="password_changed">Senha Alterada</SelectItem>
                <SelectItem value="access_denied">Acesso Negado</SelectItem>
                <SelectItem value="change_permissions">Permissões</SelectItem>
                <SelectItem value="create_user">Criar Usuário</SelectItem>
                <SelectItem value="data_update">Atualização</SelectItem>
                <SelectItem value="add_external_link">Novo Link</SelectItem>
                <SelectItem value="edit_external_link">Link Editado</SelectItem>
                <SelectItem value="delete_external_link">Link Excluído</SelectItem>
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
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="w-16">Info</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><div className="h-5 w-full animate-pulse rounded bg-muted" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map(log => {
                    const actionInfo = getActionInfo(log.action);
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedLog(log)}>
                        <TableCell className="px-2">
                          {RISK_ICON[actionInfo.risk]}
                        </TableCell>
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
                        <TableCell>
                          {(hasBeforeAfter(log) || (log.details && Object.keys(log.details).length > 1)) && (
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Detalhes do Log
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Data/Hora</p>
                  <p className="font-medium">{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Usuário</p>
                  <p className="font-medium">{getUserName(selectedLog.user_id)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ação</p>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getActionInfo(selectedLog.action).color}`}>
                    {getActionInfo(selectedLog.action).label}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Risco</p>
                  <div className="flex items-center gap-1.5">
                    {RISK_ICON[getActionInfo(selectedLog.action).risk]}
                    <span className="text-xs capitalize">{getActionInfo(selectedLog.action).risk === 'low' ? 'Baixo' : getActionInfo(selectedLog.action).risk === 'medium' ? 'Médio' : 'Alto'}</span>
                  </div>
                </div>
              </div>

              {selectedLog.ip_address && (
                <div className="text-sm">
                  <p className="text-muted-foreground text-xs">IP</p>
                  <p className="font-mono text-xs">{selectedLog.ip_address}</p>
                </div>
              )}

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Detalhes</p>
                  <pre className="rounded-lg bg-muted p-3 text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.before_data && Object.keys(selectedLog.before_data).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                    Antes
                  </p>
                  <pre className="rounded-lg bg-red-500/5 border border-red-500/10 p-3 text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedLog.before_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.after_data && Object.keys(selectedLog.after_data).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    Depois
                  </p>
                  <pre className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3 text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedLog.after_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivityLogsViewer;
