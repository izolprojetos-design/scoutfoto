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
import { getCurrentBranch, getNextBranchChange, formatAge, formatTimeLeft, SCOUT_BRANCHES, ALL_CATEGORIES } from '@/lib/scoutUtils';
import { format, differenceInDays, setYear } from 'date-fns';
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
    return ALL_CATEGORIES.find(b => b.key === scout.manual_branch) || getCurrentBranch(new Date(scout.birth_date));
  }
  return getCurrentBranch(new Date(scout.birth_date));
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
        const ageBranch = getCurrentBranch(new Date(s.birth_date));
        if (!effectiveBranch || !ageBranch) return false;
        const effectiveIdx = SCOUT_BRANCHES.findIndex(b => b.key === effectiveBranch.key);
        const ageIdx = SCOUT_BRANCHES.findIndex(b => b.key === ageBranch.key);
        return effectiveIdx >= 0 && ageIdx >= 0 && ageIdx > effectiveIdx;
      })
      .map(s => {
        const ageBranch = getCurrentBranch(new Date(s.birth_date))!;
        return { ...s, targetBranch: ageBranch };
      }),
    [scouts]
  );

  const upcomingChanges = useMemo(() =>
    scouts
      .map(s => {
        const change = getNextBranchChange(new Date(s.birth_date));
        return change ? { ...s, change } : null;
      })
      .filter((s): s is Scout & { change: NonNullable<ReturnType<typeof getNextBranchChange>> } => s !== null && s.change.monthsLeft <= 6)
      .sort((a, b) => a.change.monthsLeft - b.change.monthsLeft),
    [scouts]
  );

  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    return scouts
      .map(s => {
        const birth = new Date(s.birth_date);
        let nextBday = setYear(birth, today.getFullYear());
        if (nextBday < today) nextBday = setYear(birth, today.getFullYear() + 1);
        const daysUntil = differenceInDays(nextBday, today);
        return { ...s, nextBday, daysUntil };
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
          { icon: Users, value: totalUsers, label: 'Usuários', color: 'text-primary', adminOnly: true },
          { icon: UserCheck, value: activeUsers, label: 'Ativos', color: 'text-emerald-600', adminOnly: true },
          { icon: UserX, value: inactiveUsers, label: 'Inativos', color: 'text-destructive', adminOnly: true },
          { icon: Calendar, value: totalEvents, label: 'Eventos', color: 'text-accent', adminOnly: false },
          { icon: Users, value: scouts.length, label: 'Integrantes', color: 'text-emerald-600', adminOnly: false },
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
        {/* Branch Changes */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Mudanças de Ramo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueChanges.length > 0 && (
              <>
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Já completaram a idade</p>
                {overdueChanges.slice(0, 5).map(s => {
                  const currentBranch = getEffectiveBranchKey(s);
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                      <div className="flex items-center gap-2">
                        {s.photo_url ? (
                          <button onClick={() => setSelectedPhoto({ name: s.name, url: s.photo_url! })} className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary transition-all flex-shrink-0 cursor-pointer">
                            <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{currentBranch?.icon} {currentBranch?.name} → {s.targetBranch.icon} {s.targetBranch.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="destructive" className="text-xs">Pendente</Badge>
                        {canTransfer && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate(`/scouts?edit=${s.id}`)}>
                            <ArrowRightLeft className="h-3 w-3" /> Transferir
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {upcomingChanges.length > 0 && (
              <>
                {overdueChanges.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Próximos 6 meses</p>}
                {upcomingChanges.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      {s.photo_url ? (
                        <button onClick={() => setSelectedPhoto({ name: s.name, url: s.photo_url! })} className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary transition-all flex-shrink-0 cursor-pointer">
                          <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">→ {s.change.branch.icon} {s.change.branch.name}</p>
                      </div>
                    </div>
                    <Badge variant={s.change.monthsLeft <= 2 ? 'destructive' : 'secondary'} className="text-xs">
                      {formatTimeLeft(s.change.monthsLeft, s.change.daysLeft)}
                    </Badge>
                  </div>
                ))}
              </>
            )}
            {overdueChanges.length === 0 && upcomingChanges.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma mudança nos próximos 6 meses</p>
            )}
          </CardContent>
        </Card>

        {/* Birthdays */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cake className="h-4 w-4" /> Aniversariantes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum aniversário nos próximos 30 dias</p>
            ) : (
              upcomingBirthdays.slice(0, 5).map(s => {
                const branch = getEffectiveBranchKey(s);
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      {s.photo_url ? (
                        <button onClick={() => setSelectedPhoto({ name: s.name, url: s.photo_url! })} className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary transition-all flex-shrink-0 cursor-pointer">
                          <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(s.nextBday, "dd 'de' MMM", { locale: ptBR })}
                          {branch && <span> · {branch.icon} {branch.name}</span>}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {s.daysUntil === 0 ? 'Hoje! 🎉' : `${s.daysUntil}d`}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>



        {isAdmin && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Status dos Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Ativos', value: activeUsers, fill: '#10b981' },
                      { name: 'Inativos', value: inactiveUsers, fill: '#ef4444' },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                    formatter={(value: number, name: string) => [`${value} usuários`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6">
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Ativos</span>
                  <span className="font-semibold">{activeUsers}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-muted-foreground">Inativos</span>
                  <span className="font-semibold">{inactiveUsers}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
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
