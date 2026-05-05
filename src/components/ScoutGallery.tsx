import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getSignedUrlsBatch } from '@/lib/storageUtils';
import { compressImage } from '@/lib/imageCompression';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, Trash2, Download, ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


interface ScoutPhotoRecord {
  id: string;
  scout_id: string;
  storage_path: string;
  caption: string;
  uploaded_by: string;
  created_at: string;
  file_size: number;
  mime_type: string;
}

interface Props {
  scoutId: string;
  scoutName: string;
}

const MAX_SIZE_MB = 10;

export default function ScoutGallery({ scoutId, scoutName }: Props) {
  const { user, isAdmin, isVoluntario } = useAuth();
  const canManage = isAdmin || isVoluntario;

  const [photos, setPhotos] = useState<ScoutPhotoRecord[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [viewing, setViewing] = useState<ScoutPhotoRecord | null>(null);
  const [deleting, setDeleting] = useState<ScoutPhotoRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length || !user) return;
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!valid.length) return toast.error('Selecione apenas imagens.');

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
        const compressed = await compressImage(file);
        const ext = (compressed.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const path = `gallery/${scoutId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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
    if (success > 0) {
      toast.success(`${success} foto(s) enviada(s)`);
      load();
    }
  };

  const handleDelete = async (photo: ScoutPhotoRecord) => {
    const { error: dbErr } = await supabase.from('scout_photos' as any).delete().eq('id', photo.id);
    if (dbErr) {
      toast.error('Erro ao excluir foto');
      return;
    }
    await supabase.storage.from('scout-photos').remove([photo.storage_path]);
    toast.success('Foto excluída');
    setDeleting(null);
    load();
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

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {photos.length === 0 ? 'Nenhuma foto cadastrada' : `${photos.length} foto(s)`}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2 w-full sm:w-auto"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando {progress.current}/{progress.total}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Adicionar Fotos
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <ImageIcon className="h-12 w-12 mb-2 opacity-40" />
          <p className="text-sm">
            {canManage ? 'Adicione fotos para este integrante' : 'Nenhuma foto disponível'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map(photo => {
            const url = signedUrls[photo.storage_path];
            return (
              <div
                key={photo.id}
                className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
                onClick={() => setViewing(photo)}
              >
                {url ? (
                  <img src={url} alt={photo.caption || 'Foto'} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 opacity-30" />
                  </div>
                )}
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
            );
          })}
        </div>
      )}

      {/* Viewer */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <img
                src={signedUrls[viewing.storage_path]}
                alt={viewing.caption || 'Foto'}
                className="w-full h-auto max-h-[75vh] object-contain rounded"
              />
              <div className="flex justify-end gap-2 pb-1">
                <Button variant="outline" size="sm" onClick={() => handleDownload(viewing)} className="gap-2">
                  <Download className="h-4 w-4" /> Baixar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
