import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/components/AppLayout';
import { motion } from 'framer-motion';
import { ImageIcon, Upload, Calendar, TrendingUp, ArrowRight } from 'lucide-react';

interface BranchWithCount {
  id: string;
  key: string;
  display_name: string;
  icon: string;
  sort_order: number;
  imageCount: number;
}

const branchColors: Record<string, string> = {
  lobinho: 'from-amber-500/15 to-amber-600/5 border-amber-200/50 hover:border-amber-300',
  escoteiro: 'from-emerald-500/15 to-emerald-600/5 border-emerald-200/50 hover:border-emerald-300',
  senior: 'from-red-500/15 to-red-600/5 border-red-200/50 hover:border-red-300',
  pioneiro: 'from-orange-500/15 to-orange-600/5 border-orange-200/50 hover:border-orange-300',
  adulto: 'from-purple-500/15 to-purple-600/5 border-purple-200/50 hover:border-purple-300',
  chefes: 'from-blue-500/15 to-blue-600/5 border-blue-200/50 hover:border-blue-300',
};

const Dashboard = () => {
  const { profile, canUpload, isChefe } = useAuth();
  const [branches, setBranches] = useState<BranchWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalImages, setTotalImages] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: branchData } = await supabase
        .from('branches')
        .select('*')
        .order('sort_order');

      if (branchData) {
        const withCounts = await Promise.all(
          branchData.map(async (branch) => {
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

      const { count: evtCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });
      setTotalEvents(evtCount || 0);

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

  return (
    <AppLayout>
      {/* Welcome Section */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {greeting()}, {profile?.name?.split(' ')[0]} 👋
            </h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie as fotos do seu grupo escoteiro
            </p>
          </div>
          <div className="flex gap-2">
            {canUpload && (
              <Button onClick={() => navigate('/upload')} className="gap-2 shadow-sm">
                <Upload className="h-4 w-4" />
                Nova Foto
              </Button>
            )}
            {(canUpload || isChefe) && (
              <Button variant="outline" onClick={() => navigate('/events')} className="gap-2">
                <Calendar className="h-4 w-4" />
                Eventos
              </Button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border bg-card shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{totalImages}</p>
                <p className="text-xs text-muted-foreground">Total de fotos</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border bg-card shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
                <Calendar className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{totalEvents}</p>
                <p className="text-xs text-muted-foreground">Eventos</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border bg-card shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{branches.length}</p>
                <p className="text-xs text-muted-foreground">Ramos ativos</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Branch Cards */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Galerias por Ramo</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch, index) => (
            <motion.div
              key={branch.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.06 }}
            >
              <Card
                className={`group cursor-pointer border bg-gradient-to-br transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${
                  branchColors[branch.key] || 'from-muted/50 to-muted/20 border-border hover:border-primary/30'
                }`}
                onClick={() => navigate(`/gallery/${branch.key}`)}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{branch.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {branch.display_name}
                      </h3>
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
    </AppLayout>
  );
};

export default Dashboard;