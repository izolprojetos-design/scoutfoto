import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ImageIcon, Cloud, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CloudPhotoPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (file: File) => void;
}

interface StorageImage {
  name: string;
  url: string;
  scoutName?: string;
}

const CloudPhotoPickerDialog = ({ open, onClose, onSelect }: CloudPhotoPickerDialogProps) => {
  const [images, setImages] = useState<StorageImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadImages();
  }, [open]);

  const loadImages = async () => {
    setLoading(true);
    try {
      // Load scouts to map IDs and names
      const { data: scoutsData } = await supabase.from('scouts').select('id, name');
      const scoutIdMap = new Map<string, string>();
      const scoutNames: string[] = [];
      scoutsData?.forEach(s => {
        scoutIdMap.set(s.id, s.name);
        scoutNames.push(s.name);
      });

      // Fuzzy match: normalize filename to compare with scout names
      const normalizeName = (str: string) =>
        str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

      const findScoutByFilename = (filename: string): string | undefined => {
        const baseName = filename.split('.')[0];
        // First try UUID match
        const byId = scoutIdMap.get(baseName);
        if (byId) return byId;
        // Then try approximate name match
        const normalized = normalizeName(baseName);
        for (const name of scoutNames) {
          if (normalizeName(name) === normalized) return name;
        }
        // Partial match: check if normalized filename contains a scout name or vice versa
        for (const name of scoutNames) {
          const nn = normalizeName(name);
          if (normalized.includes(nn) || nn.includes(normalized)) return name;
        }
        return undefined;
      };

      // List files from scout-photos bucket
      const { data: scoutPhotos } = await supabase.storage.from('scout-photos').list('', {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      const items: StorageImage[] = [];

      if (scoutPhotos) {
        for (const file of scoutPhotos) {
          // Skip folders (like 'avatars') and hidden files
          if (!file.name || file.name.startsWith('.') || file.id === null || !file.metadata) continue;
          const { data: signedData } = await supabase.storage.from('scout-photos').createSignedUrl(file.name, 3600);
          if (signedData?.signedUrl) {
            items.push({ name: file.name, url: signedData.signedUrl, scoutName: findScoutByFilename(file.name) });
          }
        }
      }

      // Also list from images bucket (signed URLs since it's private)
      const { data: privateImages } = await supabase.storage.from('images').list('', {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (privateImages) {
        for (const file of privateImages) {
          if (!file.name || file.name.startsWith('.') || file.name.startsWith('thumb_') || !file.metadata) continue;
          const { data } = await supabase.storage.from('images').createSignedUrl(file.name, 3600);
          if (data?.signedUrl) {
            items.push({ name: file.name, url: data.signedUrl });
          }
        }
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

  const filtered = images.filter(img => {
    const q = search.toLowerCase();
    return img.name.toLowerCase().includes(q) || (img.scoutName?.toLowerCase().includes(q) ?? false);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Escolher Foto da Nuvem
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
              <p className="text-xs mt-1">O armazenamento ainda não possui fotos</p>
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
                  {img.scoutName && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate text-center">
                      {img.scoutName}
                    </div>
                  )}
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
