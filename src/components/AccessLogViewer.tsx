import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogIn, Search, RefreshCw, ChevronLeft, ChevronRight, Smartphone, Monitor, Download, ShieldAlert, FileText, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DevicesSection from '@/components/profile/DevicesSection';
// jsPDF/autoTable are loaded dynamically in exportPDF() to keep them out of the Admin bundle

interface DeviceAccess {
  id: string;
  user_id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  device_fingerprint: string | null;
  last_login_at: string;
  created_at: string;
  is_trusted: boolean;
  ip_address: string | null;
  geo_country: string | null;
  geo_city: string | null;
  app_version: string | null;
}

interface Profile {
  user_id: string;
  name: string;
  email: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 25;
const ONLINE_WINDOW_MIN = 30;

const SELECT_COLS = 'id, user_id, device_name, browser, os, device_fingerprint, last_login_at, created_at, is_trusted, ip_address, geo_country, geo_city, app_version';

const AccessLogViewer = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [rows, setRows] = useState<DeviceAccess[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const load = async () => {
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from('user_devices')
        .select(SELECT_COLS, { count: 'exact' })
        .order('last_login_at', { ascending: false });

      if (statusFilter === 'online') {
        const cutoff = new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000).toISOString();
        q = q.gte('last_login_at', cutoff);
      } else if (statusFilter === 'offline') {
        const cutoff = new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000).toISOString();
        q = q.lt('last_login_at', cutoff);
      }

      if (dateFrom) q = q.gte('last_login_at', new Date(dateFrom + 'T00:00:00').toISOString());
      if (dateTo) q = q.lte('last_login_at', new Date(dateTo + 'T23:59:59').toISOString());

