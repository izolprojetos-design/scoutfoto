import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, ArrowLeft, Camera, Users, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SCOUT_BRANCHES, ADULT_CATEGORIES, getCurrentBranch, parseLocalDate, formatAge } from '@/lib/scoutUtils';
import ScoutAvatar from '@/components/ScoutAvatar';
import ScoutGallery from '@/components/ScoutGallery';
import { toast } from 'sonner';
import { DataEmptyState, classifyLoadError, type LoadState } from '@/components/DataEmptyState';

interface Scout {
  id: string;
  name: string;
  birth_date: string;
  photo_url: string | null;
  manual_branch: string | null;
  section: string;
  is_active: boolean;
}

const ALL_TABS = [...SCOUT_BRANCHES, ...ADULT_CATEGORIES];

const ScoutPhotoGallery = () => {
  const navigate = useNavigate();
  const { isAdmin, isVoluntario } = useAuth();
  const { canViewScouts } = usePermissions();
  
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'ok' });
  const [search, setSearch] = useState('');
  const [selectedScout, setSelectedScout] = useState<Scout | null>(null);
  const [activeTab, setActiveTab] = useState(ALL_TABS[0].key);

  useEffect(() => {
    const fetchScouts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('scouts')
        .select('id, name, birth_date, photo_url, manual_branch, section, is_active')
        .eq('is_active', true)
        .order('name');

      const rows = data ?? [];
      const state = classifyLoadError(error, rows.length);
      setLoadState(state);
      setScouts(rows);
      if (state.kind === 'error') {
        console.error('Error fetching scouts:', error);
        toast.error('Erro ao carregar integrantes.');
      }
      setLoading(false);
    };

    fetchScouts();
  }, []);

  const filteredScouts = useMemo(() => {
    return scouts.filter(s => {
      // Filter by search
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase().trim());
      if (!matchesSearch) return false;

      // Filter by active branch tab
      let scoutBranch = '';
      if (s.manual_branch) {
        scoutBranch = s.manual_branch;
      } else {
        const branch = getCurrentBranch(parseLocalDate(s.birth_date));
        scoutBranch = branch?.key || '';
      }
      
      return scoutBranch === activeTab;
    });
  }, [scouts, search, activeTab]);

  if (!canViewScouts) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <Users className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Você não tem permissão para ver os integrantes.</p>
        <Button onClick={() => navigate('/dashboard')}>Voltar ao Início</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
              🖼️ Galerias dos Integrantes
            </h1>
            <p className="text-sm text-muted-foreground">
              Visualize todas as fotos organizadas por integrante e ramo.
            </p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto gap-1 bg-transparent p-0">
          {ALL_TABS.map((branch) => (
            <TabsTrigger
              key={branch.key}
              value={branch.key}
              className="flex items-center gap-2 rounded-lg border py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <span>{branch.icon}</span>
              <span className="hidden sm:inline">{branch.name}</span>
              <span className="sm:hidden">{branch.name.slice(0, 3)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {ALL_TABS.map((branch) => (
          <TabsContent key={branch.key} value={branch.key} className="mt-6 border-none p-0 outline-none">
            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : loadState.kind === 'denied' || loadState.kind === 'error' ? (
              <DataEmptyState state={loadState} />
            ) : filteredScouts.length === 0 ? (
              <DataEmptyState
                state={{ kind: 'empty' }}
                emptyTitle={`Nenhum integrante encontrado no ramo ${branch.name}.`}
                icon={<Camera className="mb-2 h-10 w-10 opacity-20" />}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <AnimatePresence mode="popLayout">
                  {filteredScouts.map((scout, idx) => (
                    <motion.div
                      key={scout.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.4) }}
                      className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md cursor-pointer"
                      onClick={() => setSelectedScout(scout)}
                    >
                      <div className="aspect-[4/5] overflow-hidden bg-muted">
                        <ScoutAvatar
                          name={scout.name}
                          photoUrl={scout.photo_url}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 rounded-none"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end p-3">
                          <Button variant="secondary" size="sm" className="w-full gap-2 text-xs h-8">
                            <ImageIcon className="h-3.5 w-3.5" />
                            Ver Galeria
                          </Button>
                        </div>
                      </div>
                      <div className="p-3 text-center">
                        <h3 className="text-sm font-bold uppercase truncate">{scout.name}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {scout.section || branch.name}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!selectedScout} onOpenChange={(open) => !open && setSelectedScout(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <ScoutAvatar name={selectedScout?.name || ''} photoUrl={selectedScout?.photo_url} className="h-10 w-10" />
              <div className="flex flex-col">
                <span className="uppercase">{selectedScout?.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Galeria de Fotos do Integrante
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {selectedScout && (
              <ScoutGallery 
                scoutId={selectedScout.id} 
                scoutName={selectedScout.name} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScoutPhotoGallery;
