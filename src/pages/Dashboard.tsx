import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/components/AppLayout';
import { motion } from 'framer-motion';
import { ImageIcon, Upload, Calendar, TrendingUp, ArrowRight, Users, ArrowRightLeft, Cake, User } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getCurrentBranch, getNextBranchChange, formatAge, formatMonthsLeft, SCOUT_BRANCHES } from '@/lib/scoutUtils';
import { format, differenceInDays, setYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

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
}

const branchColors: Record<string, string> = {
  lobinho: 'from-amber-500/15 to-amber-600/5 border-amber-200/50 hover:border-amber-300',
  escoteiro: 'from-emerald-500/15 to-emerald-600/5 border-emerald-200/50 hover:border-emerald-300',
  senior: 'from-red-500/15 to-red-600/5 border-red-200/50 hover:border-red-300',
  pioneiro: 'from-orange-500/15 to-orange-600/5 border-orange-200/50 hover:border-orange-300',
  adulto: 'from-purple-500/15 to-purple-600/5 border-purple-200/50 hover:border-purple-300',
  chefes: 'from-blue-500/15 to-blue-600/5 border-blue-200/50 hover:border-blue-300',
};

const PIE_COLORS: Record<string, string> = {
  lobinho: '#f59e0b',
  escoteiro: '#10b981',
  senior: '#ef4444',
  pioneiro: '#f97316',
};

const Dashboard = () => {
  const { profile, canUpload, isChefe } = useAuth();
  const [branches, setBranches] = useState<BranchWithCount[]>([]);
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalImages, setTotalImages] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<{ name: string; url: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const [branchRes, evtRes, scoutRes] = await Promise.all([
        supabase.from('branches').select('*').order('sort_order'),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('scouts').select('*').order('name'),
      ]);

      if (branchRes.data) {
        const withCounts = await Promise.all(
          branchRes.data.map(async (branch) => {
            const { count } = await supabase
              .from('images')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', branch.id);
            return { ...branch, imageCount: count || 0 };
          })
        );
        setBranches(withCounts);
        setTotalImages(withCounts.reduce((sum, b) => sum + b.imageCount, 0));
      }

      setTotalEvents(evtRes.count || 0);
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

  // Scouts changing branch soon (< 6 months)
  const upcomingChanges = scouts
    .map(s => {
      const change = getNextBranchChange(new Date(s.birth_date));
      return change ? { ...s, change } : null;
    })
    .filter((s): s is Scout & { change: NonNullable<ReturnType<typeof getNextBranchChange>> } => s !== null && s.change.monthsLeft <= 6)
    .sort((a, b) => a.change.monthsLeft - b.change.monthsLeft);

  // Upcoming birthdays (next 30 days)
  const now = new Date();
  const upcomingBirthdays = scouts
    .map(s => {
      const birth = new Date(s.birth_date);
      let nextBday = setYear(birth, now.getFullYear());
      if (nextBday < now) nextBday = setYear(birth, now.getFullYear() + 1);
      const daysUntil = differenceInDays(nextBday, now);
      return { ...s, nextBday, daysUntil };
    })
    .filter(s => s.daysUntil >= 0 && s.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // Distribution by branch
  const branchDistribution = SCOUT_BRANCHES.map(b => ({
    ...b,
    count: scouts.filter(s => getCurrentBranch(new Date(s.birth_date))?.key === b.key).length,
  }));

  return (
    <AppLayout>
      {/* Welcome Section */}
      <div className="mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {greeting()}, {profile?.name?.split(' ')[0]} 👋
            </h1>
            <p className="mt-1 text-muted-foreground">Gerencie seu Grupo Escoteiro Monte Caburaí-12º GEMC</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/scouts')} className="gap-2 shadow-sm">
              <Users className="h-4 w-4" /> Cadastrar Integrante
            </Button>
            {(canUpload || isChefe) && (
              <Button variant="outline" onClick={() => navigate('/events')} className="gap-2">
                <Calendar className="h-4 w-4" /> Eventos
              </Button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: ImageIcon, value: totalImages, label: 'Total de fotos', color: 'text-primary' },
          { icon: Calendar, value: totalEvents, label: 'Eventos', color: 'text-accent' },
          { icon: Users, value: scouts.length, label: 'Jovens', color: 'text-emerald-600' },
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
        {/* Branch Distribution - Pie Chart */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Jovens por Ramo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Cadastre jovens para ver a distribuição</p>
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
                      formatter={(value: number, name: string) => [`${value} jovens`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2">
                  {branchDistribution.map(b => (
                    <div key={b.key} className="flex items-center gap-2 text-xs">
                      <div className="h-3 w-3 rounded-full" style={{ background: PIE_COLORS[b.key] || '#8884d8' }} />
                      <span className="text-muted-foreground">{b.icon} {b.name}</span>
                      <span className="ml-auto font-semibold">{b.count}</span>
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
            {upcomingChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma mudança nos próximos 6 meses</p>
            ) : (
              upcomingChanges.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">→ {s.change.branch.icon} {s.change.branch.name}</p>
                  </div>
                  <Badge variant={s.change.monthsLeft <= 2 ? 'destructive' : 'secondary'} className="text-xs">
                    {formatMonthsLeft(s.change.monthsLeft)}
                  </Badge>
                </div>
              ))
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
                const branch = getCurrentBranch(new Date(s.birth_date));
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

      {/* Photos per Branch Bar Chart */}
      {branches.length > 0 && (
        <Card className="border shadow-sm mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Fotos por Ramo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={branches.map(b => ({ name: b.display_name, fotos: b.imageCount, key: b.key }))}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                  formatter={(value: number) => [`${value} fotos`]}
                />
                <Bar dataKey="fotos" radius={[6, 6, 0, 0]}>
                  {branches.map((b, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[b.key] || 'hsl(var(--primary))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Branch Cards */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Galerias por Ramo</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch, index) => (
            <motion.div key={branch.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + index * 0.06 }}>
              <Card
                className={`group cursor-pointer border bg-gradient-to-br transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${branchColors[branch.key] || 'from-muted/50 to-muted/20 border-border hover:border-primary/30'}`}
                onClick={() => navigate(`/gallery/${branch.key}`)}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{branch.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">{branch.display_name}</h3>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>{branch.imageCount} {branch.imageCount === 1 ? 'foto' : 'fotos'}</span>
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
    </AppLayout>
  );
};

export default Dashboard;
