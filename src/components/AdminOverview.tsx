import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserCheck, UserX, Calendar, Cake, ArrowRightLeft, Image as ImageIcon, Shield, Loader2, ClipboardList, CameraOff, UserMinus, ExternalLink } from 'lucide-react';
import { ALL_CATEGORIES, getCurrentBranch, getNextBranchChange, parseLocalDate } from '@/lib/scoutUtils';
import { differenceInDays, differenceInYears, startOfDay, startOfYear, endOfYear, getMonth } from 'date-fns';
import LazyPieChart from '@/components/LazyPieChart';

interface Stats {
  totalScouts: number;
  activeScouts: number;
  inactiveScouts: number;
  byBranch: { name: string; value: number; color: string }[];
  bySection: { name: string; value: number }[];
  bySectionDistribution: { name: string; value: number; color: string }[];
  birthdaysThisMonth: number;
  upcomingTransitions: number;
  eventsThisYear: number;
  upcomingEvents: number;
  totalImages: number;
  totalUsers: number;
  activeUsers: number;
  pendingSchedulings: number;
  scoutsWithoutPhoto: number;
  scoutsWithoutGuardian: number;
}

interface SchedulingRequest {
  id: string;
  nome_responsavel: string;
  email: string;
  data: string;
  horario: string;
  local: string;
  tipo: string;
  created_at: string;
}

interface ScoutPending {
  id: string;
  name: string;
  section: string;
  birth_date: string;
}

const BRANCH_COLOR_MAP: Record<string, string> = {
  amber: 'hsl(38 92% 50%)',
  emerald: 'hsl(142 71% 45%)',
  red: 'hsl(0 72% 51%)',
  orange: 'hsl(25 95% 53%)',
  purple: 'hsl(270 70% 55%)',
};

