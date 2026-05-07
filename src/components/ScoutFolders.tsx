import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getSignedUrlsBatch } from '@/lib/storageUtils';
import { compressImage } from '@/lib/imageCompression';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Folder, ChevronRight, ImageIcon, ArrowLeft, Download, Upload, UploadCloud } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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

const MAX_SIZE_MB = 10;

export default function ScoutFolders({ scoutId, scoutName }: Props) {
  const { user, isAdmin, isVoluntario } = useAuth();
  const canManage = isAdmin || isVoluntario;

  const [photos, setPhotos] = useState<PhotoRec[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PhotoRec | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [photoDate, setPhotoDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scout_photos' as any)
      .select('id, storage_path, created_at')
      .eq('scout_id', scoutId)
      .order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar pastas'); setLoading(false); return; }
    const list = (data || []) as unknown as PhotoRec[];
    setPhotos(list);
    if (list.length) {
      const urls = await getSignedUrlsBatch('scout-photos', list.map(p => p.storage_path), 3600);
      setSignedUrls(urls);
    }
    setLoading(false);
  }, [scoutId]);

  useEffect(() => { load(); }, [load]);

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

  const openUploadDialog = (files: FileList | null) => {
    if (!files || !files.length) return;
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!valid.length) return toast.error('Selecione apenas imagens.');
    setPendingFiles(valid);
    // Pre-fill date from current view if user is inside a date folder/year
    if (dateKey) {
      setPhotoDate(dateKey);
    } else if (year !== null) {
      setPhotoDate(`${year}-${format(new Date(), 'MM-dd')}`);
    } else {
      setPhotoDate(format(new Date(), 'yyyy-MM-dd'));
    }
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    if (!user || !pendingFiles.length) return;
    if (!photoDate) return toast.error('Selecione a data da foto.');

    setUploading(true);
    setProgress({ current: 0, total: pendingFiles.length });
    let success = 0;

    // Build a timestamp that puts the photos in the chosen day's folder.
    // Use noon UTC-safe timestamp from the YYYY-MM-DD string.
    const baseTs = new Date(`${photoDate}T12:00:00`).toISOString();

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      setProgress({ current: i + 1, total: pendingFiles.length });
      try {
        if (file.size > MAX_SIZE_MB * 1024 * 1024 * 4) {
          toast.warning(`"${file.name}" muito grande, ignorado.`);
          continue;
        }
        const compressed = await compressImage(file);
        const ext = (compressed.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const path = `gallery/${scoutId}/${photoDate}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('scout-photos')
          .upload(path, compressed, { upsert: false, contentType: compressed.type });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from('scout_photos' as any).insert({
          scout_id: scoutId,
          storage_path: path,
          caption: '',
          uploaded_by: user.id,
          file_size: compressed.size,
          mime_type: compressed.type,
          created_at: baseTs,
        });
        if (dbErr) {
          await supabase.storage.from('scout-photos').remove([path]);
          throw dbErr;
        }
        success++;
      } catch (err: any) {
        console.error('upload err', err);
        toast.error(`Falha ao enviar "${file.name}": ${err.message || 'erro'}`);
      }
    }

    setUploading(false);
    setProgress({ current: 0, total: 0 });
    setPendingFiles([]);
    setUploadOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (success > 0) {
      toast.success(`${success} foto(s) enviada(s) para ${format(new Date(`${photoDate}T12:00:00`), "dd/MM/yyyy")}`);
      // Navigate user to the year/date folder of the upload
      const newYear = new Date(`${photoDate}T12:00:00`).getFullYear();
      setYear(newYear);
      setDateKey(photoDate);
      await load();
    }
  };

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!canManage) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      openUploadDialog(files);
    }
  }, [canManage]);

  return (
    <div
      className="space-y-3 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && canManage && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex flex-col items-center justify-center gap-3 pointer-events-none">
          <UploadCloud className="h-10 w-10 text-primary animate-bounce" />
          <p className="text-sm font-medium text-primary">Solte as imagens aqui para enviar</p>
        </div>
      )}

      {/* Upload toolbar */}
      {canManage && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Envie fotos selecionando a data — elas serão organizadas automaticamente em <strong>Ano › Data</strong>.
          </p>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar fotos
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => openUploadDialog(e.target.files)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !photos.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <Folder className="h-12 w-12 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma foto cadastrada para gerar pastas</p>
          {canManage && (
            <p className="text-xs mt-1">Clique em <strong>Enviar fotos</strong> acima para começar.</p>
          )}
        </div>
      ) : (
        <>
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
                <button onClick={() => setDateKey(null)} className="font-medium hover:underline">
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
        </>
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

      {/* Upload confirmation dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!uploading) setUploadOpen(v); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar fotos para {scoutName}</DialogTitle>
            <DialogDescription>
              Defina a data da foto. Ela será arquivada na pasta correspondente <strong>Ano › Data</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <strong>{pendingFiles.length}</strong> arquivo{pendingFiles.length !== 1 ? 's' : ''} selecionado{pendingFiles.length !== 1 ? 's' : ''}.
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo-date">Data da foto *</Label>
              <Input
                id="photo-date"
                type="date"
                value={photoDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setPhotoDate(e.target.value)}
                className="h-12 text-base"
                disabled={uploading}
              />
              {photoDate && (
                <p className="text-xs text-muted-foreground">
                  Será salvo em: <strong>{new Date(`${photoDate}T12:00:00`).getFullYear()}</strong> ›{' '}
                  <strong>{format(new Date(`${photoDate}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })}</strong>
                </p>
              )}
            </div>

            {uploading && (
              <div className="space-y-1">
                <p className="text-sm">Enviando {progress.current} de {progress.total}…</p>
                <div className="h-2 w-full bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setUploadOpen(false); setPendingFiles([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !pendingFiles.length} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar {pendingFiles.length} foto{pendingFiles.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
