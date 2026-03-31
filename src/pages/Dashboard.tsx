import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { motion } from 'framer-motion';
import { ImageIcon, Upload, Calendar, TrendingUp, ArrowRight, Users, ArrowRightLeft, Cake, User, Check } from 'lucide-react';
import { StatsSkeleton, PieChartSkeleton, ListCardSkeleton, GalleryCardsSkeleton } from '@/components/DashboardSkeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getCurrentBranch, getNextBranchChange, formatAge, formatTimeLeft, SCOUT_BRANCHES, ALL_CATEGORIES } from '@/lib/scoutUtils';
import { format, differenceInDays, setYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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

const Dashboard = () => {
  const { profile, canUpload, isChefe, isDirigente } = useAuth();
  const [branches, setBranches] = useState<BranchWithCount[]>([]);
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalImages, setTotalImages] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<{ name: string; url: string } | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const navigate = useNavigate();

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
      // Refresh scouts
      const { data } = await supabase.from('scouts').select('*').order('name');
      if (data) setScouts(data);
    }
    setTransitioningId(null);
  };

  interface EventWithCount {
    id: string;
    name: string;
    event_date: string | null;
    branch_id: string | null;
    scout_group: string | null;
    imageCount: number;
  }

  const [eventsWithPhotos, setEventsWithPhotos] = useState<EventWithCount[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [branchRes, evtRes, scoutRes] = await Promise.all([
        supabase.from('branches').select('*').order('sort_order'),
        supabase.from('events').select('id, name, event_date, branch_id, scout_group').order('event_date', { ascending: false }),
        supabase.from('scouts').select('*').order('name'),
      ]);

      // Fetch all images with branch_id for counting
      const [allImgRes, eventImgRes] = await Promise.all([
        supabase.from('images').select('branch_id, event_id'),
        supabase.from('images').select('event_id').not('event_id', 'is', null),
      ]);

      const allImages = allImgRes.data || [];
      const eventImages = eventImgRes.data || [];
      const memberImages = allImages.filter(img => !img.event_id);

      if (branchRes.data) {
        const withCounts = branchRes.data.map(branch => ({
          ...branch,
          imageCount: memberImages.filter(img => img.branch_id === branch.id).length,
        }));
        setBranches(withCounts);
        setTotalImages(memberImages.length);
      }

      if (evtRes.data) {
        const evtsWithCounts = evtRes.data.map(evt => ({
          ...evt,
          imageCount: eventImages.filter(img => img.event_id === evt.id).length,
        }));
        setEventsWithPhotos(evtsWithCounts);
        setTotalEvents(evtRes.data.length);
      }

      setScouts(scoutRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Memoize scout branch mapping to avoid repeated computation
  const scoutBranchMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getEffectiveBranchKey>>();
    scouts.forEach(s => map.set(s.id, getEffectiveBranchKey(s)));
    return map;
  }, [scouts]);

  // Scouts whose age-based branch is ahead of their effective branch (overdue transition)
  const overdueChanges = useMemo(() =>
    scouts
      .filter(s => {
        const effectiveBranch = getEffectiveBranchKey(s);
        const ageBranch = getCurrentBranch(new Date(s.birth_date));
        if (!effectiveBranch || !ageBranch) return false;
        const effectiveIdx = SCOUT_BRANCHES.findIndex(b => b.key === effectiveBranch.key);
        const ageIdx = SCOUT_BRANCHES.findIndex(b => b.key === ageBranch.key);
        // Overdue: age says they should be in a higher branch than their effective one
        return effectiveIdx >= 0 && ageIdx >= 0 && ageIdx > effectiveIdx;
      })
      .map(s => {
        const ageBranch = getCurrentBranch(new Date(s.birth_date))!;
        return { ...s, targetBranch: ageBranch };
      }),
    [scouts]
  );

  // Scouts changing branch soon (< 6 months)
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

  // Upcoming birthdays (next 30 days)
  const now = new Date();
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

  // Distribution by branch
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
      <div className="mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {greeting()}, {profile?.name?.split(' ')[0]} 👋
            </h1>
            <p className="mt-1 text-muted-foreground">Gerencie seu Grupo Escoteiro Monte Caburaí-12GEMC</p>
          </div>
        </motion.div>
      </div>

      {/* Quick Stats */}
      {loading ? <StatsSkeleton /> : (
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          { icon: Users, value: scouts.length, label: 'Integrantes', color: 'text-emerald-600' },
          { icon: Calendar, value: totalEvents, label: 'Eventos', color: 'text-accent' },
          { icon: TrendingUp, value: branches.length, label: 'Ramos ativos', color: 'text-primary' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
            <Card className="border bg-card shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
          <PieChartSkeleton />
          <ListCardSkeleton />
          <ListCardSkeleton />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
        {/* Branch Distribution - Pie Chart */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Integrantes por Ramo
              <Badge className="ml-auto text-sm font-bold px-3 py-1 bg-primary text-primary-foreground">{scouts.length} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Cadastre integrantes para ver a distribuição</p>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={branchDistribution.filter(b => b.count > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
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

        {/* Upcoming Branch Changes */}
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
                          <button
                            onClick={() => setSelectedPhoto({ name: s.name, url: s.photo_url! })}
                            className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary transition-all flex-shrink-0 cursor-pointer"
                          >
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
                            {currentBranch?.icon} {currentBranch?.name} → {s.targetBranch.icon} {s.targetBranch.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="destructive" className="text-xs">Pendente</Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={transitioningId === s.id}>
                              <Check className="h-3 w-3" /> Transferir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar transição de ramo</AlertDialogTitle>
                              <AlertDialogDescription>
                                Deseja transferir <strong>{s.name}</strong> de {currentBranch?.icon} {currentBranch?.name} para {s.targetBranch.icon} {s.targetBranch.name}? A data de passagem será registrada como hoje.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleTransition(s.id, s.targetBranch.key, s.name)}>
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
                        <button
                          onClick={() => setSelectedPhoto({ name: s.name, url: s.photo_url! })}
                          className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary transition-all flex-shrink-0 cursor-pointer"
                        >
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

        {/* Upcoming Birthdays */}
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
                        <button
                          onClick={() => setSelectedPhoto({ name: s.name, url: s.photo_url! })}
                          className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary transition-all flex-shrink-0 cursor-pointer"
                        >
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
      </div>
      )}


      {/* Branch Cards - Member Images Only */}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />)}
        </div>
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
                            <span className="text-xs">
                              {format(new Date(evt.event_date), "dd/MM/yyyy")}
                            </span>
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
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                className="w-64 h-64 rounded-xl object-cover shadow-lg"
              />
              <p className="text-lg font-semibold">{selectedPhoto.name}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Dashboard;
