import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ImageIcon, Cloud, Check, Filter, X, Copy, Info } from 'lucide-react';
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
  const [search, setSearch] = useState(initialSearch || '');
  const [sectionFilter, setSectionFilter] = useState<string>(ALL);
  const [subgroupFilter, setSubgroupFilter] = useState<string>(ALL);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialSearch) setSearch(initialSearch);
      loadImages();
    }
  }, [open, initialSearch]);

  // Reset subgroup filter when section changes
  useEffect(() => {
    setSubgroupFilter(ALL);
  }, [sectionFilter]);

  const loadImages = async () => {
    setLoading(true);
    try {
      // Load scouts (with section + subgroup) and subgroups for mapping
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

      // List files from scout-photos bucket
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
          // Only include photos that can be mapped to a member as per "trazer apenas a Foto do integrante"
          if (scout) {
            scoutPathsToSign.push({ path: file.name, scout, name: file.name, createdAt: file.created_at });
          }
        }
      }

      // Sign all URLs in parallel (batched, single round-trip)
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

  // Distinct section/subgroup options derived from loaded images
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
        return dateB - dateA; // Newest first
      });
  }, [images, search, sectionFilter, subgroupFilter]);

  const activeFilterCount =
    (sectionFilter !== ALL ? 1 : 0) + (subgroupFilter !== ALL ? 1 : 0);

  const clearFilters = () => {
    setSectionFilter(ALL);
    setSubgroupFilter(ALL);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Escolher Foto da Nuvem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite o nome ou ID (ex: abc12345)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Filtros:</span>
            </div>

            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[140px] text-sm">
                <SelectValue placeholder="Seção" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
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
              <SelectTrigger className="h-9 w-auto min-w-[140px] text-sm">
                <SelectValue placeholder="Equipe" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
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
                className="h-9 px-2 text-xs"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} de {images.length}
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: '50vh' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ImageIcon className="h-10 w-10 mb-3" />
              <p className="text-sm font-medium">Nenhuma foto encontrada</p>
              <p className="text-xs mt-1">
                {images.length === 0
                  ? 'O armazenamento ainda não possui fotos'
                  : 'Tente ajustar os filtros ou a busca'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
              {filtered.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setSelectedUrl(selectedUrl === img.url ? null : img.url)}
                  className={cn(
                    "relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:opacity-90 group",
                    selectedUrl === img.url
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent"
                  )}
                >
                  <img
                    src={img.url}
                    alt={img.scoutName || img.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 text-white p-2 flex flex-col items-center justify-center text-center leading-tight">
                    <div className="font-bold w-full truncate text-[11px] mb-1">
                      {img.scoutName ? img.scoutName.toUpperCase() : img.name.split('.')[0]}
                    </div>
                    <div className="flex flex-col items-center gap-1 w-full">
                      {img.scoutId && (
                        <div className="bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded text-[9px] font-mono font-medium">
                          ID: {img.scoutId.slice(0, 8)}
                        </div>
                      )}
                      {img.createdAt && (
                        <div className="opacity-90 text-[9px] font-medium">
                          📅 {new Date(img.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedUrl === img.url && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedUrl || confirming}
          >
            {confirming ? 'Carregando...' : 'Usar esta foto'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CloudPhotoPickerDialog;
