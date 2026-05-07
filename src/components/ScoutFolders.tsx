import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSignedUrlsBatch } from '@/lib/storageUtils';
import { Button } from '@/components/ui/button';
import { Loader2, Folder, ChevronRight, ImageIcon, ArrowLeft, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface PhotoRec {
  id: string;
  storage_path: string;
  created_at: string;
}

interface Props {
  scoutId: string;
  scoutName: string;
}

export default function ScoutFolders({ scoutId, scoutName }: Props) {
  const [photos, setPhotos] = useState<PhotoRec[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PhotoRec | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('scout_photos' as any)
        .select('id, storage_path, created_at')
        .eq('scout_id', scoutId)
        .order('created_at', { ascending: false });
      if (cancel) return;
      if (error) { toast.error('Erro ao carregar pastas'); setLoading(false); return; }
      const list = (data || []) as unknown as PhotoRec[];
      setPhotos(list);
      if (list.length) {
        const urls = await getSignedUrlsBatch('scout-photos', list.map(p => p.storage_path), 3600);
        if (!cancel) setSignedUrls(urls);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [scoutId]);

  // Year aggregation
  const years = useMemo(() => {
    const map = new Map<number, PhotoRec[]>();
    for (const p of photos) {
      const y = new Date(p.created_at).getFullYear();
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [photos]);

  // Dates inside selected year
  const dates = useMemo(() => {
    if (year === null) return [];
    const items = photos.filter(p => new Date(p.created_at).getFullYear() === year);
    const map = new Map<string, PhotoRec[]>();
    for (const p of items) {
      const key = format(new Date(p.created_at), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [photos, year]);

  const photosOfDate = useMemo(() => {
    if (!dateKey) return [];
    return photos.filter(p => format(new Date(p.created_at), 'yyyy-MM-dd') === dateKey);
  }, [photos, dateKey]);

  const handleDownload = async (p: PhotoRec) => {
    try {
      const url = signedUrls[p.storage_path];
      if (!url) return;
      const res = await fetch(url);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = obj;
      a.download = `${scoutName.replace(/\s+/g, '_')}-${p.id.slice(0, 8)}.jpg`;
      a.click();
      URL.revokeObjectURL(obj);
    } catch { toast.error('Falha ao baixar'); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!photos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <Folder className="h-12 w-12 mb-2 opacity-40" />
        <p className="text-sm">Nenhuma foto cadastrada para gerar pastas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <button
          onClick={() => { setYear(null); setDateKey(null); }}
          className="font-medium uppercase break-words text-left hover:underline"
        >
          {scoutName}
        </button>
        {year !== null && (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => setDateKey(null)}
              className="font-medium hover:underline"
            >
              {year}
            </button>
          </>
        )}
        {dateKey && (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {format(new Date(dateKey + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
            </span>
          </>
        )}
      </div>

      {(year !== null || dateKey) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { dateKey ? setDateKey(null) : setYear(null); }}
          className="gap-1 h-8"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      )}

      {/* Level 1: Years */}
      {year === null && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {years.map(([y, items]) => {
            const cover = items[0];
            const url = cover ? signedUrls[cover.storage_path] : null;
            return (
              <button
                key={y}
                onClick={() => setYear(y)}
                className="group relative aspect-square rounded-lg overflow-hidden border bg-muted text-left"
              >
                {url ? (
                  <img src={url} alt={`Ano ${y}`} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 opacity-30" /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5" />
                    <div>
                      <div className="font-bold text-lg leading-none">{y}</div>
                      <div className="text-xs opacity-90">{items.length} foto{items.length > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Level 2: Dates within year */}
      {year !== null && !dateKey && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {dates.map(([key, items]) => {
            const cover = items[0];
            const url = cover ? signedUrls[cover.storage_path] : null;
            return (
              <button
                key={key}
                onClick={() => setDateKey(key)}
                className="group relative aspect-square rounded-lg overflow-hidden border bg-muted text-left"
              >
                {url ? (
                  <img src={url} alt={key} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 opacity-30" /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                  <div className="flex items-center gap-1.5">
                    <Folder className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-tight">
                        {format(new Date(key + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}
                      </div>
                      <div className="text-[10px] opacity-90">{items.length} foto{items.length > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Level 3: Photos of date */}
      {dateKey && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photosOfDate.map(p => {
            const url = signedUrls[p.storage_path];
            return (
              <button
                key={p.id}
                onClick={() => setViewing(p)}
                className="group relative aspect-square rounded-lg overflow-hidden border bg-muted"
              >
                {url ? (
                  <img src={url} alt="Foto" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 opacity-30" /></div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-4xl p-2 max-h-[90vh]">
          <DialogHeader className="sr-only"><DialogTitle>Foto</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <img
                src={signedUrls[viewing.storage_path]}
                alt="Foto"
                className="w-full h-auto max-h-[70vh] object-contain rounded"
              />
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(viewing.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleDownload(viewing)} className="gap-2">
                  <Download className="h-4 w-4" /> Baixar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
