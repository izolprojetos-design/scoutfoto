import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogIn, Search, RefreshCw, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DevicesSection from '@/components/profile/DevicesSection';


interface AccessLog {
  id: string;
  user_id: string;
  action: string;
  created_at: string;
  ip_address: string | null;
  details: Record<string, unknown> | null;
}

interface Profile {
  user_id: string;
  name: string;
  email: string;
}

const PAGE_SIZE = 25;
const ACTION_FILTER = ['login', 'logout', 'login_failed', 'account_locked'];

const ACTION_META: Record<string, { label: string; className: string }> = {
  login: { label: 'Login', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  logout: { label: 'Logout', className: 'bg-slate-500/10 text-slate-700 dark:text-slate-400' },
  login_failed: { label: 'Falha de Login', className: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  account_locked: { label: 'Conta Bloqueada', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
};

const AccessLogViewer = () => {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const actionsToUse = actionFilter === 'all' ? ACTION_FILTER : [actionFilter];

      const { data, count, error } = await supabase
        .from('audit_logs')
        .select('id, user_id, action, created_at, ip_address, details', { count: 'exact' })
        .in('action', actionsToUse)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setLogs((data || []) as AccessLog[]);
      setTotal(count || 0);

      const userIds = Array.from(new Set((data || []).map(d => d.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', userIds);
        const map: Record<string, Profile> = {};
        (profs || []).forEach(p => { map[p.user_id] = p as Profile; });
        setProfiles(prev => ({ ...prev, ...map }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [page, actionFilter]);

  const filteredLogs = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return logs;
    return logs.filter(l => {
      const p = profiles[l.user_id];
      return (
        p?.name?.toLowerCase().includes(s) ||
        p?.email?.toLowerCase().includes(s) ||
        l.ip_address?.toLowerCase().includes(s) ||
        (l.details && JSON.stringify(l.details).toLowerCase().includes(s))
      );
    });
  }, [logs, profiles, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const getDevice = (details: Record<string, unknown> | null) => {
    if (!details) return '—';
    const parts: string[] = [];
    if (details.device) parts.push(String(details.device));
    if (details.browser) parts.push(String(details.browser));
    if (details.os) parts.push(String(details.os));
    return parts.length ? parts.join(' · ') : '—';
  };

  return (
    <>
    <Card className="border-0 shadow-lg">

      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 font-bold">
            <LogIn className="h-5 w-5 text-primary" />
            Log de Acessos
            <Badge variant="outline" className="ml-2">{total}</Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário, e-mail, IP..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 w-[240px]"
              />
            </div>
            <Select value={actionFilter} onValueChange={v => { setPage(0); setActionFilter(v); }}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="login_failed">Falha de Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="account_locked">Conta Bloqueada</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Dispositivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && logs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum acesso registrado.</TableCell></TableRow>
              ) : (
                filteredLogs.map(l => {
                  const p = profiles[l.user_id];
                  const meta = ACTION_META[l.action] ?? { label: l.action, className: 'bg-muted' };
                  const emailInDetails = typeof l.details?.email === 'string' ? String(l.details.email) : null;
                  const newDevice = l.details?.new_device === true;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{p?.name || 'Desconhecido'}</span>
                          <span className="text-xs text-muted-foreground">{p?.email || emailInDetails || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge className={meta.className}>{meta.label}</Badge>
                          {newDevice && (
                            <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300">
                              <ShieldAlert className="h-3 w-3" /> Novo dispositivo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.ip_address || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{getDevice(l.details)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="mt-6">
      <DevicesSection />
    </div>
    </>
  );
};


export default AccessLogViewer;
