import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, UserX, Calendar, Cake, ArrowRightLeft, Image as ImageIcon, Shield, Loader2, ClipboardList, CameraOff, UserMinus } from 'lucide-react';
import { SCOUT_BRANCHES, ALL_CATEGORIES, calculateAgeInMonths, getCurrentBranch, getNextBranchChange, parseLocalDate } from '@/lib/scoutUtils';
import { differenceInDays, startOfDay, startOfYear, endOfYear, getMonth } from 'date-fns';
import LazyPieChart from '@/components/LazyPieChart';

interface Stats {
  totalScouts: number;
  activeScouts: number;
  inactiveScouts: number;
  byBranch: { name: string; value: number; color: string }[];
  bySection: { name: string; value: number }[];
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

const BRANCH_COLOR_MAP: Record<string, string> = {
  amber: 'hsl(38 92% 50%)',
  emerald: 'hsl(142 71% 45%)',
  red: 'hsl(0 72% 51%)',
  orange: 'hsl(25 95% 53%)',
  purple: 'hsl(270 70% 55%)',
};

const AdminOverview = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = startOfDay(new Date());
      const yearStart = startOfYear(today).toISOString().slice(0, 10);
      const yearEnd = endOfYear(today).toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);
      const currentMonth = getMonth(today);

      const [scoutsRes, eventsRes, imagesRes, profilesRes, pendingRes, guardiansRes] = await Promise.all([
        supabase.from('scouts').select('id, birth_date, section, manual_branch, is_active, transition_date, photo_url'),
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
      const scoutsWithoutPhoto = active.filter(s => !s.photo_url).length;
      const guardianScoutIds = new Set((guardiansRes.data || []).map(g => g.scout_id));
      const scoutsWithoutGuardian = active.filter(s => !guardianScoutIds.has(s.id)).length;

      setStats({
        totalScouts: scouts.length,
        activeScouts: active.length,
        inactiveScouts: inactive.length,
        byBranch,
        bySection,
        birthdaysThisMonth,
        upcomingTransitions,
        eventsThisYear,
        upcomingEvents,
        totalImages: imagesRes.count || 0,
        totalUsers: profiles.length,
        activeUsers: profiles.filter(p => p.is_active).length,
        pendingSchedulings: pendingRes.count || 0,
        scoutsWithoutPhoto,
        scoutsWithoutGuardian,
      });
      setLoading(false);
    };
    load();
  }, []);

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
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Card key={i} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{k.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>
                </div>
                <k.icon className={`h-5 w-5 shrink-0 ${k.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por ramo</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byBranch.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">Nenhum integrante ativo</p>
            ) : (
              <>
                <LazyPieChart
                  data={stats.byBranch}
                  dataKey="value"
                  nameKey="name"
                  colors={(entry: any) => entry.color}
                  tooltipFormatter={(v: number, n: string) => [`${v} integrante(s)`, n]}
                  height={220}
                />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {stats.byBranch.map(b => (
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
    </div>
  );
};

export default AdminOverview;
