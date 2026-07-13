import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getSignedUrlsBatch } from '@/lib/storageUtils';
import { compressImage } from '@/lib/imageCompression';
import { xhrUploadToStorage } from '@/lib/uploadUtils';

// (logo / pdf generation moved to scoutPdfExport)
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Folder, ChevronRight, ImageIcon, ArrowLeft, Download, Upload,
  UploadCloud, Trash2, X, CheckCircle2, AlertCircle, FileArchive, FileText,
  CheckSquare, Square, RotateCcw, Play, Camera, Plus,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import JSZip from 'jszip';
// jsPDF moved to scoutPdfExport

interface PhotoRec {
  id: string;
  storage_path: string;
  created_at: string;
}

interface Props {
  scoutId: string;
  scoutName: string;
  onPickStart?: () => void;
}

type FileStatus = 'pending' | 'uploading' | 'success' | 'error' | 'skipped';
interface PendingFile {
  id: string;
  file: File;
  date: string;
  preview: string;
  status: FileStatus;
  message?: string;
  loaded: number;     // bytes already uploaded for current attempt
  total: number;      // total bytes (of compressed payload, fallback to original size)
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;


const MAX_SIZE_MB = 10;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif'];
const ACCEPTED_EXT = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];
const MIN_DATE = '1900-01-01';
const UNDO_MS = 6000;

const today = () => format(new Date(), 'yyyy-MM-dd');

function validateFile(file: File): { ok: true } | { ok: false; reason: string } {
  const lowerName = file.name.toLowerCase();
  const validMime = ACCEPTED_MIME.includes(file.type.toLowerCase());
  const validExt = ACCEPTED_EXT.some(e => lowerName.endsWith(e));
  if (!validMime && !validExt) {
    return { ok: false, reason: 'Tipo não aceito (apenas JPG, PNG ou HEIC).' };
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, reason: `Arquivo de ${mb}MB excede o limite de ${MAX_SIZE_MB}MB.` };
  }
  return { ok: true };
}

function isValidDate(s: string): boolean {
  if (!s) return false;
  if (s < MIN_DATE) return false;
  if (s > today()) return false;
  const d = new Date(`${s}T12:00:00`);
  return !isNaN(d.getTime());
}

