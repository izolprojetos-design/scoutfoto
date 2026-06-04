import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getSignedUrlsBatch } from '@/lib/storageUtils';
import { compressImage } from '@/lib/imageCompression';
import { Button } from '@/components/ui/button';
import {
  Loader2, Upload, Trash2, Download, ImageIcon, Star, ChevronLeft, ChevronRight, Pencil, Check, X,
  RotateCw, Crop as CropIcon, UserCircle, Camera, Folder, Plus,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import ImageCropper from '@/components/ImageCropper';
import { compressScoutPhoto } from '@/lib/imageCompression';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, isToday, isYesterday, isThisWeek, isThisMonth, isThisYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScoutPhotoRecord {
  id: string;
  scout_id: string;
  storage_path: string;
  caption: string;
  uploaded_by: string;
  created_at: string;
  file_size: number;
  mime_type: string;
  is_favorite: boolean;
}

interface Props {
  scoutId: string;
  scoutName: string;
  onPickStart?: () => void;
}

const MAX_SIZE_MB = 10;
const PAGE_SIZE = 30;

function groupLabel(d: Date) {
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  if (isThisWeek(d, { locale: ptBR })) return 'Esta semana';
  if (isThisMonth(d)) return 'Este mês';
  if (isThisYear(d)) return format(d, "MMMM 'de' yyyy", { locale: ptBR });
  return format(d, 'MMMM yyyy', { locale: ptBR });
}

export default function ScoutGallery({ scoutId, scoutName, onPickStart }: Props) {
  const { user, isAdmin, isVoluntario } = useAuth();
  const canManage = isAdmin || isVoluntario;

  const [photos, setPhotos] = useState<ScoutPhotoRecord[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<ScoutPhotoRecord | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isDragging, setIsDragging] = useState(false);

  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [savingCaption, setSavingCaption] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);
  const [processingAction, setProcessingAction] = useState<null | 'rotate' | 'crop' | 'profile'>(null);
  const [cropOpenFor, setCropOpenFor] = useState<ScoutPhotoRecord | null>(null);

  const refreshSignedUrl = useCallback(async (path: string) => {
    const urls = await getSignedUrlsBatch('scout-photos', [path], 3600);
    const fresh = urls[path];
    if (fresh) {
      // bust cache so the <img> reloads even if signed URL is unchanged
      const busted = fresh + (fresh.includes('?') ? '&' : '?') + 'r=' + Date.now();
      setSignedUrls(prev => ({ ...prev, [path]: busted }));
    }
  }, []);

  const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  const replacePhotoWithBlob = async (photo: ScoutPhotoRecord, blob: Blob) => {
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    const compressed = await compressImage(file);
    const { error: upErr } = await supabase.storage
      .from('scout-photos')
      .upload(photo.storage_path, compressed, { upsert: true, contentType: compressed.type });
    if (upErr) throw upErr;
    await supabase.from('scout_photos' as any)
      .update({ file_size: compressed.size, mime_type: compressed.type })
      .eq('id', photo.id);
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, file_size: compressed.size, mime_type: compressed.type } : p));
    await refreshSignedUrl(photo.storage_path);
  };

  const rotatePhoto = async (photo: ScoutPhotoRecord) => {
    const url = signedUrls[photo.storage_path];
    if (!url) return;
    setProcessingAction('rotate');
    try {
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.92)
      );
      await replacePhotoWithBlob(photo, blob);
      toast.success('Foto rotacionada');
    } catch (err: any) {
      console.error(err);
      toast.error('Falha ao rotacionar foto');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCropConfirm = async (file: File) => {
    const photo = cropOpenFor;
    setCropOpenFor(null);
    if (!photo) return;
    setProcessingAction('crop');
    try {
      await replacePhotoWithBlob(photo, file);
      toast.success('Foto recortada');
    } catch (err: any) {
      console.error(err);
      toast.error('Falha ao salvar recorte');
    } finally {
      setProcessingAction(null);
    }
  };

  const setAsProfile = async (photo: ScoutPhotoRecord) => {
    const url = signedUrls[photo.storage_path];
    if (!url || !user) return;
    setProcessingAction('profile');
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], 'profile.jpg', { type: blob.type || 'image/jpeg' });
      const compressed = await compressScoutPhoto(file);
      const ext = (compressed.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const safeName = scoutName
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      const idPrefix = scoutId.slice(0, 8);
      const path = `${safeName}_${idPrefix}.${ext}`;

      // Cleanup older profile files at bucket root (avoid removing gallery/* which is in subfolder)
      const { data: existing } = await supabase.storage.from('scout-photos').list('', { search: idPrefix });
      if (existing) {
        for (const f of existing) {
          if (f.name.includes(idPrefix) && f.name !== path) {
            await supabase.storage.from('scout-photos').remove([f.name]);
          }
        }
      }
      const { error: upErr } = await supabase.storage
        .from('scout-photos')
        .upload(path, compressed, { upsert: true, contentType: compressed.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('scouts').update({ photo_url: path }).eq('id', scoutId);
      if (dbErr) throw dbErr;
      toast.success('Definida como foto de perfil');
    } catch (err: any) {
      console.error(err);
      toast.error('Falha ao definir como foto de perfil');
    } finally {
      setProcessingAction(null);
    }
  };


  const saveInlineCaption = async (photo: ScoutPhotoRecord) => {
    const newCaption = inlineDraft.trim();
    if (newCaption === (photo.caption || '')) {
      setInlineEditId(null);
      return;
    }
    setInlineSaving(true);
    const { error } = await supabase
      .from('scout_photos' as any)
      .update({ caption: newCaption })
      .eq('id', photo.id);
    setInlineSaving(false);
    if (error) {
      toast.error('Não foi possível salvar a legenda');
      return;
    }
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, caption: newCaption } : p));
    setInlineEditId(null);
    toast.success('Legenda salva');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scout_photos' as any)
      .select('*')
      .eq('scout_id', scoutId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar fotos');
      setLoading(false);
      return;
    }
    const list = (data || []) as unknown as ScoutPhotoRecord[];
    setPhotos(list);
    if (list.length) {
      const urls = await getSignedUrlsBatch('scout-photos', list.map(p => p.storage_path), 3600);
      setSignedUrls(urls);
    } else {
      setSignedUrls({});
    }
    setLoading(false);
  }, [scoutId]);

  useEffect(() => { load(); }, [load]);

  // Filter + group
  const filtered = useMemo(
    () => showFavoritesOnly ? photos.filter(p => p.is_favorite) : photos,
    [photos, showFavoritesOnly]
  );

  // Realtime subscription for gallery
  useEffect(() => {
    const channel = supabase
      .channel(`scout-gallery-${scoutId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scout_photos',
          filter: `scout_id=eq.${scoutId}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scoutId, load]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const grouped = useMemo(() => {
    const map = new Map<string, ScoutPhotoRecord[]>();
    for (const p of visible) {
      const key = groupLabel(new Date(p.created_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [visible]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < filtered.length) {
        setVisibleCount(c => Math.min(c + PAGE_SIZE, filtered.length));
      }
    });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [visibleCount, filtered.length]);

  const requestUpload = (files: FileList | File[] | null) => {
    if (!files || !user) return;
    const arr = Array.from(files);
    const valid = arr.filter(f => f.type.startsWith('image/'));
    if (!valid.length) return toast.error('Selecione apenas imagens.');
    setPendingFiles(valid);
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length || !user) return;
    const valid = files;

    setUploading(true);
    setProgress({ current: 0, total: valid.length });
    let success = 0;

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      setProgress({ current: i + 1, total: valid.length });

      try {
        if (file.size > MAX_SIZE_MB * 1024 * 1024 * 4) {
          toast.warning(`"${file.name}" muito grande, ignorado.`);
          continue;
        }
        let compressed: File | Blob = file;
        try {
          compressed = await compressImage(file);
        } catch (cErr) {
          console.warn('compress failed, using original', cErr);
        }
        // Normaliza extensão/mime — câmera iOS pode entregar HEIC que o Storage rejeita
        let mime = (compressed as File).type || file.type || 'image/jpeg';
        let ext = (mime.split('/')[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
        if (ext === 'heic' || ext === 'heif' || !['jpg', 'png', 'webp'].includes(ext)) {
          ext = 'jpg';
          mime = 'image/jpeg';
        }
        
        const now = new Date();
        const year = now.getFullYear();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = format(now, 'HHmm');
        const safeName = scoutName
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_\-]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .substring(0, 30);

        const path = `gallery/${scoutId}/${year}/${dateStr}/${safeName}_${dateStr}_${timeStr}_${Math.random().toString(36).slice(2, 6)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('scout-photos')
          .upload(path, compressed, { upsert: false, contentType: mime });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from('scout_photos' as any).insert({
          scout_id: scoutId,
          storage_path: path,
          caption: '',
          uploaded_by: user.id,
          file_size: (compressed as File).size ?? file.size,
          mime_type: mime,
        });
        if (dbErr) {
          await supabase.storage.from('scout-photos').remove([path]);
          throw dbErr;
        }
        success++;
      } catch (err: any) {
        console.error('upload err', err);
        toast.error(`Falha ao enviar "${file.name}": ${err?.message || 'erro desconhecido'}`);
      }
    }

    setUploading(false);
    setProgress({ current: 0, total: 0 });
    if (success > 0) {
      toast.success(`${success} foto(s) enviada(s)`);
      load();
    }
  };

  const handleDelete = async (photo: ScoutPhotoRecord) => {
    const { error: dbErr } = await supabase.from('scout_photos' as any).delete().eq('id', photo.id);
    if (dbErr) { toast.error('Erro ao excluir foto'); return; }
    await supabase.storage.from('scout-photos').remove([photo.storage_path]);
    toast.success('Foto excluída');
    setDeleting(null);
    load();
  };

  const toggleFavorite = async (photo: ScoutPhotoRecord) => {
    const next = !photo.is_favorite;
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_favorite: next } : p));
    const { error } = await supabase
      .from('scout_photos' as any)
      .update({ is_favorite: next })
      .eq('id', photo.id);
    if (error) {
      toast.error('Não foi possível atualizar favorito');
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_favorite: !next } : p));
    }
  };

  const saveCaption = async (photo: ScoutPhotoRecord) => {
    const newCaption = captionDraft.trim();
    setSavingCaption(true);
    const { error } = await supabase
      .from('scout_photos' as any)
      .update({ caption: newCaption })
      .eq('id', photo.id);
    setSavingCaption(false);
    if (error) {
      toast.error('Não foi possível salvar a legenda');
      return;
    }
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, caption: newCaption } : p));
    setEditingCaption(false);
    toast.success('Legenda salva');
  };

  const handleDownload = async (photo: ScoutPhotoRecord) => {
    try {
      const url = signedUrls[photo.storage_path];
      if (!url) return;
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${scoutName.replace(/\s+/g, '_')}-${photo.id.slice(0, 8)}.jpg`;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch {
      toast.error('Falha ao baixar foto');
    }
  };

  // Drag-and-drop
  const onDragEnter = (e: React.DragEvent) => {
    if (!canManage) return;
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDrop = (e: React.DragEvent) => {
    if (!canManage) return;
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files?.length) requestUpload(e.dataTransfer.files);
  };

  // Lightbox nav
  const navigate = useCallback((dir: 1 | -1) => {
    if (savingCaption) return;
    setEditingCaption(false);
    setViewingIndex(idx => {
      if (idx === null) return idx;
      const next = idx + dir;
      if (next < 0 || next >= filtered.length) return idx;
      return next;
    });
  }, [filtered.length, savingCaption]);

  useEffect(() => {
    if (viewingIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (savingCaption) return;
      if (e.key === 'ArrowRight') navigate(1);
      else if (e.key === 'ArrowLeft') navigate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewingIndex, navigate, savingCaption]);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (savingCaption) return;
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const viewing = viewingIndex !== null ? filtered[viewingIndex] : null;
  const favoriteCount = photos.filter(p => p.is_favorite).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>{photos.length === 0 ? 'Nenhuma foto cadastrada' : `${photos.length} foto(s)`}</span>
          {favoriteCount > 0 && (
            <Button
              type="button"
              variant={showFavoritesOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setShowFavoritesOnly(s => !s); setVisibleCount(PAGE_SIZE); }}
              className="gap-1.5 h-8"
            >
              <Star className={`h-3.5 w-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              {favoriteCount} favorita{favoriteCount > 1 ? 's' : ''}
            </Button>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                requestUpload(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                requestUpload(e.target.files);
                if (cameraInputRef.current) cameraInputRef.current.value = '';
              }}
            />
            {/* Folder selection input */}
            <input
              id="folder-input-gallery"
              type="file"
              // @ts-expect-error webkitdirectory is a valid attribute
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={(e) => {
                requestUpload(e.target.files);
                if (e.target) e.target.value = '';
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={uploading} className="gap-2 flex-1 sm:flex-none">
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enviando {progress.current}/{progress.total}</>
                  ) : (
                    <><Plus className="h-4 w-4" /> Adicionar</>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Origem das fotos</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { onPickStart?.(); cameraInputRef.current?.click(); }}>
                  <Camera className="mr-2 h-4 w-4" /> Câmera
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { onPickStart?.(); fileInputRef.current?.click(); }}>
                  <ImageIcon className="mr-2 h-4 w-4" /> Selecionar arquivos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { onPickStart?.(); document.getElementById('folder-input-gallery')?.click(); }}>
                  <Folder className="mr-2 h-4 w-4" /> Selecionar pasta inteira
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Drop zone wrapper */}
      <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`relative rounded-lg transition-all ${
          isDragging ? 'ring-2 ring-primary ring-offset-2 bg-primary/5' : ''
        }`}
      >
        {isDragging && canManage && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-primary/10 backdrop-blur-sm rounded-lg pointer-events-none">
            <Upload className="h-10 w-10 text-primary mb-2" />
            <p className="text-sm font-medium text-primary">Solte para enviar</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? null : (
          <div className="space-y-6">
            {grouped.map(([label, items]) => (
              <section key={label}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 sticky top-0 bg-background/80 backdrop-blur py-1 z-[1]">
                  {label}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {items.map(photo => {
                    const url = signedUrls[photo.storage_path];
                    const idx = filtered.indexOf(photo);
                    const isEditing = inlineEditId === photo.id;
                    return (
                      <div key={photo.id} className="flex flex-col gap-1.5">
                        <div
                          className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
                          onClick={() => setViewingIndex(idx)}
                        >
                          {url ? (
                            <img src={url} alt={photo.caption || 'Foto'} loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 opacity-30" />
                            </div>
                          )}
                          {/* Favorite badge */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(photo); }}
                            className={`absolute top-1 left-1 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-opacity ${
                              photo.is_favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                            aria-label={photo.is_favorite ? 'Desfavoritar' : 'Favoritar'}
                          >
                            <Star className={`h-3 w-3 ${photo.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                          {canManage && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleting(photo); }}
                              className="absolute top-1 right-1 p-1.5 bg-black/60 hover:bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Excluir"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {/* Inline caption */}
                        {isEditing ? (
                          <div className="flex items-start gap-1" onClick={(e) => e.stopPropagation()}>
                            <Textarea
                              value={inlineDraft}
                              onChange={(e) => setInlineDraft(e.target.value.slice(0, 500))}
                              placeholder="Legenda..."
                              rows={2}
                              autoFocus
                              disabled={inlineSaving}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveInlineCaption(photo); }
                                else if (e.key === 'Escape') { setInlineEditId(null); }
                              }}
                              className="min-h-[44px] text-xs resize-none"
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => saveInlineCaption(photo)}
                                disabled={inlineSaving}
                                className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                aria-label="Salvar legenda"
                              >
                                {inlineSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineEditId(null)}
                                disabled={inlineSaving}
                                className="p-1 rounded bg-muted hover:bg-muted/80 disabled:opacity-50"
                                aria-label="Cancelar"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1 min-h-[20px]">
                            <p className={`text-xs flex-1 break-words ${photo.caption ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                              {photo.caption || (canManage ? 'Sem legenda' : '')}
                            </p>
                            {canManage && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInlineDraft(photo.caption || '');
                                  setInlineEditId(photo.id);
                                }}
                                className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                                aria-label="Editar legenda"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4" />
            {visibleCount < filtered.length && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={viewingIndex !== null} onOpenChange={(open) => { if (!open && savingCaption) return; setViewingIndex(open ? viewingIndex : null); setEditingCaption(false); }}>
        <DialogContent className="max-w-4xl p-2 max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <div className="relative">
                <img
                  src={signedUrls[viewing.storage_path]}
                  alt={viewing.caption || 'Foto'}
                  className="w-full h-auto max-h-[70vh] object-contain rounded select-none"
                />
                {/* Prev */}
                {viewingIndex! > 0 && (
                  <button
                    onClick={() => navigate(-1)}
                    disabled={savingCaption}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                {/* Next */}
                {viewingIndex! < filtered.length - 1 && (
                  <button
                    onClick={() => navigate(1)}
                    disabled={savingCaption}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Próxima"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
                {savingCaption && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px] rounded pointer-events-none">
                    <div className="flex items-center gap-2 px-4 py-2 bg-background/90 rounded-full shadow-lg">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">Salvando legenda...</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Caption */}
              <div className="px-1">
                {editingCaption && canManage ? (
                  <div className="space-y-2">
                    <Textarea
                      value={captionDraft}
                      onChange={(e) => setCaptionDraft(e.target.value.slice(0, 500))}
                      placeholder="Escreva uma legenda..."
                      rows={2}
                      maxLength={500}
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{captionDraft.length}/500</span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingCaption(false)} disabled={savingCaption} className="gap-1">
                          <X className="h-4 w-4" /> Cancelar
                        </Button>
                        <Button size="sm" onClick={() => saveCaption(viewing)} disabled={savingCaption} className="gap-1">
                          {savingCaption ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm flex-1 break-words ${viewing.caption ? '' : 'text-muted-foreground italic'}`}>
                      {viewing.caption || 'Sem legenda'}
                    </p>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 shrink-0"
                        onClick={() => { setCaptionDraft(viewing.caption || ''); setEditingCaption(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> {viewing.caption ? 'Editar' : 'Adicionar'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 px-1">
                <span className="text-xs text-muted-foreground">
                  {viewingIndex! + 1} / {filtered.length}
                  {' · '}
                  {format(new Date(viewing.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                <div className="flex gap-2 flex-wrap justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleFavorite(viewing)}
                    className="gap-2"
                    disabled={!!processingAction}
                  >
                    <Star className={`h-4 w-4 ${viewing.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                    {viewing.is_favorite ? 'Favorita' : 'Favoritar'}
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => rotatePhoto(viewing)}
                        className="gap-2"
                        disabled={!!processingAction}
                      >
                        {processingAction === 'rotate'
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RotateCw className="h-4 w-4" />}
                        Girar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCropOpenFor(viewing)}
                        className="gap-2"
                        disabled={!!processingAction}
                      >
                        {processingAction === 'crop'
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <CropIcon className="h-4 w-4" />}
                        Recortar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAsProfile(viewing)}
                        className="gap-2"
                        disabled={!!processingAction}
                      >
                        {processingAction === 'profile'
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <UserCircle className="h-4 w-4" />}
                        Usar no perfil
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleDownload(viewing)} className="gap-2" disabled={!!processingAction}>
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload confirm — vincula ao integrante selecionado */}
      <AlertDialog
        open={!!pendingFiles}
        onOpenChange={(o) => { if (!o && !uploading) setPendingFiles(null); }}
      >
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                <div className="rounded-md border bg-muted/50 p-3">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Integrante</div>
                  <div className="font-semibold uppercase break-words text-sm">{scoutName}</div>
                  <div className="text-[10px] text-muted-foreground font-mono break-all opacity-70">ID: {scoutId}</div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm">
                    Você está enviando <strong>{pendingFiles?.length || 0}</strong> foto(s).
                  </p>
                  
                  {uploading && (
                    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex justify-between items-end text-xs mb-1">
                        <span className="font-medium text-primary flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Enviando foto {progress.current} de {progress.total}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {Math.round((progress.current / progress.total) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden border">
                        <motion.div 
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                        />
                      </div>
                      <p className="text-[10px] text-center text-muted-foreground animate-pulse">
                        Salvando em Galeria › {new Date().getFullYear()} › {format(new Date(), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  )}
                </div>

                {!uploading && (
                  <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-100 p-2 rounded">
                    As imagens serão salvas automaticamente na pasta do ano e data atual.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            {!uploading && (
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
            )}
            <AlertDialogAction
              className={uploading ? "bg-primary/80 pointer-events-none" : ""}
              disabled={uploading || !pendingFiles?.length}
              onClick={async (e) => {
                e.preventDefault();
                const files = pendingFiles;
                if (!files || !files.length) return;
                try {
                  await handleFiles(files);
                } finally {
                  setPendingFiles(null);
                }
              }}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </span>
              ) : 'Confirmar e Salvar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A foto será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && handleDelete(deleting)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image cropper for in-gallery edits */}
      {cropOpenFor && (
        <ImageCropper
          open={!!cropOpenFor}
          imageSrc={signedUrls[cropOpenFor.storage_path] || ''}
          onClose={() => setCropOpenFor(null)}
          onCropComplete={handleCropConfirm}
        />
      )}
    </div>
  );
}
