import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserSection, SECTION_OPTIONS } from '@/hooks/useUserSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { motion } from 'framer-motion';
import { ImageIcon, Upload, Calendar, TrendingUp, ArrowRight, Users, ArrowRightLeft, Cake, User, Check, RefreshCw, ShieldCheck, UserCheck, UserX, BarChart3 } from 'lucide-react';
import { StatsSkeleton, PieChartSkeleton, ListCardSkeleton, GalleryCardsSkeleton } from '@/components/DashboardSkeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getCurrentBranch, getNextBranchChange, formatAge, formatTimeLeft, parseLocalDate, SCOUT_BRANCHES, ALL_CATEGORIES } from '@/lib/scoutUtils';
import { format, differenceInDays, startOfDay, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { toast } from 'sonner';

interface BranchWithCount {
  id: string;
  key: string;
  display_name: string;
  icon: string;
  sort_order: number;
  imageCount: number;
}

interface Scout {
  id: string;
  name: string;
  birth_date: string;
  scout_group: string;
  photo_url: string | null;
  manual_branch: string | null;
  section: string | null;
}

interface UserProfile {
  user_id: string;
  name: string;
  is_active: boolean;
  section: string | null;
}

interface UserRole {
  user_id: string;
  role: string;
}

const getEffectiveBranchKey = (scout: Scout) => {
  if (scout.manual_branch) {
    return ALL_CATEGORIES.find(b => b.key === scout.manual_branch) || getCurrentBranch(parseLocalDate(scout.birth_date));
  }
  return getCurrentBranch(parseLocalDate(scout.birth_date));
};

const branchColors: Record<string, string> = {
  lobinho: 'from-amber-500/15 to-amber-600/5 border-amber-200/50 hover:border-amber-300',
  escoteiro: 'from-emerald-500/15 to-emerald-600/5 border-emerald-200/50 hover:border-emerald-300',
  senior: 'from-red-500/15 to-red-600/5 border-red-200/50 hover:border-red-300',
  pioneiro: 'from-orange-500/15 to-orange-600/5 border-orange-200/50 hover:border-orange-300',
  voluntario: 'from-purple-500/15 to-purple-600/5 border-purple-200/50 hover:border-purple-300',
};

const PIE_COLORS: Record<string, string> = {
  lobinho: '#f59e0b',
  escoteiro: '#10b981',
  senior: '#ef4444',
  pioneiro: '#f97316',
  voluntario: '#a855f7',
};

const ROLE_COLORS: Record<string, string> = {
  admin: '#ef4444',
  voluntario: '#a855f7',
  dirigente_gestor: '#3b82f6',
  parent: '#10b981',
  viewer: '#94a3b8',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  voluntario: 'Voluntário',
  dirigente_gestor: 'Dir. Gestor',
  parent: 'Pai/Mãe',
  viewer: 'Visitante',
};

const BAR_SECTION_COLORS: Record<string, string> = {
  Lobinho: '#f59e0b',
  Escoteiro: '#10b981',
  'Sênior': '#ef4444',
  Pioneiro: '#f97316',
  'Voluntário': '#a855f7',
  'Sem seção': '#94a3b8',
};

const Dashboard = () => {
  const { profile, canUpload, isVoluntario, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const { section: userSection, isRestricted } = useUserSection();
  const canTransfer = isAdmin || hasPermission('transfer_branch');
  const [branches, setBranches] = useState<BranchWithCount[]>([]);
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalImages, setTotalImages] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<{ name: string; url: string } | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const navigate = useNavigate();

  // New state for enhanced dashboard
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [allRoles, setAllRoles] = useState<UserRole[]>([]);
  const [sectionFilter, setSectionFilter] = useState<string>(isRestricted && userSection ? userSection : 'all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  interface EventWithCount {
    id: string;
    name: string;
    event_date: string | null;
    branch_id: string | null;
    scout_group: string | null;
    imageCount: number;
  }

  const [eventsWithPhotos, setEventsWithPhotos] = useState<EventWithCount[]>([]);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    // Core queries for all users; admin-only queries run conditionally
    const corePromises = [
      supabase.from('branches').select('*').order('sort_order'),
      supabase.from('events').select('id, name, event_date, branch_id, scout_group').order('event_date', { ascending: false }).limit(20),
      supabase.from('scouts').select('id, name, birth_date, scout_group, photo_url, manual_branch, section').order('name'),
      supabase.from('images').select('branch_id, event_id'),
    ] as const;

    const adminPromises = isAdmin
      ? [
          supabase.from('profiles').select('user_id, name, is_active, section'),
          supabase.from('user_roles').select('user_id, role'),
        ] as const
      : null;

    const [branchRes, evtRes, scoutRes, allImgRes, ...adminResults] = await Promise.all([
      ...corePromises,
      ...(adminPromises ?? []),
    ]);

    const allImages = (allImgRes as any).data || [];
    const memberImages = allImages.filter((img: any) => !img.event_id);
    const eventImages = allImages.filter((img: any) => img.event_id);

    if (branchRes.data) {
      const withCounts = branchRes.data.map(branch => ({
        ...branch,
        imageCount: memberImages.filter((img: any) => img.branch_id === branch.id).length,
      }));
      setBranches(withCounts);
      setTotalImages(memberImages.length);
    }

    if (evtRes.data) {
      const evtsWithCounts = evtRes.data.map(evt => ({
        ...evt,
        imageCount: eventImages.filter((img: any) => img.event_id === evt.id).length,
      }));
      setEventsWithPhotos(evtsWithCounts);
      setTotalEvents(evtRes.data.length);
    }

    setScouts((scoutRes.data as any) || []);

    if (isAdmin && adminResults.length === 2) {
      setAllProfiles((adminResults[0] as any).data || []);
      setAllRoles(((adminResults[1] as any).data as UserRole[]) || []);
    }

    setLoading(false);
    setRefreshing(false);
  }, [isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const handleTransition = async (scoutId: string, targetBranchKey: string, scoutName: string) => {
    setTransitioningId(scoutId);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('scouts').update({
      manual_branch: targetBranchKey,
      transition_date: today,
    }).eq('id', scoutId);
    if (error) {
      toast.error('Erro ao realizar transição: ' + error.message);
    } else {
      toast.success(`${scoutName} transferido(a) com sucesso!`);
      fetchData(false);
    }
    setTransitioningId(null);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const scoutBranchMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getEffectiveBranchKey>>();
    scouts.forEach(s => map.set(s.id, getEffectiveBranchKey(s)));
    return map;
  }, [scouts]);

  // Filtered profiles based on section
  const filteredProfiles = useMemo(() => {
    if (sectionFilter === 'all') return allProfiles;
    return allProfiles.filter(p => p.section === sectionFilter);
  }, [allProfiles, sectionFilter]);

  // KPIs
  const totalUsers = filteredProfiles.length;
  const activeUsers = filteredProfiles.filter(p => p.is_active).length;
  const inactiveUsers = totalUsers - activeUsers;

  // Role distribution
  const roleDistribution = useMemo(() => {
    const filteredUserIds = new Set(filteredProfiles.map(p => p.user_id));
    const counts: Record<string, number> = {};
    allRoles.filter(r => filteredUserIds.has(r.user_id)).forEach(r => {
      counts[r.role] = (counts[r.role] || 0) + 1;
    });
    return Object.entries(counts).map(([role, count]) => ({
      role,
      label: ROLE_LABELS[role] || role,
      count,
      color: ROLE_COLORS[role] || '#8884d8',
    })).sort((a, b) => b.count - a.count);
  }, [filteredProfiles, allRoles]);

  // Users by section (bar chart)
  const sectionDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    allProfiles.forEach(p => {
      const sec = p.section && p.section !== '' ? p.section : 'Sem seção';
      counts[sec] = (counts[sec] || 0) + 1;
    });
    return Object.entries(counts).map(([section, count]) => ({
      section,
      count,
      fill: BAR_SECTION_COLORS[section] || '#8884d8',
    })).sort((a, b) => b.count - a.count);
  }, [allProfiles]);

  // Scout branch distribution
  const overdueChanges = useMemo(() =>
    scouts
      .filter(s => {
        const effectiveBranch = getEffectiveBranchKey(s);
        const ageBranch = getCurrentBranch(parseLocalDate(s.birth_date));
        if (!effectiveBranch || !ageBranch) return false;
        const effectiveIdx = SCOUT_BRANCHES.findIndex(b => b.key === effectiveBranch.key);
        const ageIdx = SCOUT_BRANCHES.findIndex(b => b.key === ageBranch.key);
        return effectiveIdx >= 0 && ageIdx >= 0 && ageIdx > effectiveIdx;
      })
      .map(s => {
        const ageBranch = getCurrentBranch(parseLocalDate(s.birth_date))!;
        return { ...s, targetBranch: ageBranch };
      }),
    [scouts]
  );

  const upcomingChanges = useMemo(() =>
    scouts
      .map(s => {
        const change = getNextBranchChange(parseLocalDate(s.birth_date));
        return change ? { ...s, change } : null;
      })
      .filter((s): s is Scout & { change: NonNullable<ReturnType<typeof getNextBranchChange>> } => s !== null && s.change.monthsLeft < 3)
      .sort((a, b) => a.change.date.getTime() - b.change.date.getTime()),
    [scouts]
  );

  const upcomingBirthdays = useMemo(() => {
    const today = startOfDay(new Date());
    return scouts
      .map(s => {
        const [y, m, d] = s.birth_date.split('-').map(Number);
        let nextBday = startOfDay(new Date(today.getFullYear(), m - 1, d));
        if (nextBday < today) nextBday = startOfDay(new Date(today.getFullYear() + 1, m - 1, d));
        const daysUntil = differenceInDays(nextBday, today);
        const nextAge = nextBday.getFullYear() - y;
        const isToday = daysUntil === 0;
        return { ...s, nextBday, daysUntil, nextAge, isToday };
      })
      .filter(s => s.daysUntil >= 0 && s.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [scouts]);

  const branchDistribution = useMemo(() =>
    ALL_CATEGORIES.map(b => ({
      ...b,
      count: scouts.filter(s => scoutBranchMap.get(s.id)?.key === b.key).length,
    })),
    [scouts, scoutBranchMap]
  );

  return (
    <>
      {/* Welcome Section */}
      <div className="mb-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {greeting()}, {profile?.name?.split(' ')[0]} 👋
            </h1>
            <p className="mt-1 text-muted-foreground">Gerencie seu Grupo Escoteiro Monte Caburaí-12GEMC</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Section filter - only admin can change */}
            {isAdmin && (
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Filtrar seção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as seções</SelectItem>
                  {SECTION_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2">
              <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} className="scale-90" />
              <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer">Auto</Label>
            </div>
            <Button variant="ghost" size="sm" onClick={() => fetchData(false)} disabled={refreshing} className="h-9 gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-xs">Atualizar</span>
            </Button>
          </div>
        </motion.div>
      </div>

      {/* KPI Stats Grid */}
      {loading ? <StatsSkeleton /> : (
      <div className={`mb-6 grid grid-cols-2 gap-3 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-2'}`}>
        {[
          { icon: Users, value: totalUsers, label: 'Usuários', source: 'Perfis', color: 'text-primary', adminOnly: true },
          { icon: UserCheck, value: activeUsers, label: 'Ativos', source: 'Perfis', color: 'text-emerald-600', adminOnly: true },
          { icon: UserX, value: inactiveUsers, label: 'Inativos', source: 'Perfis', color: 'text-destructive', adminOnly: true },
          { icon: Calendar, value: totalEvents, label: 'Eventos', source: 'Eventos', color: 'text-accent', adminOnly: false },
          { icon: Users, value: scouts.length, label: 'Integrantes', source: 'Cadastro', color: 'text-emerald-600', adminOnly: false },
        ].filter(stat => !stat.adminOnly || isAdmin).map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04 }}>
            <Card className="border bg-card shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-[10px] text-muted-foreground/60">Fonte: {stat.source}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      )}

      {/* Charts Row: Role Pie + Section Bar + Branch Pie — admin only */}
      {isAdmin && (loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
          <PieChartSkeleton />
          <PieChartSkeleton />
          <PieChartSkeleton />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        {/* Role Distribution Pie */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Usuários por Cargo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roleDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={roleDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="label"
                    >
                      {roleDistribution.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      formatter={(value: number, name: string) => [`${value} usuários`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2">
                  {roleDistribution.map(r => (
                    <div key={r.role} className="flex items-center gap-1.5 text-xs">
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: r.color }} />
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-semibold">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Branch Distribution Pie */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Integrantes por Ramo
              <Badge className="ml-auto text-sm font-bold px-3 py-1 bg-primary text-primary-foreground">{scouts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Cadastre integrantes</p>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={branchDistribution.filter(b => b.count > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="name"
                    >
                      {branchDistribution.filter(b => b.count > 0).map((entry, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[entry.key] || '#8884d8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      formatter={(value: number, name: string) => [`${value} integrantes`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2">
                  {branchDistribution.map(b => (
                    <div key={b.key} className="flex items-center gap-1.5 text-xs">
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[b.key] || '#8884d8' }} />
                      <span className="text-muted-foreground">{b.icon} {b.name}</span>
                      <span className="font-semibold">{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users by Section Bar Chart */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Usuários por Seção
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sectionDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sectionDistribution} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="section" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                    formatter={(value: number) => [`${value} usuários`]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {sectionDistribution.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>
      ))}

      {/* Operational Cards Row */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
          <ListCardSkeleton />
          <ListCardSkeleton />
          <ListCardSkeleton />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        {/* Overdue Branch Changes */}
        <Card className="order-2 lg:order-1 border-t-4 border-t-destructive border shadow-sm flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-destructive" /> Mudanças de Ramo
              {overdueChanges.length > 0 && (
                <Badge variant="destructive" className="ml-auto text-xs">{overdueChanges.length}</Badge>
              )}
            </CardTitle>
            <p className="text-sm font-medium text-muted-foreground">Integrantes que já completaram a idade</p>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto max-h-[380px] flex-1">
            {overdueChanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Check className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-sm text-muted-foreground">Todos os integrantes estão no ramo correto</p>
              </div>
            ) : (
              overdueChanges.map(s => {
                const currentBranch = getEffectiveBranchKey(s);
                const [birthYear, birthMonth, birthDay] = s.birth_date.split('-').map(Number);
                const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
                const changeDate = startOfDay(addMonths(birthDate, SCOUT_BRANCHES.find(b => b.key === currentBranch?.key)?.maxAge || 0));
                const ageAtChange = changeDate.getFullYear() - birthYear;
                return (
                  <div key={s.id} className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                    <div className="flex items-start gap-2">
                      {s.photo_url ? (
                        <button onClick={() => setSelectedPhoto({ name: s.name, url: s.photo_url! })} className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary transition-all flex-shrink-0 cursor-pointer">
                          <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium break-words leading-tight">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {currentBranch?.icon} {currentBranch?.name} → {s.targetBranch.icon} {s.targetBranch.name} · {ageAtChange} anos
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Badge variant="destructive" className="text-xs">Pendente</Badge>
                          {canTransfer && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate(`/scouts?edit=${s.id}`)}>
                              <ArrowRightLeft className="h-3 w-3" /> Transferir
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Upcoming 6 months */}
        <Card className="order-3 lg:order-2 border-t-4 border-t-amber-500 border shadow-sm flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" /> Próximos 3 Meses
              {upcomingChanges.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">{upcomingChanges.length}</Badge>
              )}
            </CardTitle>
            <p className="text-sm font-medium text-muted-foreground">Mudanças de ramo previstas</p>
          </CardHeader>
          <CardContent className="space-y-1 overflow-y-auto max-h-[380px] flex-1">
            {upcomingChanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma mudança nos próximos 3 meses</p>
              </div>
            ) : (
              (() => {
                let lastMonth = -1;
                return upcomingChanges.map(s => {
                  const [birthYear] = s.birth_date.split('-').map(Number);
                  const ageAtChange = s.change.date.getFullYear() - birthYear;
                  const currentBranch = getCurrentBranch(parseLocalDate(s.birth_date));
                  const monthIdx = s.change.date.getMonth();
                  const showHeader = monthIdx !== lastMonth;
                  lastMonth = monthIdx;
                  const monthName = format(s.change.date, 'MMMM', { locale: ptBR });
                  return (
                    <div key={s.id}>
                      {showHeader && (
                        <div className="flex items-center gap-2 py-2 mt-1 first:mt-0">
                          <Calendar className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">{monthName}</span>
                          <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800" />
                        </div>
                      )}
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="flex items-start gap-2">
                          {s.photo_url ? (
                            <button onClick={() => setSelectedPhoto({ name: s.name, url: s.photo_url! })} className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary transition-all flex-shrink-0 cursor-pointer">
                              <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                            </button>
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium break-words leading-tight">{s.name}</p>
                              <Badge variant={s.change.monthsLeft <= 2 ? 'destructive' : 'secondary'} className="text-xs flex-shrink-0">
                                {formatTimeLeft(s.change.monthsLeft, s.change.daysLeft)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {currentBranch?.icon} {currentBranch?.name} → {s.change.branch.icon} {s.change.branch.name} · {ageAtChange} anos
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </CardContent>
        </Card>

        {/* Birthdays */}
        <Card className="order-1 lg:order-3 border-t-4 border-t-pink-500 border shadow-sm flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Cake className="h-5 w-5 text-pink-500" /> Aniversariantes
              {upcomingBirthdays.length > 0 && (
                <Badge variant="outline" className="ml-auto text-xs">{upcomingBirthdays.length}</Badge>
              )}
            </CardTitle>
            <p className="text-sm font-medium text-muted-foreground">Próximos 30 dias</p>
          </CardHeader>
          <CardContent className="space-y-1 overflow-y-auto max-h-[380px] flex-1">
            {upcomingBirthdays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Cake className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum aniversário nos próximos 30 dias</p>
              </div>
            ) : (
              (() => {
                let lastMonth = -1;
                return upcomingBirthdays.map(s => {
                  const branch = getEffectiveBranchKey(s);
                  const monthIdx = s.nextBday.getMonth();
                  const showHeader = monthIdx !== lastMonth;
                  lastMonth = monthIdx;
                  const monthName = format(s.nextBday, 'MMMM', { locale: ptBR });
                  return (
                    <div key={s.id}>
                      {showHeader && (
                        <div className="flex items-center gap-2 py-2 mt-1 first:mt-0">
                          <Calendar className="h-4 w-4 text-pink-500" />
                          <span className="text-sm font-bold uppercase tracking-wide text-pink-600 dark:text-pink-400">{monthName}</span>
                          <div className="flex-1 h-px bg-pink-200 dark:bg-pink-800" />
                        </div>
                      )}
                      <div className={`rounded-lg p-3 transition-all ${s.isToday ? 'bg-green-100 dark:bg-green-950/40 ring-1 ring-green-400/40' : 'bg-muted/50'}`}>
                        <div className="flex items-start gap-2">
                          {s.photo_url ? (
                            <button onClick={() => setSelectedPhoto({ name: s.name, url: s.photo_url! })} className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary transition-all flex-shrink-0 cursor-pointer">
                              <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                            </button>
                          ) : (
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${s.isToday ? 'bg-green-200 dark:bg-green-900' : 'bg-muted'}`}>
                              <User className={`h-4 w-4 ${s.isToday ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-bold break-words leading-tight ${s.isToday ? 'text-green-700 dark:text-green-300' : ''}`} style={!s.isToday ? { color: 'hsl(var(--scout-green))' } : undefined}>{s.name}</p>
                              <Badge variant={s.isToday ? 'default' : 'outline'} className={`text-xs flex-shrink-0 ${s.isToday ? 'bg-green-600 hover:bg-green-700 text-white border-0' : ''}`}>
                                {s.isToday ? '🎉 Hoje!' : `${s.daysUntil}d`}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(s.nextBday, "dd 'de' MMM", { locale: ptBR })} · {s.nextAge} anos
                              {branch && <span> · {branch.icon} {branch.name}</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Branch Cards */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Galerias de Integrantes por Ramo</h2>
      </div>

      {loading ? (
        <GalleryCardsSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch, index) => (
            <motion.div key={branch.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + index * 0.06 }}>
              <Card
                className={`group cursor-pointer border bg-gradient-to-br transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${branchColors[branch.key] || 'from-muted/50 to-muted/20 border-border hover:border-primary/30'}`}
                onClick={() => navigate(`/branch/${branch.key}`)}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{branch.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">{branch.display_name}</h3>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {(() => {
                          const count = scouts.filter(s => scoutBranchMap.get(s.id)?.key === branch.key).length;
                          return <span>{count} {count === 1 ? 'integrante' : 'integrantes'}</span>;
                        })()}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-foreground/70" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Event Gallery */}
      <div className="mt-8 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Galerias de Eventos</h2>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate('/events')}>
          Ver todos <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <GalleryCardsSkeleton count={3} />
      ) : eventsWithPhotos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento cadastrado</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventsWithPhotos.slice(0, 6).map((evt, index) => {
            const branch = branches.find(b => b.id === evt.branch_id);
            return (
              <motion.div key={evt.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + index * 0.06 }}>
                <Card
                  className="group cursor-pointer border bg-gradient-to-br from-primary/5 to-primary/0 border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                  onClick={() => navigate(`/events/${evt.id}`)}
                >
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{branch?.icon || '📅'}</span>
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight">{evt.name}</h3>
                        <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
                          {evt.event_date && (
                            <span className="text-xs">{format(new Date(evt.event_date), "dd/MM/yyyy")}</span>
                          )}
                          <div className="flex items-center gap-1.5">
                            <ImageIcon className="h-3.5 w-3.5" />
                            <span>{evt.imageCount} {evt.imageCount === 1 ? 'foto' : 'fotos'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-foreground/70" />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Photo Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-md flex flex-col items-center gap-4">
          {selectedPhoto && (
            <>
              <img src={selectedPhoto.url} alt={selectedPhoto.name} className="w-64 h-64 rounded-xl object-cover shadow-lg" />
              <p className="text-lg font-semibold">{selectedPhoto.name}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Dashboard;