      const { data, count, error } = await q.range(from, to);
      if (error) throw error;
      setRows((data || []) as DeviceAccess[]);
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

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [page, pageSize, statusFilter, dateFrom, dateTo, isAdmin]);

  // Realtime: atualiza automaticamente quando qualquer usuário acessar/registrar dispositivo
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('access_log_all_devices')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_devices' },
        () => { void load(); }
      )
      .subscribe();

    // fallback: revalida a cada 30s para reclassificar Online/Offline pelo tempo
    const interval = setInterval(() => { void load(); }, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
    // eslint-disable-next-line
  }, [page, pageSize, statusFilter, dateFrom, dateTo, isAdmin]);

  // Carrega o dataset completo (respeitando filtros) para exportação
  const fetchExportRows = async (): Promise<{ items: DeviceAccess[]; profMap: Record<string, Profile> }> => {
    let q = supabase
      .from('user_devices')
      .select(SELECT_COLS)
      .order('last_login_at', { ascending: false });
    if (statusFilter === 'online') {
      q = q.gte('last_login_at', new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000).toISOString());
    } else if (statusFilter === 'offline') {
      q = q.lt('last_login_at', new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000).toISOString());
    }
    if (dateFrom) q = q.gte('last_login_at', new Date(dateFrom + 'T00:00:00').toISOString());
    if (dateTo) q = q.lte('last_login_at', new Date(dateTo + 'T23:59:59').toISOString());
    const { data } = await q.limit(10000);
    const items = ((data || []) as unknown) as DeviceAccess[];
    const userIds = Array.from(new Set(items.map(d => d.user_id).filter(Boolean)));
    const profMap: Record<string, Profile> = { ...profiles };
    const missing = userIds.filter(id => !profMap[id]);
    if (missing.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('user_id, name, email').in('user_id', missing);
      (profs || []).forEach(p => { profMap[p.user_id] = p as Profile; });
    }
    const s = search.trim().toLowerCase();
    const filtered = s ? items.filter(r => {
      const p = profMap[r.user_id];
      return (
        p?.name?.toLowerCase().includes(s) || p?.email?.toLowerCase().includes(s) ||
        r.device_name?.toLowerCase().includes(s) || r.browser?.toLowerCase().includes(s) ||
        r.os?.toLowerCase().includes(s) || r.ip_address?.toLowerCase().includes(s) ||
        r.geo_city?.toLowerCase().includes(s) || r.geo_country?.toLowerCase().includes(s)
      );
    }) : items;
    return { items: filtered, profMap };
  };

  const HEADERS = ['Data/Hora', 'Usuário', 'E-mail', 'Ação', 'Dispositivo', 'Navegador', 'SO', 'IP', 'Local', 'Versão', 'Confiável'];

  const rowToArray = (r: DeviceAccess, p?: Profile): string[] => [
    format(new Date(r.last_login_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
    p?.name || '', p?.email || '', 'login',
    r.device_name || '', r.browser || '', r.os || '',
    r.ip_address || '—',
    [r.geo_city, r.geo_country].filter(Boolean).join(', ') || '—',
    r.app_version || '—',
    r.is_trusted ? 'Sim' : 'Não',
  ];

  const filterSuffix = () => {
    const parts: string[] = [];
    if (dateFrom) parts.push(`de ${dateFrom}`);
    if (dateTo) parts.push(`até ${dateTo}`);
    if (statusFilter !== 'all') parts.push(statusFilter);
    if (search) parts.push(`busca:"${search}"`);
    return parts.length ? ` — ${parts.join(' · ')}` : '';
  };

  const exportCSV = async () => {
    const { items, profMap } = await fetchExportRows();
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [HEADERS.join(',')].concat(items.map(r => rowToArray(r, profMap[r.user_id]).map(esc).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log-de-acessos-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    const { items, profMap } = await fetchExportRows();
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text('Log de Acessos', 14, 14);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })} · ${items.length} registros${filterSuffix()}`, 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [HEADERS],
      body: items.map(r => rowToArray(r, profMap[r.user_id])),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [34, 76, 44], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 8, right: 8 },
    });
    doc.save(`log-de-acessos-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`);
  };

  const isOnline = (iso: string) =>
    Date.now() - new Date(iso).getTime() < ONLINE_WINDOW_MIN * 60_000;

  const isMobile = (os: string | null) => /android|ios|iphone|ipad/i.test(os || '');

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => {
      const p = profiles[r.user_id];
      return (
        p?.name?.toLowerCase().includes(s) ||
        p?.email?.toLowerCase().includes(s) ||
        r.device_name?.toLowerCase().includes(s) ||
        r.browser?.toLowerCase().includes(s) ||
        r.os?.toLowerCase().includes(s) ||
        r.ip_address?.toLowerCase().includes(s) ||
        r.geo_city?.toLowerCase().includes(s) ||
        r.geo_country?.toLowerCase().includes(s)
      );
    });
  }, [rows, profiles, search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const onlineCount = rows.filter(r => isOnline(r.last_login_at)).length;

  if (!isAdmin) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <p className="font-semibold">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">Apenas administradores podem visualizar o Log de Acessos.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 font-bold">
            <LogIn className="h-5 w-5 text-primary" />
            Log de Acessos
            <Badge variant="outline" className="ml-2">{total} acessos</Badge>
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {onlineCount} online
            </Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário, e-mail, dispositivo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 w-[240px]"
              />
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={dateFrom}
                onChange={e => { setPage(0); setDateFrom(e.target.value); }}
                className="h-9 w-[150px]"
                aria-label="Data inicial"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => { setPage(0); setDateTo(e.target.value); }}
                className="h-9 w-[150px]"
                aria-label="Data final"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setPage(0); setStatusFilter(v); }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os acessos</SelectItem>
                <SelectItem value="online">Online agora</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
            {(dateFrom || dateTo || search || statusFilter !== 'all') && (
              <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setStatusFilter('all'); setPage(0); }}>
                Limpar
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportPDF}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
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
                <TableHead>Último acesso</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Navegador / SO</TableHead>
                <TableHead>IP / Local</TableHead>
                <TableHead>Versão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum acesso registrado.</TableCell></TableRow>
              ) : (
                filteredRows.map(r => {
                  const p = profiles[r.user_id];
                  const online = isOnline(r.last_login_at);
                  const local = [r.geo_city, r.geo_country].filter(Boolean).join(', ');
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(r.last_login_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{p?.name || 'Desconhecido'}</span>
                          <span className="text-xs text-muted-foreground">{p?.email || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {online ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Offline</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isMobile(r.os) ? (
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">{r.device_name || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {[r.browser, r.os].filter(Boolean).join(' · ') || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span className="font-mono">{r.ip_address || '—'}</span>
                          {local && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {local}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {r.app_version || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>


        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages} · {total} registros
            </p>
            <Select value={String(pageSize)} onValueChange={v => { setPage(0); setPageSize(Number(v)); }}>
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)}>{n} / página</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