const AdminOverview = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [schedDialogOpen, setSchedDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [guardianDialogOpen, setGuardianDialogOpen] = useState(false);
  const [schedList, setSchedList] = useState<SchedulingRequest[]>([]);
  const [photoList, setPhotoList] = useState<ScoutPending[]>([]);
  const [guardianList, setGuardianList] = useState<ScoutPending[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const today = startOfDay(new Date());
      const yearStart = startOfYear(today).toISOString().slice(0, 10);
      const yearEnd = endOfYear(today).toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);
      const currentMonth = getMonth(today);

      const [scoutsRes, eventsRes, imagesRes, profilesRes, pendingRes, guardiansRes] = await Promise.all([
        supabase.from('scouts').select('id, name, birth_date, section, manual_branch, is_active, transition_date, photo_url'),
        supabase.from('events').select('id, event_date'),
        supabase.from('images').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('user_id, is_active'),
        supabase.from('scheduling_requests').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('guardians').select('scout_id'),
      ]);

      const scouts = scoutsRes.data || [];
      const events = eventsRes.data || [];
      const profiles = profilesRes.data || [];

      const active = scouts.filter(s => s.is_active);
      const inactive = scouts.filter(s => !s.is_active);

      // By branch (active only)
      const branchCounts: Record<string, number> = {};
      active.forEach(s => {
        if (!s.birth_date) return;
        let key = s.manual_branch as string | null;
        if (!key) {
          const b = getCurrentBranch(parseLocalDate(s.birth_date));
          key = b?.key || null;
        }
        if (key) branchCounts[key] = (branchCounts[key] || 0) + 1;
      });

      const byBranch = ALL_CATEGORIES.map(b => ({
        name: `${b.icon} ${b.name}`,
        value: branchCounts[b.key] || 0,
        color: BRANCH_COLOR_MAP[b.color] || 'hsl(var(--primary))',
      })).filter(b => b.value > 0);

      // By section
      const sectionCounts: Record<string, number> = {};
      active.forEach(s => {
        const sec = s.section || 'Sem seção';
        sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
      });
      const bySection = Object.entries(sectionCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Distribution for the first chart (now using section data but with branch logic if needed, 
      // but user asked to pull information from "Ocupação por seção")
      // Let's create a specialized distribution for the first chart based on sections
      const SECTION_COLORS: Record<string, string> = {
        'Alcatéia': 'hsl(38 92% 50%)', // Amber
        'Tropa Escoteira': 'hsl(142 71% 45%)', // Emerald
        'Tropa Sênior': 'hsl(0 72% 51%)', // Red
        'Clã Pioneiro': 'hsl(270 70% 55%)', // Purple
        'Chefia': 'hsl(25 95% 53%)', // Orange
      };

      const bySectionDistribution = bySection.map(s => ({
        name: s.name,
        value: s.value,
        color: SECTION_COLORS[s.name] || `hsl(${Math.abs(s.name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 360} 70% 50%)`
      }));

      // Birthdays this month
      const birthdaysThisMonth = active.filter(s => {
        if (!s.birth_date) return false;
        return getMonth(parseLocalDate(s.birth_date)) === currentMonth;
      }).length;

      // Upcoming branch transitions (next 60 days)
      const upcomingTransitions = active.filter(s => {
        if (!s.birth_date) return false;
        const change = getNextBranchChange(parseLocalDate(s.birth_date));
        if (!change) return false;
        const days = differenceInDays(change.date, today);
        return days >= 0 && days <= 60;
      }).length;

      // Events
      const eventsThisYear = events.filter(e => e.event_date && e.event_date >= yearStart && e.event_date <= yearEnd).length;
      const upcomingEvents = events.filter(e => e.event_date && e.event_date >= todayStr).length;

      // Scouts without photo / guardian (active only)
      // Guardian check applies only to minors (under 18) per ECA Digital (Lei nº 15.211/2025)
      const scoutsWithoutPhoto = active.filter(s => !s.photo_url);
      const guardianScoutIds = new Set((guardiansRes.data || []).map(g => g.scout_id));
      const isMinor = (birth: string | null | undefined) => {
        if (!birth) return false;
        return differenceInYears(today, parseLocalDate(birth)) < 18;
      };
      const scoutsWithoutGuardian = active.filter(s => isMinor(s.birth_date) && !guardianScoutIds.has(s.id));

      setStats({
        totalScouts: scouts.length,
        activeScouts: active.length,
        inactiveScouts: inactive.length,
        byBranch,
        bySection,
        bySectionDistribution,
        birthdaysThisMonth,
        upcomingTransitions,
        eventsThisYear,
        upcomingEvents,
        totalImages: imagesRes.count || 0,
        totalUsers: profiles.length,
        activeUsers: profiles.filter(p => p.is_active).length,
        pendingSchedulings: pendingRes.count || 0,
        scoutsWithoutPhoto: scoutsWithoutPhoto.length,
        scoutsWithoutGuardian: scoutsWithoutGuardian.length,
      });

      // Store lists for dialogs
      setPhotoList(scoutsWithoutPhoto.map(s => ({ id: s.id, name: s.name, section: s.section || '', birth_date: s.birth_date || '' })));
      setGuardianList(scoutsWithoutGuardian.map(s => ({ id: s.id, name: s.name, section: s.section || '', birth_date: s.birth_date || '' })));

      setLoading(false);
    };
    load();
  }, []);

  const loadPendingSchedulings = async () => {
    if (schedList.length > 0) return;
    setDialogLoading(true);
    const { data } = await supabase
      .from('scheduling_requests')
      .select('id, nome_responsavel, email, data, horario, local, tipo, created_at')
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });
    setSchedList((data || []) as SchedulingRequest[]);
    setDialogLoading(false);
  };

  const handleOpenSched = () => {
    setSchedDialogOpen(true);
    loadPendingSchedulings();
  };

  const handleOpenPhoto = () => setPhotoDialogOpen(true);
  const handleOpenGuardian = () => setGuardianDialogOpen(true);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    { icon: Users, label: 'Integrantes ativos', value: stats.activeScouts, sub: `${stats.totalScouts} no total`, color: 'text-primary' },
    { icon: UserX, label: 'Inativos', value: stats.inactiveScouts, sub: 'Desligados/arquivados', color: 'text-muted-foreground' },
    { icon: Cake, label: 'Aniversariantes do mês', value: stats.birthdaysThisMonth, sub: 'Ativos', color: 'text-pink-600 dark:text-pink-400' },
    { icon: ArrowRightLeft, label: 'Transições próximas', value: stats.upcomingTransitions, sub: 'Próximos 60 dias', color: 'text-amber-600 dark:text-amber-400' },
    { icon: Calendar, label: 'Eventos do ano', value: stats.eventsThisYear, sub: `${stats.upcomingEvents} futuros`, color: 'text-emerald-600 dark:text-emerald-400' },
    { icon: ImageIcon, label: 'Fotos no acervo', value: stats.totalImages, sub: 'Total no sistema', color: 'text-blue-600 dark:text-blue-400' },
    { icon: UserCheck, label: 'Usuários ativos', value: stats.activeUsers, sub: `${stats.totalUsers} no total`, color: 'text-violet-600 dark:text-violet-400' },
    { icon: Shield, label: 'Ocupação de seções', value: stats.bySection.length, sub: 'Seções com integrantes', color: 'text-orange-600 dark:text-orange-400' },
    { icon: ClipboardList, label: 'Agendamentos pendentes', value: stats.pendingSchedulings, sub: 'Aguardando aprovação', color: 'text-yellow-600 dark:text-yellow-400', clickable: true, onClick: handleOpenSched },
    { icon: CameraOff, label: 'Sem foto de perfil', value: stats.scoutsWithoutPhoto, sub: 'Integrantes ativos', color: 'text-rose-600 dark:text-rose-400', clickable: true, onClick: handleOpenPhoto },
    { icon: UserMinus, label: 'Sem responsável', value: stats.scoutsWithoutGuardian, sub: 'Menores de 18 (ECA)', color: 'text-red-600 dark:text-red-400', clickable: true, onClick: handleOpenGuardian },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k: any, i) => (
          <Card
            key={i}
            className={`border shadow-sm ${k.clickable ? 'cursor-pointer hover:border-primary/50 hover:shadow-md transition-all' : ''}`}
            onClick={k.onClick}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{k.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <k.icon className={`h-5 w-5 shrink-0 ${k.color}`} />
                  {k.clickable && <ExternalLink className="h-3 w-3 text-muted-foreground/60" />}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por seção</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.bySectionDistribution.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">Nenhum integrante ativo</p>
            ) : (
              <>
                <LazyPieChart
                  data={stats.bySectionDistribution}
                  dataKey="value"
                  nameKey="name"
                  colors={(entry: any) => entry.color}
                  tooltipFormatter={(v: number, n: string) => [`${v} integrante(s)`, n]}
                  height={220}
                />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {stats.bySectionDistribution.map(b => (
                    <div key={b.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                      <span className="truncate">{b.name}</span>
                      <span className="ml-auto font-semibold tabular-nums">{b.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ocupação por seção</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.bySection.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">Nenhuma seção registrada</p>
            ) : (
              <div className="space-y-3">
                {stats.bySection.map(s => {
                  const max = Math.max(...stats.bySection.map(x => x.value));
                  const pct = max > 0 ? (s.value / max) * 100 : 0;
                  return (
                    <div key={s.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{s.name}</span>
                        <Badge variant="secondary" className="tabular-nums">{s.value}</Badge>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Agendamentos pendentes */}
      <Dialog open={schedDialogOpen} onOpenChange={setSchedDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-yellow-600" />
              Agendamentos pendentes
            </DialogTitle>
          </DialogHeader>
          {dialogLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : schedList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum agendamento pendente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data / Horário</TableHead>
                  <TableHead>Local</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedList.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome_responsavel}</TableCell>
                    <TableCell>{s.tipo}</TableCell>
                    <TableCell>{s.data} {s.horario}</TableCell>
                    <TableCell>{s.local}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => navigate('/agendamentos')} className="gap-2">
              <ExternalLink className="h-4 w-4" /> Ir para Mensagem
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Sem foto */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CameraOff className="h-5 w-5 text-rose-600" />
              Integrantes sem foto de perfil
            </DialogTitle>
          </DialogHeader>
          {photoList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Todos os integrantes ativos possuem foto.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Seção</TableHead>
                  <TableHead>Data de nascimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {photoList.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.section || '—'}</TableCell>
                    <TableCell>{s.birth_date || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => navigate('/scouts')} className="gap-2">
              <ExternalLink className="h-4 w-4" /> Ir para Integrantes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Sem responsável */}
      <Dialog open={guardianDialogOpen} onOpenChange={setGuardianDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-red-600" />
              Integrantes sem responsável cadastrado
            </DialogTitle>
          </DialogHeader>
          {guardianList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Todos os integrantes ativos possuem responsável.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Seção</TableHead>
                  <TableHead>Data de nascimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guardianList.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.section || '—'}</TableCell>
                    <TableCell>{s.birth_date || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => navigate('/scouts')} className="gap-2">
              <ExternalLink className="h-4 w-4" /> Ir para Integrantes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOverview;
