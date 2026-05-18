import { useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ImageIcon, Cloud, Check, Filter, X, Copy, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CloudPhotoPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (file: File) => void;
  initialSearch?: string;
}

interface StorageImage {
  name: string;
  url: string;
  scoutName?: string;
  scoutId?: string;
  section?: string;
  subgroupId?: string;
  subgroupName?: string;
  createdAt?: string;
}

const ALL = '__all__';

const CloudPhotoPickerDialog = ({ open, onClose, onSelect, initialSearch }: CloudPhotoPickerDialogProps) => {
  const { toast } = useToast();
  const [images, setImages] = useState<StorageImage[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Load initial filters from localStorage or props
  const [search, setSearch] = useState(() => {
    if (initialSearch) return initialSearch;
    return localStorage.getItem('cloud_gallery_search') || '';
  });
  const [sectionFilter, setSectionFilter] = useState<string>(() => {
    return localStorage.getItem('cloud_gallery_section') || ALL;
  });
  const [subgroupFilter, setSubgroupFilter] = useState<string>(() => {
    return localStorage.getItem('cloud_gallery_subgroup') || ALL;
  });
  
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const firstResultRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      if (initialSearch) {
        setSearch(initialSearch);
      }
      loadImages();
    }
  }, [open, initialSearch]);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem('cloud_gallery_search', search);
    localStorage.setItem('cloud_gallery_section', sectionFilter);
    localStorage.setItem('cloud_gallery_subgroup', subgroupFilter);
  }, [search, sectionFilter, subgroupFilter]);

  // Reset subgroup filter when section changes
  useEffect(() => {
    if (sectionFilter !== ALL) {
      setSubgroupFilter(ALL);
    }
  }, [sectionFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(20);
  }, [search, sectionFilter, subgroupFilter]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const [scoutsRes, subgroupsRes] = await Promise.all([
        supabase.from('scouts').select('id, name, section, subgroup_id'),
        supabase.from('subgroups').select('id, name'),
      ]);

      const subgroupMap = new Map<string, string>();
      subgroupsRes.data?.forEach(sg => subgroupMap.set(sg.id, sg.name));

      type ScoutInfo = { id: string; name: string; section: string | null; subgroupId: string | null; subgroupName?: string };
      const scoutById = new Map<string, ScoutInfo>();
      const scoutByNormalizedName = new Map<string, ScoutInfo>();

      const normalizeName = (str: string) =>
        str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

      scoutsRes.data?.forEach(s => {
        const info: ScoutInfo = {
          id: s.id,
          name: s.name,
          section: s.section,
          subgroupId: s.subgroup_id,
          subgroupName: s.subgroup_id ? subgroupMap.get(s.subgroup_id) : undefined,
        };
        scoutById.set(s.id, info);
        scoutByNormalizedName.set(normalizeName(s.name), info);
      });

      const findScoutByFilename = (filename: string): ScoutInfo | undefined => {
        const baseName = filename.split('.')[0];
        const byId = scoutById.get(baseName);
        if (byId) return byId;
        const normalized = normalizeName(baseName);
        const exact = scoutByNormalizedName.get(normalized);
        if (exact) return exact;
        for (const [nn, info] of scoutByNormalizedName) {
          if (normalized.includes(nn) || nn.includes(normalized)) return info;
        }
        return undefined;
      };

      const { data: scoutPhotos } = await supabase.storage.from('scout-photos').list('', {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      const { getSignedUrlsBatch } = await import('@/lib/storageUtils');

      const items: StorageImage[] = [];
      const scoutPathsToSign: { path: string; scout?: ScoutInfo; name: string; createdAt?: string }[] = [];

      if (scoutPhotos) {
        for (const file of scoutPhotos) {
          if (!file.name || file.name.startsWith('.') || file.id === null || !file.metadata) continue;
          const scout = findScoutByFilename(file.name);
          if (scout) {
            scoutPathsToSign.push({ path: file.name, scout, name: file.name, createdAt: file.created_at });
          }
        }
      }

      const scoutUrlMap = await getSignedUrlsBatch('scout-photos', scoutPathsToSign.map(p => p.path), 3600);

      for (const item of scoutPathsToSign) {
        const url = scoutUrlMap[item.path];
        if (!url) continue;
        items.push({
          name: item.name,
          url,
          scoutName: item.scout?.name,
          scoutId: item.scout?.id,
          section: item.scout?.section ?? undefined,
          subgroupId: item.scout?.subgroupId ?? undefined,
          subgroupName: item.scout?.subgroupName,
          createdAt: item.createdAt,
        });
      }

      setImages(items);
    } catch (err) {
      console.error('Error loading cloud images:', err);
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!selectedUrl) return;
    setConfirming(true);
    try {
      const response = await fetch(selectedUrl);
      const blob = await response.blob();
      const ext = selectedUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const file = new File([blob], `cloud-photo.${ext}`, { type: blob.type || 'image/jpeg' });
      onSelect(file);
      onClose();
    } catch (err) {
      console.error('Error fetching image:', err);
    }
    setConfirming(false);
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const shortId = id.slice(0, 8);
    navigator.clipboard.writeText(shortId);
    toast({
      description: `ID ${shortId} copiado!`,
      duration: 2000,
    });
  };

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    images.forEach(img => { if (img.section) set.add(img.section); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [images]);

  const availableSubgroups = useMemo(() => {
    const map = new Map<string, string>();
    images.forEach(img => {
      if (img.subgroupId && img.subgroupName) {
        if (sectionFilter !== ALL && img.section !== sectionFilter) return;
        map.set(img.subgroupId, img.subgroupName);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [images, sectionFilter]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return images
      .filter(img => {
        if (sectionFilter !== ALL && img.section !== sectionFilter) return false;
        if (subgroupFilter !== ALL && img.subgroupId !== subgroupFilter) return false;
        if (!q) return true;
        return (
          img.name.toLowerCase().includes(q) ||
          (img.scoutId?.toLowerCase().includes(q) ?? false) ||
          (img.scoutName?.toLowerCase().includes(q) ?? false) ||
          (img.subgroupName?.toLowerCase().includes(q) ?? false) ||
          (img.section?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
  }, [images, search, sectionFilter, subgroupFilter]);

  const activeFilterCount = (sectionFilter !== ALL ? 1 : 0) + (subgroupFilter !== ALL ? 1 : 0);

  const clearFilters = () => {
    setSectionFilter(ALL);
    setSubgroupFilter(ALL);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Cloud className="h-6 w-6 text-primary" />
            Galeria da Nuvem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite o nome ou ID (ex: abc12345)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 border-primary/20 focus-visible:ring-primary/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Filtros Rápidos:</span>
            </div>

            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs bg-muted/50 border-transparent hover:bg-muted transition-colors">
                <SelectValue placeholder="Seção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as seções</SelectItem>
                {availableSections.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={subgroupFilter}
              onValueChange={setSubgroupFilter}
              disabled={availableSubgroups.length === 0}
            >
              <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs bg-muted/50 border-transparent hover:bg-muted transition-colors">
                <SelectValue placeholder="Equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as equipes</SelectItem>
                {availableSubgroups.map(sg => (
                  <SelectItem key={sg.id} value={sg.id}>{sg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(activeFilterCount > 0 || search) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Limpar Busca
              </Button>
            )}

            <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {filtered.length} {filtered.length === 1 ? 'foto' : 'fotos'}
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-[300px] border rounded-xl bg-muted/20 p-2" style={{ maxHeight: '50vh' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-xs text-muted-foreground font-medium animate-pulse">Sincronizando com a nuvem...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-in fade-in zoom-in duration-300">
              <div className="bg-muted rounded-full p-4 mb-4">
                <ImageIcon className="h-10 w-10 opacity-50" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhuma foto encontrada</p>
              <p className="text-xs mt-2 max-w-[250px] text-center leading-relaxed">
                {images.length === 0
                  ? 'O armazenamento ainda não possui fotos vinculadas a integrantes.'
                  : 'Tente buscar por outro termo ou remova os filtros ativos para ver mais resultados.'}
              </p>
              {images.length === 0 && (
                <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10 flex items-start gap-3 max-w-sm">
                  <Info className="h-4 w-4 text-primary mt-0.5" />
                  <p className="text-[11px] text-primary-foreground/70 leading-normal">
                    <span className="font-bold text-primary block mb-1 text-[12px]">Dica:</span>
                    Certifique-se de que os arquivos na nuvem tenham o nome ou ID do integrante no nome do arquivo.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((img) => (
                <div key={img.url} className="relative group">
                  <button
                    type="button"
                    onClick={() => setSelectedUrl(selectedUrl === img.url ? null : img.url)}
                    className={cn(
                      "relative aspect-square w-full rounded-lg overflow-hidden border-2 transition-all hover:opacity-95",
                      selectedUrl === img.url
                        ? "border-primary shadow-lg ring-2 ring-primary/20 scale-[0.98]"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <img
                      src={img.url}
                      alt={img.scoutName || img.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent text-white p-2.5 flex flex-col items-center justify-end text-center h-2/3">
                      <div className="font-bold w-full truncate text-[10px] sm:text-[11px] mb-1.5 leading-tight">
                        {img.scoutName ? img.scoutName.toUpperCase() : img.name.split('.')[0]}
                      </div>
                      <div className="flex flex-col items-center gap-1 w-full">
                        {img.scoutId && (
                          <div className="bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-tight">
                            ID: {img.scoutId.slice(0, 8)}
                          </div>
                        )}
                        {img.createdAt && (
                          <div className="opacity-80 text-[8px] sm:text-[9px] font-medium flex items-center gap-1">
                            📅 {new Date(img.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedUrl === img.url && (
                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-xl scale-110">
                          <Check className="h-4 w-4 stroke-[3px]" />
                        </div>
                      </div>
                    )}
                  </button>
                  {img.scoutId && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:scale-110 active:scale-95 bg-white/90 hover:bg-white text-black border-none"
                      onClick={(e) => handleCopyId(e, img.scoutId!)}
                      title="Copiar ID"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between gap-4 pt-4 mt-2 border-t">
          <p className="text-[10px] text-muted-foreground hidden sm:block italic">
            * Clique em uma foto para selecionar e depois em usar.
          </p>
          <div className="flex gap-2 ml-auto">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="h-10 px-6 font-medium text-xs sm:text-sm"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedUrl || confirming}
              className="h-10 px-8 font-bold text-xs sm:text-sm shadow-md"
            >
              {confirming ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Carregando...
                </>
              ) : 'Usar esta foto'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CloudPhotoPickerDialog;