function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function ScoutFolders({ scoutId, scoutName, onPickStart }: Props) {
  const { user, isAdmin, isVoluntario } = useAuth();
  const canManage = isAdmin || isVoluntario;

  const [photos, setPhotos] = useState<PhotoRec[]>([]);
  const [registrationId, setRegistrationId] = useState<string>('');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PhotoRec | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [folderDropTarget, setFolderDropTarget] = useState<string | null>(null); // year:`y:2024` or date:`d:YYYY-MM-DD`

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [photoDate, setPhotoDate] = useState<string>(() => today());
  const [applyToAll, setApplyToAll] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cancelUploadRef = useRef<string | null>(null); // Motivo do cancelamento para logs
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  // Selection (bulk) state inside a date folder
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete confirmation state
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [deleteSingleOpen, setDeleteSingleOpen] = useState<PhotoRec | null>(null);
  const [deleteSelectionOpen, setDeleteSelectionOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });

  // Undo: hide locally + schedule real delete; allow cancel within UNDO_MS
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const undoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Export progress
  const [exporting, setExporting] = useState<null | 'zip' | 'pdf'>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);


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

  // Fetch registration_id (sequential unique ID) of the scout for filenames
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('scouts')
        .select('registration_id')
        .eq('id', scoutId)
        .maybeSingle();
      if (active && data?.registration_id) setRegistrationId(data.registration_id);
    })();
    return () => { active = false; };
  }, [scoutId]);

  // Cleanup undo timers on unmount
  useEffect(() => {
    return () => {
      undoTimersRef.current.forEach(t => clearTimeout(t));
      undoTimersRef.current.clear();
    };
  }, []);

  // Visible photos (excluding hidden / pending-undo)
  const visiblePhotos = useMemo(() => photos.filter(p => !hiddenIds.has(p.id)), [photos, hiddenIds]);

  // Subscribe to realtime updates for this scout's photos
  useEffect(() => {
    const channel = supabase
      .channel(`scout-photos-${scoutId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scout_photos',
          filter: `scout_id=eq.${scoutId}`,
        },
        () => {
          load(); // Reload all when a change occurs (insert, update, delete)
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scoutId, load]);

  const years = useMemo(() => {
    const map = new Map<number, PhotoRec[]>();
    for (const p of visiblePhotos) {
      const y = new Date(p.created_at).getFullYear();
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [visiblePhotos]);

  const dates = useMemo(() => {
    if (year === null) return [];
    const items = visiblePhotos.filter(p => new Date(p.created_at).getFullYear() === year);
    const map = new Map<string, PhotoRec[]>();
    for (const p of items) {
      const key = format(new Date(p.created_at), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [visiblePhotos, year]);

  const photosOfDate = useMemo(() => {
    if (!dateKey) return [];
    return visiblePhotos.filter(p => format(new Date(p.created_at), 'yyyy-MM-dd') === dateKey);
  }, [visiblePhotos, dateKey]);

  // ────────────────────────────────────────────────────────────────────────────
  // Downloads
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

  // ────────────────────────────────────────────────────────────────────────────
  // Upload
  const buildPendingFromFiles = (files: File[], defaultDate: string): { pending: PendingFile[]; rejected: { name: string; reason: string }[] } => {
    const pending: PendingFile[] = [];
    const rejected: { name: string; reason: string }[] = [];
    for (const f of files) {
      const v = validateFile(f);
      if (v.ok === false) { rejected.push({ name: f.name, reason: v.reason }); continue; }
      pending.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        date: defaultDate,
        preview: URL.createObjectURL(f),
        status: 'pending',
        loaded: 0,
        total: f.size,
      });
    }
    return { pending, rejected };
  };

  const reportRejected = (rejected: { name: string; reason: string }[]) => {
    if (!rejected.length) return;
    const first = rejected[0];
    if (rejected.length === 1) toast.error(`"${first.name}" recusado: ${first.reason}`);
    else toast.error(`${rejected.length} arquivo(s) recusado(s). Ex.: "${first.name}" — ${first.reason}`);
  };

  const openUploadDialog = (files: FileList | File[] | null, presetDate?: string) => {
    if (!files) return;
    const arr = Array.from(files);
    if (!arr.length) return;

    let defaultDate: string;
    if (presetDate) defaultDate = presetDate;
    else if (dateKey) defaultDate = dateKey;
    else if (year !== null) defaultDate = `${year}-${format(new Date(), 'MM-dd')}`;
    else defaultDate = today();

    const { pending, rejected } = buildPendingFromFiles(arr, defaultDate);
    reportRejected(rejected);
    if (!pending.length) return;

    setPhotoDate(defaultDate);
    setApplyToAll(true);
    setPendingFiles(pending);
    setUploadOpen(true);
  };

  const updateFileDate = (id: string, newDate: string) => {
    setPendingFiles(prev => prev.map(p => p.id === id ? { ...p, date: newDate } : p));
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => {
      const removed = prev.find(p => p.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter(p => p.id !== id);
    });
  };

  const cleanupPreviews = (items: { preview: string }[]) => {
    items.forEach(p => { try { URL.revokeObjectURL(p.preview); } catch { /* noop */ } });
  };

  const clearQueue = () => {
    if (uploading) return;
    cleanupPreviews(pendingFiles);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast('Fila de upload limpa.');
  };

  const setFileStatus = (id: string, status: FileStatus, message?: string) => {
    setPendingFiles(prev => prev.map(p => p.id === id ? { ...p, status, message } : p));
  };

  const setFileProgress = (id: string, loaded: number, total: number) => {
    setPendingFiles(prev => prev.map(p => p.id === id ? { ...p, loaded, total } : p));
  };

  // Validation summary
  const dateErrors = useMemo(() => {
    const errs: string[] = [];
    if (applyToAll) {
      if (!isValidDate(photoDate)) errs.push('A data padrão é inválida ou está fora do limite (1900 — hoje).');
    } else {
      const invalid = pendingFiles.filter(p => !isValidDate(p.date));
      if (invalid.length) errs.push(`${invalid.length} foto(s) com data inválida ou fora do limite.`);
    }
    return errs;
  }, [applyToAll, photoDate, pendingFiles]);

  const failedCount = useMemo(() => pendingFiles.filter(p => p.status === 'error').length, [pendingFiles]);
  const pendingCount = useMemo(() => pendingFiles.filter(p => p.status === 'pending' || p.status === 'skipped').length, [pendingFiles]);

  /**
   * Process the queue. If `onlyIds` is provided, only those items are processed
   * (used by Retry-failed and Resume). Otherwise, processes everything not yet 'success'.
   */
  const runUpload = async (onlyIds?: Set<string>) => {
    if (!user) return;
    if (dateErrors.length) {
      toast.error(dateErrors[0]);
      return;
    }

    // Snapshot of items to process (avoid stale closure on state)
    const snapshot = pendingFiles.filter(p => {
      if (onlyIds) return onlyIds.has(p.id);
      return p.status !== 'success' && p.status !== 'uploading';
    });
    if (!snapshot.length) return;

    // Reset their state to pending + zero progress
    setPendingFiles(prev => prev.map(p =>
      snapshot.some(s => s.id === p.id)
        ? { ...p, status: 'pending', message: undefined, loaded: 0, total: p.file.size }
        : p
    ));

    cancelUploadRef.current = null;
    setUploading(true);
    const total = snapshot.length;
    setProgress({ current: 0, total });
    let success = 0;
    let lastDate = applyToAll ? photoDate : snapshot[0].date;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      toast.error('Sessão expirada. Faça login novamente.');
      setUploading(false);
      return;
    }

    for (let i = 0; i < snapshot.length; i++) {
      if (cancelUploadRef.current) {
        console.log(`[Upload] Interrompido. Motivo: ${cancelUploadRef.current}`);
        // Keep non-success items in queue so user can resume
        setPendingFiles(prev => prev.map(p => {
          const inBatch = snapshot.some(s => s.id === p.id);
          if (!inBatch) return p;
          if (p.status === 'success') return p;
          return { ...p, status: 'pending', message: 'Pausado — pronto para retomar', loaded: 0 };
        }));
        toast('Upload cancelado. A fila foi mantida para você retomar.');
        break;
      }

      const item = snapshot[i];
      const date = applyToAll ? photoDate : item.date;
      lastDate = date;
      setProgress({ current: i + 1, total });
      setFileStatus(item.id, 'uploading');

      let storedPath: string | null = null;
      try {
        if (!isValidDate(date)) {
          setFileStatus(item.id, 'error', 'Data inválida');
          continue;
        }
        const compressed = await compressImage(item.file);
        let mime = compressed.type || item.file.type || 'image/jpeg';
        let ext = (mime.split('/')[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
        
        // Force JPG for HEIC/HEIF or unknown types to ensure browser compatibility
        if (ext === 'heic' || ext === 'heif' || !['jpg', 'png', 'webp'].includes(ext)) {
          ext = 'jpg';
          mime = 'image/jpeg';
        }
        
        const yearSegment = date.split('-')[0];
        const safeName = scoutName
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_\-]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .substring(0, 40);
        const safeId = (registrationId || scoutId.slice(0, 8)).replace(/[^a-zA-Z0-9]/g, '');

        const nowTs = new Date();
        const timeStr = format(nowTs, 'HHmm');
        const filename = `${safeName}_${safeId}_${date}_${timeStr}_${Math.random().toString(36).slice(2, 6)}.${ext}`.toUpperCase();
        const path = `gallery/${scoutId}/${yearSegment}/${date}/${filename}`;
        storedPath = path;
        const baseTs = new Date(`${date}T12:00:00`).toISOString();

        // Initialize progress with compressed size
        setFileProgress(item.id, 0, compressed.size);

        await xhrUploadToStorage({
          bucket: 'scout-photos',
          path,
          file: compressed,
          contentType: compressed.type,
          supabaseUrl: SUPABASE_URL,
          supabaseAnonKey: SUPABASE_ANON,
          accessToken,
          onProgress: (loaded, totalBytes) => setFileProgress(item.id, loaded, totalBytes),
          registerXhr: (xhr) => { activeXhrRef.current = xhr; },
        });

        activeXhrRef.current = null;

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
        setFileProgress(item.id, compressed.size, compressed.size);
        setFileStatus(item.id, 'success');
        success++;
      } catch (err: any) {
        console.error('upload err', err);
        // If aborted by cancel, the loop will handle it on next iteration
        if (cancelUploadRef.current) {
          console.log(`[Upload] Catch block - abortado por cancelamento: ${cancelUploadRef.current}`);
          if (storedPath) { try { await supabase.storage.from('scout-photos').remove([storedPath]); } catch { /* */ } }
          continue;
        }
        setFileStatus(item.id, 'error', err.message || 'erro');
      }
    }

    activeXhrRef.current = null;
    setUploading(false);
    setProgress({ current: 0, total: 0 });

    if (success > 0) {
      toast.success(`${success} foto(s) enviada(s) com sucesso.`);
      const newYear = new Date(`${lastDate}T12:00:00`).getFullYear();
      setYear(newYear);
      setDateKey(lastDate);
      await load();
    }

    // The logic to close when all are success is now in a separate useEffect
  };

  // Auto-close if all finished successfully
  useEffect(() => {
    if (uploadOpen && !uploading && pendingFiles.length > 0 && pendingFiles.every(p => p.status === 'success')) {
      const timer = setTimeout(() => {
        setUploadOpen(false);
        cleanupPreviews(pendingFiles);
        setPendingFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [uploadOpen, uploading, pendingFiles]);

  const handleUpload = () => runUpload();

  const handleRetryFailed = () => {
    const ids = new Set(pendingFiles.filter(p => p.status === 'error').map(p => p.id));
    if (!ids.size) return;
    runUpload(ids);
  };

  const handleResume = () => {
    const ids = new Set(
      pendingFiles.filter(p => p.status === 'pending' || p.status === 'skipped').map(p => p.id)
    );
    if (!ids.size) return;
    runUpload(ids);
  };

  const cancelOngoingUpload = (reason: string = 'manual') => {
    console.log(`[Upload] Solicitando cancelamento. Motivo: ${reason}`);
    cancelUploadRef.current = reason;
    if (activeXhrRef.current) {
      try { activeXhrRef.current.abort(); } catch { /* */ }
      activeXhrRef.current = null;
    }
  };

  // Direct drop on a folder card — skip dialog
  const dropDirectlyToDate = async (files: File[], targetDate: string) => {
    if (!user) return;
    const { pending, rejected } = buildPendingFromFiles(files, targetDate);
    reportRejected(rejected);
    if (!pending.length) return;

    toast(`Enviando ${pending.length} foto(s) para ${format(new Date(`${targetDate}T12:00:00`), 'dd/MM/yyyy')}…`);
    setUploading(true);
    let success = 0;
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      try {
        const compressed = await compressImage(item.file);
        const ext = (compressed.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const safeName = scoutName
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_\-]/g, '_')
          .replace(/_+/g, '_').replace(/^_|_$/g, '').substring(0, 40);
        const safeId = (registrationId || scoutId.slice(0, 8)).replace(/[^a-zA-Z0-9]/g, '');
        const yearSegment = targetDate.split('-')[0];
        const filename = `${safeName}_${safeId}_${targetDate}_${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}.${ext}`.toUpperCase();
        const path = `gallery/${scoutId}/${yearSegment}/${targetDate}/${filename}`;
        const baseTs = new Date(`${targetDate}T12:00:00`).toISOString();
        const { error: upErr } = await supabase.storage.from('scout-photos').upload(path, compressed, { upsert: false, contentType: compressed.type });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from('scout_photos' as any).insert({
          scout_id: scoutId, storage_path: path, caption: '', uploaded_by: user.id,
          file_size: compressed.size, mime_type: compressed.type, created_at: baseTs,
        });
        if (dbErr) { await supabase.storage.from('scout-photos').remove([path]); throw dbErr; }
        success++;
      } catch (err: any) {
        console.error(err);
        toast.error(`Falha ao enviar "${item.file.name}": ${err.message || 'erro'}`);
      } finally {
        URL.revokeObjectURL(item.preview);
      }
    }
    setUploading(false);
    if (success > 0) {
      toast.success(`${success} foto(s) enviada(s) para ${format(new Date(`${targetDate}T12:00:00`), 'dd/MM/yyyy')}`);
      await load();
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Deletion with undo
  const performRealDelete = async (toDelete: PhotoRec[], undoKey: string) => {
    try {
      const paths = toDelete.map(p => p.storage_path);
      const ids = toDelete.map(p => p.id);
      if (paths.length) await supabase.storage.from('scout-photos').remove(paths);
      if (ids.length) await supabase.from('scout_photos' as any).delete().in('id', ids);
    } catch (err: any) {
      console.error('real delete error', err);
      toast.error(`Falha ao remover do servidor: ${err.message || 'erro'}`);
    } finally {
      undoTimersRef.current.delete(undoKey);
      // Reload to sync state and clear hiddenIds for these
      setHiddenIds(prev => {
        const next = new Set(prev);
        toDelete.forEach(p => next.delete(p.id));
        return next;
      });
      await load();
    }
  };

  const undoDeletion = (undoKey: string, toRestore: PhotoRec[]) => {
    const t = undoTimersRef.current.get(undoKey);
    if (t) { clearTimeout(t); undoTimersRef.current.delete(undoKey); }
    setHiddenIds(prev => {
      const next = new Set(prev);
      toRestore.forEach(p => next.delete(p.id));
      return next;
    });
    toast.success('Exclusão desfeita.');
  };

  const scheduleDeletion = (toDelete: PhotoRec[], description: string) => {
    if (!toDelete.length) return;
    const undoKey = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setHiddenIds(prev => {
      const next = new Set(prev);
      toDelete.forEach(p => next.add(p.id));
      return next;
    });
    const timer = setTimeout(() => { performRealDelete(toDelete, undoKey); }, UNDO_MS);
    undoTimersRef.current.set(undoKey, timer);
    toast(description, {
      duration: UNDO_MS,
      action: {
        label: 'Desfazer',
        onClick: () => undoDeletion(undoKey, toDelete),
      },
    });
  };

  const handleDeleteFolder = async () => {
    if (!dateKey) return;
    const target = [...photosOfDate];
    setDeleting(true);
    setDeleteProgress({ current: target.length, total: target.length });
    setDeleteFolderOpen(false);
    setDateKey(null);
    setDeleting(false);
    setDeleteProgress({ current: 0, total: 0 });
    scheduleDeletion(target, `${target.length} foto(s) da pasta excluída(s).`);
  };

  const handleDeleteSingle = async () => {
    if (!deleteSingleOpen) return;
    const target = deleteSingleOpen;
    setDeleteSingleOpen(null);
    setViewing(null);
    scheduleDeletion([target], 'Foto excluída.');
  };

  const handleDeleteSelection = async () => {
    const target = photosOfDate.filter(p => selectedIds.has(p.id));
    if (!target.length) return;
    setDeleteSelectionOpen(false);
    setSelectedIds(new Set());
    setSelectMode(false);
    scheduleDeletion(target, `${target.length} foto(s) selecionada(s) excluída(s).`);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(photosOfDate.map(p => p.id)));
  const clearSelection = () => setSelectedIds(new Set());

  // ────────────────────────────────────────────────────────────────────────────
  // Drag & drop — root and folder targets
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragging(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false); setFolderDropTarget(null);
    if (!canManage) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) openUploadDialog(files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, dateKey, year]);

  const handleFolderDrop = (e: React.DragEvent, target: { type: 'year' | 'date'; value: string }) => {
    e.preventDefault(); e.stopPropagation();
    setFolderDropTarget(null); setIsDragging(false);
    if (!canManage) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    if (target.type === 'date') {
      // Direct upload — no dialog needed
      dropDirectlyToDate(files, target.value);
    } else {
      // Year — open dialog with year prefilled to today's MM-DD inside the year
      const ym = `${target.value}-${format(new Date(), 'MM-dd')}`;
      openUploadDialog(files, ym);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // ZIP / PDF export of current date folder
  const exportZip = async () => {
    if (!dateKey || !photosOfDate.length) return;
    setExporting('zip');
    try {
      const zip = new JSZip();
      const folderName = `${scoutName.replace(/\s+/g, '_')}_${dateKey}`;
      const folder = zip.folder(folderName)!;
      let i = 0;
      for (const p of photosOfDate) {
        const url = signedUrls[p.storage_path];
        if (!url) continue;
        const res = await fetch(url);
        const blob = await res.blob();
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        folder.file(`${String(i + 1).padStart(3, '0')}-${p.id.slice(0, 8)}.${ext}`, blob);
        i++;
      }
      const out = await zip.generateAsync({ type: 'blob' });
      const objUrl = URL.createObjectURL(out);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${folderName}.zip`;
      a.click();
      URL.revokeObjectURL(objUrl);
      toast.success(`ZIP gerado com ${i} foto(s).`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Falha ao gerar ZIP: ${err.message || 'erro'}`);
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!dateKey || !photosOfDate.length) return;
    setExporting('pdf');
    try {
      const { exportScoutFolderPdf } = await import('@/lib/scoutPdfExport');
      await exportScoutFolderPdf(scoutName, dateKey, photosOfDate, signedUrls);
      toast.success('PDF gerado com sucesso.');
    } catch (err: any) {
      console.error(err);
      toast.error(`Falha ao gerar PDF: ${err.message || 'erro'}`);
    } finally {
      setExporting(null);
    }
  };

  // Helper: shared dropzone props for folder cards
  const folderDropProps = (key: string, target: { type: 'year' | 'date'; value: string }) => canManage ? {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setFolderDropTarget(key); },
    onDragLeave: (e: React.DragEvent) => { e.stopPropagation(); if (folderDropTarget === key) setFolderDropTarget(null); },
    onDrop: (e: React.DragEvent) => handleFolderDrop(e, target),
  } : {};

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="space-y-3 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay (root) */}
      {isDragging && canManage && !folderDropTarget && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex flex-col items-center justify-center gap-3 pointer-events-none">
          <UploadCloud className="h-10 w-10 text-primary animate-bounce" />
          <p className="text-sm font-medium text-primary">Solte aqui para revisar antes de enviar</p>
          <p className="text-xs text-primary/80">Ou solte sobre uma pasta de Data para enviar direto</p>
        </div>
      )}

      {/* Upload toolbar */}
      {canManage && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            JPG, PNG ou HEIC — até <strong>{MAX_SIZE_MB}MB</strong> por arquivo. Arraste sobre uma pasta para enviar direto.
          </p>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={uploading} className="gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar
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
                <DropdownMenuItem onClick={() => { onPickStart?.(); document.getElementById('folder-input-folders')?.click(); }}>
                  <Folder className="mr-2 h-4 w-4" /> Selecionar pasta inteira
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Invisible folder input for Pastas tab */}
          <input
            id="folder-input-folders"
            type="file"
            // @ts-expect-error webkitdirectory is a valid attribute
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={(e) => openUploadDialog(e.target.files)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(e) => openUploadDialog(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => openUploadDialog(e.target.files)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !visiblePhotos.length ? null : (
        <>
          {/* Breadcrumb */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <button
                onClick={() => { setYear(null); setDateKey(null); setSelectMode(false); clearSelection(); }}
                className="font-medium uppercase break-words text-left hover:underline"
              >
                {scoutName}
              </button>
              {year !== null && (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <button onClick={() => { setDateKey(null); setSelectMode(false); clearSelection(); }} className="font-medium hover:underline">
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

            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const confirmed = window.confirm("Isso renomeará todas as fotos existentes deste integrante para o novo padrão NOME_IDUNICO_DATA. Continuar?");
                  if (!confirmed) return;
                  
                  const toastId = toast.loading("Reprocessando nomes das fotos...");
                  try {
                    const { data, error } = await supabase.functions.invoke('rename-scout-photos');
                    if (error) throw error;
                    toast.success("Reprocessamento concluído com sucesso!", { id: toastId });
                    await load();
                  } catch (err: any) {
                    toast.error("Falha ao reprocessar: " + (err.message || "Erro desconhecido"), { id: toastId });
                  }
                }}
                className="gap-2 text-[10px] h-7 px-2"
              >
                <RotateCcw className="h-3 w-3" /> Reprocessar Nomes
              </Button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2">
              {(year !== null || dateKey) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (dateKey) { setDateKey(null); setSelectMode(false); clearSelection(); }
                    else setYear(null);
                  }}
                  className="gap-1 h-8"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
              )}
              <div className="text-sm text-muted-foreground">
                {visiblePhotos.length} foto(s) organizada(s)
              </div>
            </div>

            {canManage && (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => openUploadDialog(e.target.files)}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => openUploadDialog(e.target.files)}
                />
                <input
                  id="folder-input-folders"
                  type="file"
                  // @ts-expect-error webkitdirectory is a valid attribute
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={(e) => openUploadDialog(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onPickStart?.();
                    cameraInputRef.current?.click();
                  }}
                  disabled={uploading}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Câmera
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button disabled={uploading} className="gap-2 flex-1 sm:flex-none">
                      <Upload className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Origem das fotos</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { onPickStart?.(); fileInputRef.current?.click(); }}>
                      <ImageIcon className="mr-2 h-4 w-4" /> Selecionar arquivos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { onPickStart?.(); document.getElementById('folder-input-folders')?.click(); }}>
                      <Folder className="mr-2 h-4 w-4" /> Selecionar pasta inteira
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {dateKey && photosOfDate.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={exportZip}
                disabled={!!exporting}
                className="gap-1 h-8"
              >
                {exporting === 'zip'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <FileArchive className="h-4 w-4" />}
                ZIP
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportPdf}
                disabled={!!exporting}
                className="gap-1 h-8"
              >
                {exporting === 'pdf'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <FileText className="h-4 w-4" />}
                PDF
              </Button>

              {canManage && (
                <>
                  <Button
                    variant={selectMode ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => { setSelectMode(s => !s); clearSelection(); }}
                    className="gap-1 h-8"
                  >
                    {selectMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                    {selectMode ? 'Sair' : 'Selecionar'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteFolderOpen(true)}
                    className="gap-1 h-8"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir pasta ({photosOfDate.length})
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Selection toolbar */}
          {dateKey && selectMode && (
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 flex-wrap">
              <span className="text-sm">
                <strong>{selectedIds.size}</strong> de {photosOfDate.length} selecionada{photosOfDate.length !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll} className="h-8">Marcar todas</Button>
                <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8">Limpar</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteSelectionOpen(true)}
                  disabled={!selectedIds.size}
                  className="gap-1 h-8"
                >
                  <Trash2 className="h-4 w-4" /> Excluir selecionadas
                </Button>
              </div>
            </div>
          )}

          {/* Level 1: Years */}
          {year === null && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {years
                .filter(([_, items]) => items.length > 0)
                .map(([y, items]) => {
                const cover = items[0];
                const url = cover ? signedUrls[cover.storage_path] : null;
                const key = `y:${y}`;
                const isOver = folderDropTarget === key;
                return (
                  <div
                    key={y}
                    {...folderDropProps(key, { type: 'year', value: String(y) })}
                    className={`relative rounded-lg ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setYear(y)}
                      className="group relative aspect-square w-full rounded-lg overflow-hidden border bg-muted text-left flex items-stretch"
                    >
                      {url ? (
                        <img src={url} alt={`Ano ${y}`} loading="lazy" decoding="async" className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition" />
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
                    {isOver && (
                      <div className="absolute inset-0 bg-primary/20 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
                        <UploadCloud className="h-8 w-8 text-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Level 2: Dates within year */}
          {year !== null && !dateKey && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {dates
                .filter(([_, items]) => items.length > 0)
                .map(([key, items]) => {
                const cover = items[0];
                const url = cover ? signedUrls[cover.storage_path] : null;
                const dropKey = `d:${key}`;
                const isOver = folderDropTarget === dropKey;
                return (
                  <div
                    key={key}
                    {...folderDropProps(dropKey, { type: 'date', value: key })}
                    className={`relative rounded-lg ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setDateKey(key)}
                      className="group relative aspect-square w-full rounded-lg overflow-hidden border bg-muted text-left flex items-stretch"
                    >
                      {url ? (
                        <img src={url} alt={key} loading="lazy" decoding="async" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
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
                    {isOver && (
                      <div className="absolute inset-0 bg-primary/20 border-2 border-dashed border-primary rounded-lg flex flex-col items-center justify-center gap-1 pointer-events-none">
                        <UploadCloud className="h-6 w-6 text-primary" />
                        <span className="text-[10px] text-primary font-medium px-2 text-center">Soltar aqui</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Level 3: Photos of date */}
          {dateKey && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photosOfDate.map(p => {
                const url = signedUrls[p.storage_path];
                const isSel = selectedIds.has(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => selectMode ? toggleSelect(p.id) : setViewing(p)}
                    className={`group relative aspect-square rounded-lg overflow-hidden border bg-muted flex items-stretch ${isSel ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    {url ? (
                      <img src={url} alt="Foto" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 opacity-30" /></div>
                    )}
                    {selectMode && (
                      <div className="absolute top-1.5 left-1.5 bg-background/90 rounded p-0.5">
                        {isSel
                          ? <CheckSquare className="h-5 w-5 text-primary" />
                          : <Square className="h-5 w-5 text-muted-foreground" />}
                      </div>
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
        <DialogContent 
          className="max-w-4xl p-2 max-h-[90vh]"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setViewing(null);
            }
          }}
        >
          <DialogHeader className="sr-only"><DialogTitle>Foto</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <img
                src={signedUrls[viewing.storage_path]}
                alt="Foto"
                className="w-full h-auto max-h-[70vh] object-contain rounded"
              />
              <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(viewing.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(viewing)} className="gap-2">
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                  {canManage && (
                    <Button variant="destructive" size="sm" onClick={() => setDeleteSingleOpen(viewing)} className="gap-2">
                      <Trash2 className="h-4 w-4" /> Excluir
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload confirmation dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(v) => {
          console.log(`[Dialog] onOpenChange: ${v}, uploading: ${uploading}`);
          // Allow closing if not uploading, or if forced via the cancel confirm
          if (!v && uploading) {
            console.log(`[Dialog] Tentativa de fechar durante upload (click fora ou X). Abrindo confirmação.`);
            setConfirmCancelOpen(true);
            return;
          }
          setUploadOpen(v);
          if (!v) { 
            console.log(`[Dialog] Fechando diálogo e limpando fila.`);
            cleanupPreviews(pendingFiles); 
            setPendingFiles([]); 
            if (fileInputRef.current) fileInputRef.current.value = ''; 
          }
        }}
      >
        <DialogContent 
          className="max-w-2xl max-h-[95vh] flex flex-col p-0"
          onPointerDownOutside={(e) => {
            if (uploading) {
              console.log(`[Dialog] Clique fora detectado durante upload.`);
              e.preventDefault();
              setConfirmCancelOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              console.log(`[Dialog] Tecla Escape pressionada.`);
              if (uploading) {
                e.preventDefault();
                setConfirmCancelOpen(true);
              }
            }
          }}
        >
          <div className="p-6 overflow-y-auto flex-1">
            <DialogHeader className="mb-4">
              <DialogTitle>Enviar fotos para {scoutName}</DialogTitle>
              <DialogDescription>
                Apenas <strong>JPG, PNG ou HEIC</strong> até <strong>{MAX_SIZE_MB}MB</strong>. 
                Todo upload gravará obrigatoriamente um nome no padrão <strong>NOME_IDUNICO_DATA</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm flex items-center justify-between gap-2 flex-wrap">
              <span><strong>{pendingFiles.length}</strong> arquivo{pendingFiles.length !== 1 ? 's' : ''} na fila.</span>
              {!uploading && pendingFiles.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearQueue} className="h-8 gap-1">
                  <X className="h-4 w-4" /> Limpar fila
                </Button>
              )}
            </div>

            {/* Master date + apply-to-all toggle */}
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="photo-date" className="font-semibold">Data padrão *</Label>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    disabled={uploading}
                    className="h-4 w-4 accent-primary"
                  />
                  Aplicar a todas
                </label>
              </div>
              <Input
                id="photo-date"
                type="date"
                value={photoDate}
                min={MIN_DATE}
                max={today()}
                onChange={(e) => setPhotoDate(e.target.value)}
                className="h-12 text-base"
                disabled={uploading}
              />
              {applyToAll && isValidDate(photoDate) && (
                <p className="text-xs text-muted-foreground">
                  Todas serão salvas em: <strong>{new Date(`${photoDate}T12:00:00`).getFullYear()}</strong> ›{' '}
                  <strong>{format(new Date(`${photoDate}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })}</strong>
                </p>
              )}
              {!applyToAll && (
                <p className="text-xs text-muted-foreground">Defina a data individualmente em cada miniatura abaixo.</p>
              )}
              {dateErrors.map((e, idx) => (
                <p key={idx} className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {e}
                </p>
              ))}
            </div>

            {/* Per-file review list */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Revisar fotos selecionadas</p>
                <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
                  {pendingFiles.map((p) => {
                    const effectiveDate = applyToAll ? photoDate : p.date;
                    const dateInvalid = !isValidDate(effectiveDate);
                    return (
                      <div key={p.id} className="rounded-md border bg-background overflow-hidden">
                        <div className="flex items-center gap-3 p-2">
                          <div className="relative h-14 w-14 shrink-0">
                            <img src={p.preview} alt={p.file.name} className="h-14 w-14 rounded object-cover bg-muted" />
                            {p.status === 'success' && (
                              <div className="absolute inset-0 bg-green-500/30 rounded flex items-center justify-center">
                                <CheckCircle2 className="h-6 w-6 text-white drop-shadow" />
                              </div>
                            )}
                            {p.status === 'error' && (
                              <div className="absolute inset-0 bg-destructive/40 rounded flex items-center justify-center">
                                <AlertCircle className="h-6 w-6 text-white drop-shadow" />
                              </div>
                            )}
                            {p.status === 'uploading' && (
                              <div className="absolute inset-0 bg-primary/40 rounded flex items-center justify-center">
                                <Loader2 className="h-6 w-6 text-white animate-spin" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs truncate" title={p.file.name}>{p.file.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {p.status === 'uploading' || (p.status === 'success' && p.total > 0) ? (
                                <>
                                  {formatBytes(p.loaded)} / {formatBytes(p.total)}
                                  {' · '}
                                  <span className={p.status === 'success' ? 'text-green-600' : 'text-primary'}>
                                    {Math.min(100, Math.round((p.loaded / Math.max(p.total, 1)) * 100))}%
                                  </span>
                                </>
                              ) : (
                                <>{formatBytes(p.file.size)}</>
                              )}
                              {p.status !== 'pending' && p.status !== 'uploading' && p.status !== 'success' && p.message && (
                                <span className={p.status === 'error' ? ' text-destructive' : ''}> · {p.message}</span>
                              )}
                              {p.status === 'success' && <span className="text-green-600"> · enviada</span>}
                              {p.status === 'uploading' && <span className="text-primary"> · enviando…</span>}
                              {p.status === 'skipped' && <span> · ignorada</span>}
                              {p.status === 'pending' && p.message && <span> · {p.message}</span>}
                            </p>
                            {(p.status === 'uploading' || p.status === 'success') && p.total > 0 && (
                              <div className="h-1 w-full bg-muted rounded overflow-hidden">
                                <div
                                  className={`h-full transition-all ${p.status === 'success' ? 'bg-green-500' : 'bg-primary'}`}
                                  style={{ width: `${Math.min(100, (p.loaded / Math.max(p.total, 1)) * 100)}%` }}
                                />
                              </div>
                            )}
                            <Input
                              type="date"
                              value={effectiveDate}
                              min={MIN_DATE}
                              max={today()}
                              onChange={(e) => updateFileDate(p.id, e.target.value)}
                              disabled={uploading || applyToAll}
                              className={`h-8 text-xs ${dateInvalid ? 'border-destructive' : ''}`}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePendingFile(p.id)}
                            disabled={uploading}
                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                            aria-label="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="px-2 pb-2">
                          <div className="rounded bg-muted/50 p-1.5 border border-dashed">
                            <p className="text-[10px] text-muted-foreground uppercase font-mono leading-tight">
                              Filename final:
                            </p>
                            <p className="text-[10px] font-mono break-all font-bold text-primary">
                              {scoutName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').substring(0, 40).toUpperCase()}_
                              {(registrationId || scoutId.slice(0, 8)).replace(/[^a-zA-Z0-9]/g, '')}_
                              {effectiveDate}_
                              ... .{(p.file.name.split('.').pop() || 'jpg').toLowerCase()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {uploading && (() => {
              const totalBytes = pendingFiles.reduce((s, p) => s + (p.total || p.file.size), 0);
              const loadedBytes = pendingFiles.reduce((s, p) => s + (p.status === 'success' ? (p.total || p.file.size) : p.loaded), 0);
              const pct = totalBytes ? Math.min(100, (loadedBytes / totalBytes) * 100) : 0;
              const currentFile = pendingFiles.find(p => p.status === 'uploading');
              return (
                <div className="space-y-1" aria-live="polite">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm">
                      Enviando {progress.current} de {progress.total} · {formatBytes(loadedBytes)} / {formatBytes(totalBytes)} ({pct.toFixed(1)}%)
                    </p>
                    {currentFile && (
                      <p className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">
                        {currentFile.file.name}
                      </p>
                    )}
                  </div>

                  <div 
                    className="h-2 w-full bg-muted rounded overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progresso total do upload: ${Math.round(pct)}%`}
                  >
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
            </div>
          </div>
          <DialogFooter className="p-6 bg-muted/20 border-t flex-wrap gap-2">
            {uploading ? (
              <Button variant="destructive" onClick={() => setConfirmCancelOpen(true)} className="gap-2">
                <X className="h-4 w-4" /> Cancelar upload
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setUploadOpen(false);
                    cleanupPreviews(pendingFiles);
                    setPendingFiles([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Fechar
                </Button>
                {failedCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleRetryFailed}
                    disabled={dateErrors.length > 0}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Tentar novamente {failedCount} falha{failedCount !== 1 ? 's' : ''}
                  </Button>
                )}
                {pendingCount > 0 && pendingFiles.some(p => p.status === 'success' || p.status === 'error') && (
                  <Button
                    variant="outline"
                    onClick={handleResume}
                    disabled={dateErrors.length > 0}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Retomar {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                  </Button>
                )}
                <Button
                  onClick={handleUpload}
                  disabled={!pendingFiles.length || dateErrors.length > 0}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {pendingFiles.every(p => p.status === 'success' || p.status === 'error' || p.status === 'pending' || p.status === 'skipped')
                    && (pendingFiles.some(p => p.status === 'success') || pendingFiles.some(p => p.status === 'error'))
                    ? `Reenviar todos (${pendingFiles.length})`
                    : `Confirmar e enviar ${pendingFiles.length} foto${pendingFiles.length !== 1 ? 's' : ''}`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Cancel Upload Dialog */}
      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar upload?</AlertDialogTitle>
            <AlertDialogDescription>
              O progresso atual será interrompido. Você poderá retomar os arquivos restantes mais tarde se mantiver o diálogo de upload aberto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Não, continuar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                cancelOngoingUpload('confirmacao_alert_dialog');
                setConfirmCancelOpen(false);
              }}
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Delete folder confirmation */}
      <AlertDialog open={deleteFolderOpen} onOpenChange={(v) => { if (!deleting) setDeleteFolderOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta inteira?</AlertDialogTitle>
            <AlertDialogDescription>
              Removerá <strong>{photosOfDate.length} foto(s)</strong> da pasta{' '}
              {dateKey && <strong>{format(new Date(dateKey + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong>}.
              {' '}Você terá {UNDO_MS / 1000}s para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleting && deleteProgress.total > 0 && (
            <div className="space-y-1">
              <p className="text-xs">Removendo {deleteProgress.current} de {deleteProgress.total}…</p>
              <div className="h-2 w-full bg-muted rounded overflow-hidden">
                <div className="h-full bg-destructive transition-all" style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete selection confirmation */}
      <AlertDialog open={deleteSelectionOpen} onOpenChange={(v) => { if (!deleting) setDeleteSelectionOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fotos selecionadas?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão removidas <strong>{selectedIds.size} foto(s)</strong>. Você terá {UNDO_MS / 1000}s para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelection}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir selecionadas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete single photo confirmation */}
      <AlertDialog open={!!deleteSingleOpen} onOpenChange={(v) => { if (!deleting && !v) setDeleteSingleOpen(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta foto?</AlertDialogTitle>
            <AlertDialogDescription>
              A foto será removida. Você terá {UNDO_MS / 1000}s para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSingle}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
