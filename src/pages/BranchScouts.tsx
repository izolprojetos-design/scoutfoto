import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, User, Download, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { getCurrentBranch, formatAge, parseLocalDate, ALL_CATEGORIES } from '@/lib/scoutUtils';
import ScoutPhoto from '@/components/ScoutPhoto';
import { SECTION_OPTIONS } from '@/lib/sectionOptions';

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
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchData, setBranchData] = useState<BranchData | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ name: string; url: string } | null>(null);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [subgroupFilter, setSubgroupFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: branchRes }, { data: scoutRes }, { data: subgroupData }] = await Promise.all([
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

      if (scoutRes) {
        const filtered = scoutRes.filter(s => {
          if (s.manual_branch) return s.manual_branch === branchKey;
          const branch = getCurrentBranch(parseLocalDate(s.birth_date));
          return branch?.key === branchKey;
        });
        setScouts(filtered);
      }
      if (subgroupData) setSubgroups(subgroupData as Subgroup[]);
      setLoading(false);
    };
    fetchData();
  }, [branchKey]);

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
    return scouts.filter(s => {
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
  }, [scouts, sectionFilter, subgroupFilter]);

  const hasActiveFilters = sectionFilter !== 'all' || subgroupFilter !== 'all';

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
          <Filter className="h-4 w-4 text-muted-foreground" />
          
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
              onClick={() => { setSectionFilter('all'); setSubgroupFilter('all'); }}
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
      ) : filteredScouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <span className="mb-2 text-4xl">{branchData?.icon}</span>
          <p>{hasActiveFilters ? 'Nenhum integrante encontrado com os filtros selecionados' : 'Nenhum integrante cadastrado neste ramo'}</p>
        </div>
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
              <div className="aspect-square overflow-hidden bg-muted">
                {scout.photo_url ? (
                  <ScoutPhoto
                    photoUrl={scout.photo_url}
                    alt={scout.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    fallback={
                      <div className="flex h-full items-center justify-center">
                        <User className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    }
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <User className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold break-words leading-tight whitespace-normal uppercase" style={{ overflowWrap: 'anywhere' }}>{scout.name}</p>
                <p className="text-xs text-muted-foreground">{formatAge(parseLocalDate(scout.birth_date))}</p>
                <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  {scout.section && (
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
