import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, User, Download, Filter, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { getCurrentBranch, formatAge, parseLocalDate, ALL_CATEGORIES } from '@/lib/scoutUtils';
import ScoutPhoto from '@/components/ScoutPhoto';
import ScoutAvatar from '@/components/ScoutAvatar';
import { SECTION_OPTIONS, parseVolunteerSection } from '@/lib/sectionOptions';
import { useUserSection } from '@/hooks/useUserSection';
import { DataEmptyState, classifyLoadError, type LoadState } from '@/components/DataEmptyState';

interface Scout {
  id: string;
  name: string;
  birth_date: string;
  scout_group: string;
  photo_url: string | null;
  manual_branch: string | null;
  subgroup_id: string | null;
  registration_id: string;
  phone: string;
  section: string;
}

interface BranchData {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

interface Subgroup {
  id: string;
  name: string;
  branch_key: string;
}

const BranchScouts = () => {
  const { branchKey } = useParams<{ branchKey: string }>();
  const navigate = useNavigate();
  const { section: userSection, isRestricted } = useUserSection();
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'ok' });
  const [branchData, setBranchData] = useState<BranchData | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ name: string; url: string } | null>(null);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [subgroupFilter, setSubgroupFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      // Se for um usuário restrito e tentar acessar um ramo que não é o dele, redireciona
      if (isRestricted && userSection && branchKey && branchKey.toLowerCase() !== userSection.toLowerCase()) {
        console.warn(`[BranchScouts] Usuário restrito à seção ${userSection} tentou acessar ${branchKey}`);
        navigate('/dashboard');
        return;
      }

      const [{ data: branchRes }, scoutResp, { data: subgroupData }] = await Promise.all([
        supabase.from('branches').select('*').eq('key', branchKey!).single(),
        supabase.from('scouts').select('*').eq('is_active', true).order('name'),
        supabase.from('subgroups').select('*'),
      ]);

      if (branchRes) {
        setBranchData(branchRes);
      } else {
        navigate('/dashboard');
        return;
      }

      const scoutRes = scoutResp.data;
      const scoutErr = scoutResp.error;
      const rows = scoutRes ?? [];
      setLoadState(classifyLoadError(scoutErr, rows.length));

      if (rows.length > 0) {
        const filtered = rows.filter(s => {
          let matchesBranch = false;
          if (s.manual_branch) {
            matchesBranch = s.manual_branch === branchKey;
          } else {
            const branch = getCurrentBranch(parseLocalDate(s.birth_date));
            matchesBranch = branch?.key === branchKey;
          }
          return matchesBranch;
        });
        setScouts(filtered);
      } else {
        setScouts([]);
      }
      if (subgroupData) setSubgroups(subgroupData as Subgroup[]);
      setLoading(false);
    };
    fetchData();
  }, [branchKey, isRestricted, userSection, navigate]);

  // Get unique sections from scouts for filter options
  const availableSections = useMemo(() => {
    const sections = new Set<string>();
    scouts.forEach(s => {
      if (s.section) sections.add(s.section);
    });
    return Array.from(sections).sort();
  }, [scouts]);

  // Get subgroups relevant to this branch
  const availableSubgroups = useMemo(() => {
    const scoutSubgroupIds = new Set(scouts.map(s => s.subgroup_id).filter(Boolean));
    return subgroups.filter(sg => scoutSubgroupIds.has(sg.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [scouts, subgroups]);

  // Filtered scouts
  const filteredScouts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return scouts.filter(s => {
      if (query && !s.name.toLowerCase().includes(query)) return false;
      if (sectionFilter !== 'all' && s.section !== sectionFilter) return false;
      if (subgroupFilter !== 'all') {
        if (subgroupFilter === 'none') {
          if (s.subgroup_id) return false;
        } else {
          if (s.subgroup_id !== subgroupFilter) return false;
        }
      }
      return true;
    });
  }, [scouts, sectionFilter, subgroupFilter, searchQuery]);

  const hasActiveFilters = sectionFilter !== 'all' || subgroupFilter !== 'all' || searchQuery !== '';

  if (!branchData && !loading) {
    return null;
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {branchData?.icon} {branchData?.display_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? `${filteredScouts.length} de ${scouts.length}` : scouts.length} integrantes
          </p>
        </div>
      </div>

      {/* Filters */}
      {!loading && scouts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 pl-8 pr-8 text-xs w-full sm:w-[220px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
          
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <SelectValue placeholder="Seção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Seções</SelectItem>
              {availableSections.map(section => (
                <SelectItem key={section} value={section} className="text-xs">
                  {section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={subgroupFilter} onValueChange={setSubgroupFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Equipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Equipes</SelectItem>
              <SelectItem value="none">Sem Equipe</SelectItem>
              {availableSubgroups.map(sg => (
                <SelectItem key={sg.id} value={sg.id} className="text-xs">
                  {sg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground"
              onClick={() => { setSectionFilter('all'); setSubgroupFilter('all'); setSearchQuery(''); }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : loadState.kind === 'denied' || loadState.kind === 'error' ? (
        <DataEmptyState state={loadState} />
      ) : filteredScouts.length === 0 ? (
        <DataEmptyState
          state={{ kind: 'empty' }}
          emptyTitle={hasActiveFilters ? 'Nenhum integrante encontrado com os filtros selecionados' : 'Nenhum integrante cadastrado neste ramo'}
          icon={<span className="mb-2 text-4xl">{branchData?.icon}</span>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredScouts.map((scout, index) => (
            <motion.div
              key={scout.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(index * 0.03, 0.5) }}
              className="group cursor-pointer overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
              onClick={async () => {
                if (scout.photo_url) {
                  const { getSignedPhotoUrl } = await import('@/lib/storageUtils');
                  const signed = await getSignedPhotoUrl(scout.photo_url);
                  if (signed) setSelectedPhoto({ name: scout.name, url: signed });
                }
              }}
            >
              <div className="aspect-square overflow-hidden bg-muted relative">
                <ScoutAvatar
                  name={scout.name}
                  photoUrl={scout.photo_url}
                  className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105 rounded-none"
                />
                {!scout.photo_url && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-bold uppercase shadow-sm">
                      Sem Foto
                    </Badge>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold break-words leading-tight whitespace-normal uppercase" style={{ overflowWrap: 'anywhere' }}>{scout.name}</p>
                <p className="text-xs text-muted-foreground">{formatAge(parseLocalDate(scout.birth_date))}</p>
                <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  {branchKey === 'voluntario' ? (() => {
                    const { secao, cargo1, cargo2 } = parseVolunteerSection(scout.section);
                    return (
                      <>
                        {secao && (
                          <div className="flex items-start gap-1">
                            <span className="font-medium text-foreground/70 w-[42px] shrink-0">Seção:</span>
                            <span>{secao}</span>
                          </div>
                        )}
                        {cargo1 && (
                          <div className="flex items-start gap-1">
                            <span className="font-medium text-foreground/70 shrink-0 whitespace-nowrap">1ª Função:</span>
                            <span className="break-words" style={{ overflowWrap: 'anywhere' }}>{cargo1}</span>
                          </div>
                        )}
                        {cargo2 && (
                          <div className="flex items-start gap-1">
                            <span className="font-medium text-foreground/70 shrink-0 whitespace-nowrap">2ª Função:</span>
                            <span className="break-words" style={{ overflowWrap: 'anywhere' }}>{cargo2}</span>
                          </div>
                        )}
                      </>
                    );
                  })() : scout.section && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground/70">Seção:</span>
                      <span>{scout.section}</span>
                    </div>
                  )}
                  {scout.subgroup_id && (() => {
                    const sg = subgroups.find(s => s.id === scout.subgroup_id);
                    return sg ? (
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground/70">Equipe:</span>
                        <Badge className="font-medium text-xs bg-accent text-accent-foreground">{sg.name}</Badge>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-md flex flex-col items-center gap-4">
          {selectedPhoto && (
            <>
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                className="w-64 h-64 rounded-xl object-cover shadow-lg"
              />
              <p className="text-lg font-semibold uppercase">{selectedPhoto.name}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const response = await fetch(selectedPhoto.url);
                    if (!response.ok) throw new Error('Not found');
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${selectedPhoto.name}.jpg`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    toast.error('Foto não disponível para download');
                  }
                }}
              >
                <Download className="h-4 w-4 mr-1" /> Baixar foto
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BranchScouts;
