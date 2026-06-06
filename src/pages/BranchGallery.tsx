import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft, Users, ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  getCurrentBranch, 
  parseLocalDate, 
  ALL_CATEGORIES 
} from '@/lib/scoutUtils';
import ScoutAvatar from '@/components/ScoutAvatar';

interface Scout {
  id: string;
  name: string;
  birth_date: string;
  photo_url: string | null;
  manual_branch: string | null;
  is_active: boolean;
}

const getEffectiveBranchKey = (scout: Scout) => {
  if (scout.manual_branch) {
    return ALL_CATEGORIES.find(b => b.key === scout.manual_branch) || getCurrentBranch(parseLocalDate(scout.birth_date));
  }
  return getCurrentBranch(parseLocalDate(scout.birth_date));
};

const BranchGallery = () => {
  const { user } = useAuth();
  const { canViewScouts } = usePermissions();
  const navigate = useNavigate();
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchScouts = async () => {
      try {
        const { data, error } = await supabase
          .from('scouts')
          .select('id, name, birth_date, photo_url, manual_branch, is_active')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setScouts(data || []);
      } catch (err) {
        console.error('Error fetching scouts for gallery:', err);
      } finally {
        setLoading(false);
      }
    };

    if (canViewScouts) {
      fetchScouts();
    }
  }, [canViewScouts]);

  const branchesWithScouts = useMemo(() => {
    const grouped = ALL_CATEGORIES.map(branch => {
      const branchScouts = scouts.filter(s => {
        const effectiveBranch = getEffectiveBranchKey(s);
        return effectiveBranch?.key === branch.key;
      });
      
      // Filtrar apenas quem tem foto conforme pedido do usuário
      const scoutsWithPhoto = branchScouts.filter(s => !!s.photo_url);

      return {
        ...branch,
        scouts: scoutsWithPhoto,
        totalInBranch: branchScouts.length
      };
    });
    return grouped.filter(b => b.totalInBranch > 0);
  }, [scouts]);

  const filteredBranches = useMemo(() => {
    if (!search) return branchesWithScouts;
    
    return branchesWithScouts.map(branch => ({
      ...branch,
      scouts: branch.scouts.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase())
      )
    })).filter(branch => branch.scouts.length > 0);
  }, [branchesWithScouts, search]);

  if (!canViewScouts) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center p-4 text-center">
        <Users className="mb-4 h-12 w-12 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Você não tem permissão para visualizar a galeria de integrantes.</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">Voltar ao Início</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-8 p-4 pb-20 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Galerias de Integrantes por Ramo</h1>
            <p className="text-muted-foreground">Visualização rápida de membros com foto</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar integrante pelo nome..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-4">
              <div className="h-8 w-48 animate-pulse rounded bg-muted" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {[1, 2, 3, 4, 5, 6].map(j => (
                  <div key={j} className="aspect-square animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground opacity-20" />
          <h3 className="text-lg font-medium">Nenhum integrante encontrado</h3>
          <p className="text-muted-foreground">Tente um termo de busca diferente ou verifique os ramos.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {filteredBranches.map(branch => (
            <section key={branch.key} className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{branch.icon}</span>
                  <h2 className="text-xl font-bold">{branch.name}</h2>
                  <Badge variant="secondary" className="ml-2">
                    {branch.scouts.length} com foto
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {branch.scouts.map(scout => (
                  <motion.div
                    key={scout.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    className="group relative flex flex-col items-center gap-2"
                  >
                    <Card className="h-full w-full overflow-hidden border-2 transition-colors hover:border-primary/50">
                      <CardContent className="p-0">
                        <div className="aspect-square relative overflow-hidden bg-muted">
                          <ScoutAvatar 
                            name={scout.name} 
                            photoUrl={scout.photo_url} 
                            className="h-full w-full rounded-none"
                          />
                        </div>
                        <div className="p-2 text-center">
                          <p className="line-clamp-2 text-xs font-semibold leading-tight sm:text-sm">
                            {scout.name}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchGallery;
