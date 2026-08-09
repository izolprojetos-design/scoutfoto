import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSignedPhotoUrl } from '@/lib/storageUtils';
import { formatDatePtBR, formatTimePtBR, formatPhoneBR } from '@/lib/formatting';
import ScoutPhoto from '@/components/ScoutPhoto';
import ScoutAvatar from '@/components/ScoutAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Plus, Search, Users, ArrowRightLeft, UserPlus, Trash2, Camera, ChevronDown, ChevronUp, Pencil, Download, Cloud, X, ImageIcon, FileDown, FileSpreadsheet, UserCheck, UserX, Power, ListOrdered, SlidersHorizontal, GitCompare, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { differenceInYears } from 'date-fns';
import { logAudit } from '@/lib/auditLog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCurrentBranch,
  getNextBranchChange,
  formatAge,
  formatTimeLeft,
  calculateAge,
  calculateAgeInMonths,
  parseLocalDate,
  SCOUT_BRANCHES,
  ALL_CATEGORIES,
} from '@/lib/scoutUtils';
import ImageCropper from '@/components/ImageCropper';
import { getInitials, stringToColor } from '@/lib/avatarUtils';
import ScoutGallery from '@/components/ScoutGallery';
import ScoutFolders from '@/components/ScoutFolders';
import ScoutHistory from '@/components/ScoutHistory';
import ScoutTimeline from '@/components/ScoutTimeline';
import ScoutStats from '@/components/ScoutStats';
import ScoutEvents from '@/components/ScoutEvents';
import ScoutAchievements from '@/components/ScoutAchievements';

// exportScoutProfilePdf is loaded dynamically on click to keep jsPDF out of the initial Scouts chunk
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CloudPhotoPickerDialog from '@/components/CloudPhotoPickerDialog';
import { compressScoutPhoto } from '@/lib/imageCompression';
import { VOLUNTEER_SECTIONS, VOLUNTEER_CARGO_CATEGORIES, parseVolunteerSection, buildVolunteerSection } from '@/lib/sectionOptions';

interface Scout {
  id: string;
  name: string;
  photo_url: string | null;
  birth_date: string;
  scout_group: string;
  notes: string;
  created_at: string;
  manual_branch: string | null;
  subgroup_id: string | null;
  registration_id: string;
  phone: string;
  section: string;
  transition_date: string | null;
  admission_date: string | null;
  is_active: boolean;
}

interface Subgroup {
  id: string;
  name: string;
  branch_key: string;
}

interface Guardian {
  id: string;
  name: string;
  email: string;
  phone: string;
  scout_id: string;
  image_authorization: boolean;
  authorization_date: string | null;
}

const branchColorMap: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB (${bytes.toLocaleString()} bytes)`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB (${bytes.toLocaleString()} bytes)`;
  return `${bytes.toLocaleString()} bytes`;
};

const getFileDetails = (file: File | { name: string; type?: string; size?: number }) => {
  const name = file.name;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = file.type || 'MIME desconhecido';
  const size = 'size' in file ? formatFileSize(file.size || 0) : 'Tamanho desconhecido';
  return { name, ext, mime, size };
};

const Scouts = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, isAdmin, isVoluntario, canUpload } = useAuth();
  const { canManageScouts, canEditScouts, canViewGuardians } = usePermissions();
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [exportConfirm, setExportConfirm] = useState<'pdf' | 'excel' | 'docx' | 'sheets' | null>(null);
  const [branchFilter, setBranchFilter] = useState('all');
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchAnnouncement, setBranchAnnouncement] = useState('');
  const branchPickerRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  // Advanced filters
  const [sectionFilter, setSectionFilter] = useState<string[]>([]);
  const [subgroupFilter, setSubgroupFilter] = useState<string[]>([]);
  const [ageMinFilter, setAgeMinFilter] = useState<string>('');
  const [ageMaxFilter, setAgeMaxFilter] = useState<string>('');
  const [tenureMinFilter, setTenureMinFilter] = useState<string>('');
  const [photoFilter, setPhotoFilter] = useState<'all' | 'with' | 'without'>('all');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guardianDialogOpen, setGuardianDialogOpen] = useState(false);
  const [selectedScout, setSelectedScout] = useState<Scout | null>(null);
  const [expandedScouts, setExpandedScouts] = useState<Set<string>>(new Set());
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [viewingScout, setViewingScout] = useState<Scout | null>(null);
  const [hasPhotos, setHasPhotos] = useState<boolean>(false);
  const [renumbering, setRenumbering] = useState(false);
  
  const [pendingResend, setPendingResend] = useState<{ scoutId: string; scoutName: string; photo: File } | null>(null);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingScout, setEditingScout] = useState<Scout | null>(null);
  const [editName, setEditName] = useState('');
  const [editBirth, setEditBirth] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editBranch, setEditBranch] = useState('auto');
  const [editSubgroup, setEditSubgroup] = useState('none');
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editUploading, setEditUploading] = useState(false);
  const [editRegistrationId, setEditRegistrationId] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editTransitionDate, setEditTransitionDate] = useState('');
  const [editAdmissionDate, setEditAdmissionDate] = useState('');
  // Scout form
  const [scoutName, setScoutName] = useState('');
  const [scoutBirth, setScoutBirth] = useState('');
  const [scoutGroup, setScoutGroup] = useState('');
  const [scoutNotes, setScoutNotes] = useState('');
  const [scoutBranch, setScoutBranch] = useState('auto');
  const [scoutSubgroup, setScoutSubgroup] = useState('none');
  const [scoutPhoto, setScoutPhoto] = useState<File | null>(null);
  const [scoutPhotoPreview, setScoutPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scoutRegistrationId, setScoutRegistrationId] = useState('');
  const [scoutPhone, setScoutPhone] = useState('');
  const [scoutSection, setScoutSection] = useState('');
  const [scoutTransitionDate, setScoutTransitionDate] = useState('');
  const [scoutAdmissionDate, setScoutAdmissionDate] = useState('');

  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [discardConfirmText, setDiscardConfirmText] = useState('');
  const [cropperImage, setCropperImage] = useState('');
  const [cropperTarget, setCropperTarget] = useState<'new' | 'edit'>('new');
  // Tracks if a camera/file picker is currently in progress (prevents parent Dialog from closing on mobile remount)
  const photoPickInProgressRef = useRef(false);

  // Cloud picker state
  const [cloudPickerOpen, setCloudPickerOpen] = useState(false);
  const [cloudPickerTarget, setCloudPickerTarget] = useState<'new' | 'edit'>('new');
  const [cloudPickerInitialSearch, setCloudPickerInitialSearch] = useState('');

  // Photos hub (quick access from toolbar)
  const [photosHubOpen, setPhotosHubOpen] = useState(false);
  const [photosHubSearch, setPhotosHubSearch] = useState('');
  const [photosHubScoutId, setPhotosHubScoutId] = useState<string | null>(null);
  const [photosHubReloadKey, setPhotosHubReloadKey] = useState(0);
  const [photosHubDragging, setPhotosHubDragging] = useState(false);
  const [photosHubUploading, setPhotosHubUploading] = useState(false);
  const [photosHubProgress, setPhotosHubProgress] = useState({ current: 0, total: 0, currentFileName: '' });
  const [photosHubSummary, setPhotosHubSummary] = useState<{ accepted: number; rejected: number; pending: number; error?: string; failedFiles?: { name: string; file: File; error: string }[]; rejectedFiles?: { name: string; reason: string }[]; acceptedFiles?: { name: string; type: string; size: number }[]; rawFiles?: File[] } | null>(null);
  const [photosHubSort, setPhotosHubSort] = useState<{ field: 'name' | 'type' | 'size'; direction: 'asc' | 'desc' }>({ field: 'name', direction: 'asc' });
  const photosHubDragCounter = useRef(0);

  const PHOTOS_HUB_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const PHOTOS_HUB_ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
  const PHOTOS_HUB_MAX_SIZE = 10 * 1024 * 1024; // 10MB por imagem

  const removeFileFromQueue = (fileName: string) => {
    if (!photosHubSummary?.rawFiles) return;
    const updatedFiles = photosHubSummary.rawFiles.filter(f => f.name !== fileName);
    processPhotosHubFiles(updatedFiles);
  };

  const processPhotosHubFiles = (files: File[]) => {
    const isAllowedImage = (f: File) => {
      const type = (f.type || '').toLowerCase();
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      
      // Normalização para evitar falsos positivos
      const isAcceptedMime = PHOTOS_HUB_ALLOWED_TYPES.some(allowed => 
        type === allowed || (type.startsWith('image/') && allowed.includes(type.split('/')[1]))
      );
      const isAcceptedExt = PHOTOS_HUB_ALLOWED_EXT.includes(ext);

      return isAcceptedMime || isAcceptedExt;
    };

    const rejectedType = files.filter(f => !isAllowedImage(f));
    const allowed = files.filter(isAllowedImage);
    const oversized = allowed.filter(f => f.size > PHOTOS_HUB_MAX_SIZE);
    const valid = allowed.filter(f => f.size <= PHOTOS_HUB_MAX_SIZE);

    const rejectedFilesDetails = [
      ...rejectedType.map(f => ({ name: f.name, reason: 'Tipo não permitido (use JPG, PNG, WEBP, HEIC ou HEIF)' })),
      ...oversized.map(f => ({ name: f.name, reason: 'Arquivo muito grande (máximo 10MB)' }))
    ];
    
    const acceptedFilesDetails = valid.map(f => ({
      name: f.name,
      type: (f.type || f.name.split('.').pop() || '').toUpperCase(),
      size: f.size
    }));

    setPhotosHubSummary({
      accepted: valid.length,
      rejected: rejectedFilesDetails.length,
      pending: valid.length,
      rejectedFiles: rejectedFilesDetails,
      acceptedFiles: acceptedFilesDetails,
      rawFiles: files
    });

    if (rejectedFilesDetails.length > 0) {
      toast.error(`${rejectedFilesDetails.length} arquivo(s) foram ignorados.`);
    }

    return valid;
  };

  const uploadPhotosHubFiles = async (files: File[]) => {
    if (!user || !photosHubScoutId || files.length === 0) return;
    
    // Se não houver resumo ou for uma tentativa nova, inicializa
    if (!photosHubSummary || !photosHubSummary.rawFiles) {
      const valid = processPhotosHubFiles(files);
      if (valid.length === 0) return;
    }

    const { compressImage } = await import('@/lib/imageCompression');
    setPhotosHubUploading(true);
    setPhotosHubProgress({ current: 0, total: files.length, currentFileName: '' });
    setPhotosHubSummary(prev => prev ? { ...prev, error: undefined, failedFiles: prev.failedFiles?.filter(f => !files.includes(f.file)) } : null);
    
    let success = 0;
    const abortController = new AbortController();
    (window as any)._photosHubAbortController = abortController;

    for (let i = 0; i < files.length; i++) {
      if (abortController.signal.aborted) {
        toast.info('Upload cancelado pelo usuário');
        break;
      }

      const file = files[i];
      setPhotosHubProgress({ current: i + 1, total: files.length, currentFileName: file.name });
      setPhotosHubSummary(prev => prev ? { ...prev, pending: files.length - i } : null);
      
      try {
        let compressed: File | Blob = file;
        try { 
          compressed = await compressImage(file); 
        } catch (e) { 
          console.warn('Compression failed, using original', e);
        }
        
        let mime = (compressed as File).type || file.type || 'image/jpeg';
        let ext = (mime.split('/')[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
        if (!['jpg', 'png', 'webp'].includes(ext)) { ext = 'jpg'; mime = 'image/jpeg'; }
        
        const currentYear = new Date().getFullYear();
        const currentDate = format(new Date(), 'yyyy-MM-dd');
        const timestamp = format(new Date(), 'HH-mm-ss');
        const scout = scouts.find(s => s.id === photosHubScoutId);
        const safeName = (scout?.name || 'membro')
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_\-]/g, '_')
          .toUpperCase();
          
        const path = `gallery/${photosHubScoutId}/${currentYear}/${currentDate}/${safeName}_${currentDate}_${timestamp}_${i}.${ext}`;
        
        const { error: upErr } = await supabase.storage
          .from('scout-photos')
          .upload(path, compressed, { upsert: false, contentType: mime });
          
        if (upErr) throw upErr;
        
        const { error: dbErr } = await supabase.from('scout_photos' as any).insert({
          scout_id: photosHubScoutId,
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
        console.error('photos-hub upload err', err);
        const errorMsg = err?.message || 'Erro de conexão ou armazenamento';
        setPhotosHubSummary(prev => {
          if (!prev) return null;
          const failedFiles = prev.failedFiles || [];
          if (!failedFiles.find(f => f.file === file)) {
            failedFiles.push({ name: file.name, file, error: errorMsg });
          }
          return { ...prev, error: `Falha ao enviar "${file.name}": ${errorMsg}`, failedFiles };
        });
        toast.error(`Falha ao enviar "${file.name}": ${errorMsg}`);
      }
    }
    
    setPhotosHubUploading(false);
    setPhotosHubSummary(prev => prev ? { ...prev, pending: 0 } : null);
    setPhotosHubProgress(prev => ({ ...prev, currentFileName: '' }));
    
    if (success > 0) {
      toast.success(`${success} foto(s) enviada(s) com sucesso`);
      setPhotosHubReloadKey(k => k + 1);
    }
  };

  // Guardian form (separate dialog)
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianAuth, setGuardianAuth] = useState(true);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [creatingSubgroup, setCreatingSubgroup] = useState(false);
  const [customSectionMode, setCustomSectionMode] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // Inline guardian for new scout (minor)
  const [inlineGuardianName, setInlineGuardianName] = useState('');
  const [inlineGuardianEmail, setInlineGuardianEmail] = useState('');
  const [inlineGuardianPhone, setInlineGuardianPhone] = useState('');
  const [inlineGuardianAuth, setInlineGuardianAuth] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<'available' | 'unavailable' | 'denied'>('available');

  // Audit log dedup — avoid spamming the audit table with repeated camera issues per session
  const cameraAuditLoggedRef = useRef<Set<string>>(new Set());
  const logCameraIssue = (
    kind: 'denied' | 'unavailable',
    reason: string,
    extra?: Record<string, unknown>
  ) => {
    const key = `${kind}:${reason}`;
    if (cameraAuditLoggedRef.current.has(key)) return;
    cameraAuditLoggedRef.current.add(key);
    if (!user) return;
    logAudit(
      user.id,
      kind === 'denied' ? 'camera_access_denied' : 'camera_unavailable',
      undefined,
      {
        reason,
        user_email: profile?.email,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        platform: typeof navigator !== 'undefined' ? (navigator as any).platform : null,
        url: typeof window !== 'undefined' ? window.location.pathname : null,
        timestamp: new Date().toISOString(),
        ...(extra || {}),
      }
    ).catch(err => console.warn('[CAMERA AUDIT] failed to log', err));
  };


  // Auto-clear broken photo URLs from the database
  const clearedPhotoIds = useRef(new Set<string>());
  const handleBrokenPhoto = async (scoutId: string, imgEl: HTMLImageElement) => {
    imgEl.style.display = 'none';
    const fallback = imgEl.nextElementSibling as HTMLElement;
    if (fallback) fallback.style.display = 'flex';
    if (clearedPhotoIds.current.has(scoutId)) return;
    clearedPhotoIds.current.add(scoutId);
    await supabase.from('scouts').update({ photo_url: null }).eq('id', scoutId);
    setScouts(prev => prev.map(s => s.id === scoutId ? { ...s, photo_url: null } : s));
  };

  const fetchData = async () => {
    const [{ data: scoutData }, { data: guardianData }, { data: subgroupData }] = await Promise.all([
      supabase.from('scouts').select('*').order('name'),
      supabase.from('guardians').select('*'),
      supabase.from('subgroups').select('*').order('name'),
    ]);
    setScouts(scoutData || []);
    setGuardians(guardianData || []);
    setSubgroups(subgroupData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const checkCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          setCameraStatus('unavailable');
          logCameraIssue('unavailable', 'mediaDevices_api_missing');
          return;
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some(device => device.kind === 'videoinput');
        
        if (!hasVideo) {
          setCameraStatus('unavailable');
          logCameraIssue('unavailable', 'no_video_input_device');
          return;
        }

        if (navigator.permissions && (navigator.permissions as any).query) {
          try {
            const result = await navigator.permissions.query({ name: 'camera' as any });
            if (result.state === 'denied') {
              setCameraStatus('denied');
              logCameraIssue('denied', 'permissions_api_state_denied');
            }
            
            result.onchange = () => {
              if (result.state === 'denied') {
                setCameraStatus('denied');
                logCameraIssue('denied', 'permissions_api_changed_to_denied');
              } else {
                setCameraStatus('available');
              }
            };
          } catch (e) {
            // Permission query for camera might not be supported
          }
        }
      } catch (err) {
        console.error('Error checking camera:', err);
      }
    };
    checkCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);



  // Branch picker (DropdownMenu) handles click-outside and item-select auto-close natively via Radix.

  // Update hasPhotos state when viewingScout or editDialogOpen changes
  useEffect(() => {
    const checkPhotos = async (scoutId: string) => {
      const { count } = await supabase
        .from('scout_photos' as any)
        .select('*', { count: 'exact', head: true })
        .eq('scout_id', scoutId);
      setHasPhotos((count || 0) > 0);
    };

    if (viewingScout) {
      checkPhotos(viewingScout.id);
    } else if (editingScout) {
      checkPhotos(editingScout.id);
    } else {
      setHasPhotos(false);
    }
  }, [viewingScout, editingScout]);

  // Auto-open edit dialog when navigated with ?edit=scoutId
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && scouts.length > 0 && !editDialogOpen) {
      const scout = scouts.find(s => s.id === editId);
      if (scout) {
        openEditDialog(scout);
        setSearchParams({}, { replace: true });
      }
    }
  }, [scouts, searchParams]);

  const toggleExpand = (id: string) => {
    setExpandedScouts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePhotoPickStart = () => {
    photoPickInProgressRef.current = true;
    const timer = setTimeout(() => { photoPickInProgressRef.current = false; }, 60000);
    const clearPicking = () => {
      photoPickInProgressRef.current = false;
      clearTimeout(timer);
      window.removeEventListener('focus', clearPicking);
    };
    window.addEventListener('focus', clearPicking, { once: true });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      photoPickInProgressRef.current = false;
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperImage(reader.result as string);
      setCropperTarget('new');
      setCropperOpen(true);
      // keep flag true; cleared when cropper closes
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleEditPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      photoPickInProgressRef.current = false;
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperImage(reader.result as string);
      setCropperTarget('edit');
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedFile: File) => {
    const target = cropperTarget;
    const currentEditingScout = editingScout;
    
    console.log('[CROP] handleCropComplete called', { target, size: croppedFile.size, type: croppedFile.type, editingScoutId: currentEditingScout?.id });

    // Update previews immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (target === 'new') {
        setScoutPhoto(croppedFile);
        setScoutPhotoPreview(result);
      } else {
        setEditPhoto(croppedFile);
        setEditPhotoPreview(result);
      }
    };
    reader.onerror = () => console.error('[CROP] reader error', reader.error);
    reader.readAsDataURL(croppedFile);

    setCropperOpen(false);
    // Keep the guard active briefly so any synthesized pointer/click events
    // emitted while the cropper dialog unmounts don't bubble to the parent
    // "Editar Membro" dialog and accidentally close it on mobile.
    photoPickInProgressRef.current = true;
    setTimeout(() => { photoPickInProgressRef.current = false; }, 600);

    // Removed auto-save logic to keep the photo in memory until the main "Save" button is clicked
    // This allows the user to finish editing other fields before committing the new photo to storage.

  };

  const uploadPhoto = async (scoutId: string, photo: File, scoutNameForFile?: string): Promise<string | null> => {
    const ext = photo.name.split('.').pop() || 'jpg';
    // Use scout name as filename: normalize accents, replace spaces with underscores
    const safeName = (scoutNameForFile || scoutId)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const path = `${safeName}_${scoutId.slice(0, 8)}.${ext}`;
    // Remove old file if exists (different name pattern)
    const { data: existingFiles } = await supabase.storage.from('scout-photos').list('', { search: scoutId.slice(0, 8) });
    if (existingFiles) {
      for (const f of existingFiles) {
        if (f.name.includes(scoutId.slice(0, 8)) && f.name !== path) {
          await supabase.storage.from('scout-photos').remove([f.name]);
        }
      }
    }
    const compressed = await compressScoutPhoto(photo);
    const { error } = await supabase.storage.from('scout-photos').upload(path, compressed, { upsert: true, contentType: compressed.type });
    if (error) { console.error('Upload error:', error); return null; }
    // Always store the storage path (not a signed URL) — signed URLs expire in 1h
    return path;
  };

  const handleCreateScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUploading(true);

    const { data, error } = await supabase.from('scouts').insert({
      name: scoutName,
      birth_date: scoutBirth,
      scout_group: scoutGroup,
      notes: scoutNotes,
      created_by: user.id,
      manual_branch: scoutBranch !== 'auto' ? scoutBranch : null,
      subgroup_id: scoutSubgroup !== 'none' ? scoutSubgroup : null,
      registration_id: scoutRegistrationId,
      phone: scoutPhone,
      section: scoutSection,
      transition_date: scoutTransitionDate || null,
      admission_date: scoutAdmissionDate || null,
    }).select('id').single();


    if (error) {
      toast.error('Erro ao cadastrar: ' + error.message);
      setUploading(false);
      return;
    }

    if (scoutPhoto && data) {
      toast.loading('Enviando foto...', { id: 'create-photo' });
      try {
        const photoUrl = await uploadPhoto(data.id, scoutPhoto, scoutName);
        if (!photoUrl) throw new Error('upload retornou nulo');
        const { error: updErr } = await supabase
          .from('scouts')
          .update({ photo_url: photoUrl })
          .eq('id', data.id);
        if (updErr) throw updErr;
        toast.success('Foto salva!', { id: 'create-photo' });
      } catch (err: any) {
        console.error('[CREATE] photo upload failed', err);
        const failedPhoto = scoutPhoto;
        const newScoutId = data.id;
        const newScoutName = scoutName;
        // Persistent banner fallback (toast action may disappear)
        setPendingResend({ scoutId: newScoutId, scoutName: newScoutName, photo: failedPhoto });
        toast.error('Integrante criado, mas a foto falhou. Use o botão "Reenviar foto" no topo da página.', {
          id: 'create-photo',
          duration: 8000,
        });
      }
    }

    // Save inline guardian if minor and guardian name provided
    if (data && inlineGuardianName.trim()) {
      await supabase.from('guardians').insert({
        name: inlineGuardianName,
        email: inlineGuardianEmail,
        phone: inlineGuardianPhone,
        scout_id: data.id,
        image_authorization: inlineGuardianAuth,
        authorization_date: inlineGuardianAuth ? new Date().toISOString() : null,
        created_by: user.id,
      });
    }

    toast.success('Membro cadastrado com sucesso!');
    setDialogOpen(false);
    setScoutName(''); setScoutBirth(''); setScoutGroup(''); setScoutNotes(''); setScoutBranch('auto'); setScoutSubgroup('none');
    setScoutPhoto(null); setScoutPhotoPreview(null);
    setScoutRegistrationId(''); setScoutPhone(''); setScoutSection(''); setScoutTransitionDate(''); setScoutAdmissionDate('');
    setInlineGuardianName(''); setInlineGuardianEmail(''); setInlineGuardianPhone(''); setInlineGuardianAuth(false);
    setUploading(false);
    fetchData();
  };

  const openEditDialog = (scout: Scout) => {
    setEditingScout(scout);
    setEditName(scout.name);
    setEditBirth(scout.birth_date);
    setEditGroup(scout.scout_group);
    setEditNotes(scout.notes || '');
    setEditBranch(scout.manual_branch || 'auto');
    setEditSubgroup(scout.subgroup_id || 'none');
    setEditRegistrationId(scout.registration_id ? scout.registration_id.padStart(4, '0') : '');
    setEditPhone(scout.phone || '');
    setEditSection(scout.section || '');
    setEditTransitionDate(scout.transition_date || '');
    setEditAdmissionDate(scout.admission_date || (scout.created_at ? scout.created_at.split('T')[0] : ''));

    const branchKey = scout.manual_branch || '';
    const knownSections = branchKey ? [...new Set(scouts.filter(s => (s.manual_branch || '') === branchKey && s.section).map(s => s.section))] : [];
    setCustomSectionMode(!!scout.section && !knownSections.includes(scout.section));
    setEditPhoto(null);
    setEditDialogOpen(true);

    // Resolve signed URL for preview only — never auto-clear photo_url on transient failures
    if (scout.photo_url) {
      getSignedPhotoUrl(scout.photo_url).then(signedUrl => {
        setEditPhotoPreview(signedUrl);
      });
    } else {
      setEditPhotoPreview(null);
    }
  };

  const renamePhotoInStorage = async (scoutId: string, newName: string, currentPhotoUrl: string): Promise<string | null> => {
    try {
      const idPrefix = scoutId.slice(0, 8);
      // Build new filename
      const ext = currentPhotoUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const safeName = newName
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      const newPath = `${safeName}_${idPrefix}.${ext}`;

      // Find old file
      const { data: files } = await supabase.storage.from('scout-photos').list('', { search: idPrefix });
      const oldFile = files?.find(f => f.name.includes(idPrefix));
      if (!oldFile || oldFile.name === newPath) return null; // already correct or not found

      // Download old file, upload with new name, delete old
      const { data: downloaded } = await supabase.storage.from('scout-photos').download(oldFile.name);
      if (!downloaded) return null;

      await supabase.storage.from('scout-photos').upload(newPath, downloaded, { upsert: true });
      await supabase.storage.from('scout-photos').remove([oldFile.name]);

      // Store the storage path, not a signed URL
      return newPath;
    } catch (err) {
      console.error('Error renaming photo in storage:', err);
      return null;
    }
  };

  const handleEditScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScout) return;
    console.log('[EDIT] handleEditScout submit', { hasNewPhoto: !!editPhoto, photoSize: editPhoto?.size });
    setEditUploading(true);

    let photoUrl = editingScout.photo_url;
    if (editPhoto) {
      console.log('[EDIT] uploading photo...');
      const uploaded = await uploadPhoto(editingScout.id, editPhoto, editName);
      console.log('[EDIT] upload result:', uploaded);
      if (uploaded) photoUrl = uploaded;
      else {
        toast.error('Falha ao enviar foto. Verifique a conexão e tente novamente.');
        setEditUploading(false);
        return;
      }
    } else if (photoUrl && editName !== editingScout.name) {
      // Name changed but no new photo — rename file in storage
      const renamed = await renamePhotoInStorage(editingScout.id, editName, photoUrl);
      if (renamed) photoUrl = renamed;
    }

    const { error } = await supabase.from('scouts').update({
      name: editName,
      birth_date: editBirth,
      scout_group: editGroup,
      notes: editNotes,
      photo_url: photoUrl,
      manual_branch: editBranch !== 'auto' ? editBranch : null,
      subgroup_id: editSubgroup !== 'none' ? editSubgroup : null,
      registration_id: editRegistrationId,
      phone: editPhone,
      section: editSection,
      transition_date: editTransitionDate || null,
      admission_date: editAdmissionDate || null,
    }).eq('id', editingScout.id);


    if (error) {
      console.error('[EDIT] update error:', error);
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      console.log('[EDIT] update success');
      toast.success('Membro atualizado com sucesso!');
      setEditDialogOpen(false);
      fetchData();
    }
    setEditUploading(false);
  };

  const handleAddGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedScout) return;

    if (editingGuardianId) {
      const { error } = await supabase.from('guardians').update({
        name: guardianName,
        email: guardianEmail,
        phone: guardianPhone,
        image_authorization: guardianAuth,
        authorization_date: guardianAuth ? new Date().toISOString() : null,
      }).eq('id', editingGuardianId);
      if (error) return toast.error('Erro: ' + error.message);
      toast.success('Responsável atualizado!');
    } else {
      const { error } = await supabase.from('guardians').insert({
        name: guardianName,
        email: guardianEmail,
        phone: guardianPhone,
        scout_id: selectedScout.id,
        image_authorization: guardianAuth,
        authorization_date: guardianAuth ? new Date().toISOString() : null,
        created_by: user.id,
      });
      if (error) return toast.error('Erro: ' + error.message);
      toast.success('Responsável adicionado!');
    }
    setGuardianDialogOpen(false);
    setEditingGuardianId(null);
    setGuardianName(''); setGuardianEmail(''); setGuardianPhone(''); setGuardianAuth(false);
    fetchData();
  };

  const openEditGuardian = (scout: Scout, g: Guardian) => {
    setSelectedScout(scout);
    setEditingGuardianId(g.id);
    setGuardianName(g.name || '');
    setGuardianEmail(g.email || '');
    setGuardianPhone(g.phone || '');
    setGuardianAuth(!!g.image_authorization);
    setGuardianDialogOpen(true);
  };

  const handleDeleteGuardian = async (id: string) => {
    const { error } = await supabase.from('guardians').delete().eq('id', id);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Responsável removido!');
    fetchData();
  };

  const handleDeleteScout = async (scoutId: string) => {
    const { error } = await supabase.from('scouts').delete().eq('id', scoutId);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Membro excluído!');
      fetchData();
    }
  };

  const getEffectiveBranch = (scout: Scout) => {
    if (scout.manual_branch) {
      return ALL_CATEGORIES.find(b => b.key === scout.manual_branch) || getCurrentBranch(parseLocalDate(scout.birth_date));
    }
    const current = getCurrentBranch(parseLocalDate(scout.birth_date));
    if (current) return current;

    // Fallback para adultos sem ramo manual (>= 21 anos)
    const birthDate = parseLocalDate(scout.birth_date);
    const now = new Date();
    let ageYears = now.getFullYear() - birthDate.getFullYear();
    if (now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())) {
      ageYears--;
    }
    if (ageYears >= 21) {
      return ALL_CATEGORIES.find(b => b.key === 'voluntario') || null;
    }
    
    return null;
  };

  const branchOrder = useMemo(() => ALL_CATEGORIES.map(b => b.key), []);

  // O(1) lookup maps — avoid .find()/.filter() per row on every render
  const subgroupsById = useMemo(() => {
    const m = new Map<string, Subgroup>();
    for (const sg of subgroups) m.set(sg.id, sg);
    return m;
  }, [subgroups]);

  const guardiansByScoutId = useMemo(() => {
    const m = new Map<string, Guardian[]>();
    for (const g of guardians) {
      const arr = m.get(g.scout_id);
      if (arr) arr.push(g);
      else m.set(g.scout_id, [g]);
    }
    return m;
  }, [guardians]);

  const filteredScouts = useMemo(() => scouts.filter(s => {
    // Status filter
    if (statusFilter === 'active' && !s.is_active) return false;
    if (statusFilter === 'inactive' && s.is_active) return false;

    const term = search.toLowerCase();
    const subgroupName = s.subgroup_id ? subgroupsById.get(s.subgroup_id)?.name || '' : '';
    const matchSearch = s.name.toLowerCase().includes(term) ||
      (s.section || '').toLowerCase().includes(term) ||
      subgroupName.toLowerCase().includes(term);
    if (branchFilter === '') return false;
    const branch = getEffectiveBranch(s);
    if (branchFilter !== 'all' && branch?.key !== branchFilter) return false;
    if (!matchSearch) return false;

    // Advanced filters
    if (sectionFilter.length > 0 && !sectionFilter.includes(s.section || '')) return false;
    if (subgroupFilter.length > 0) {
      const sgKey = s.subgroup_id || '__none__';
      if (!subgroupFilter.includes(sgKey)) return false;
    }
    const ageYears = differenceInYears(new Date(), parseLocalDate(s.birth_date));
    if (ageMinFilter && ageYears < Number(ageMinFilter)) return false;
    if (ageMaxFilter && ageYears > Number(ageMaxFilter)) return false;
    if (tenureMinFilter) {
      const tenureYears = differenceInYears(new Date(), new Date(s.created_at));
      if (tenureYears < Number(tenureMinFilter)) return false;
    }
    if (photoFilter === 'with' && !s.photo_url) return false;
    if (photoFilter === 'without' && s.photo_url) return false;

    return true;
  }).sort((a, b) => {
    if (branchFilter !== 'all') return 0;
    const branchA = getEffectiveBranch(a);
    const branchB = getEffectiveBranch(b);
    const idxA = branchA ? branchOrder.indexOf(branchA.key) : 999;
    const idxB = branchB ? branchOrder.indexOf(branchB.key) : 999;
    return idxA - idxB;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scouts, statusFilter, search, subgroupsById, branchFilter, sectionFilter, subgroupFilter, ageMinFilter, ageMaxFilter, tenureMinFilter, photoFilter, branchOrder]);

  // Distinct values for advanced filter options (based on currently visible status + branch scope)
  const scopedScouts = useMemo(() => scouts.filter(s => {
    if (statusFilter === 'active' && !s.is_active) return false;
    if (statusFilter === 'inactive' && s.is_active) return false;
    if (branchFilter && branchFilter !== 'all' && branchFilter !== '') {
      const b = getEffectiveBranch(s);
      if (b?.key !== branchFilter) return false;
    }
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scouts, statusFilter, branchFilter]);

  const availableSections = useMemo(
    () => Array.from(new Set(scopedScouts.map(s => s.section).filter(Boolean) as string[])).sort(),
    [scopedScouts]
  );
  const availableSubgroups = useMemo(
    () => Array.from(new Set(scopedScouts.map(s => s.subgroup_id || '__none__')))
      .map(id => id === '__none__' ? { id: '__none__', name: '— Sem equipe —' } : subgroupsById.get(id))
      .filter(Boolean) as { id: string; name: string }[],
    [scopedScouts, subgroupsById]
  );

  const advancedActiveCount =
    sectionFilter.length +
    subgroupFilter.length +
    (ageMinFilter ? 1 : 0) +
    (ageMaxFilter ? 1 : 0) +
    (tenureMinFilter ? 1 : 0) +
    (photoFilter !== 'all' ? 1 : 0);

  const clearAdvancedFilters = () => {
    setSectionFilter([]);
    setSubgroupFilter([]);
    setAgeMinFilter('');
    setAgeMaxFilter('');
    setTenureMinFilter('');
    setPhotoFilter('all');
  };

  const toggleArrayValue = (arr: string[], value: string, setter: (v: string[]) => void) => {
    if (arr.includes(value)) setter(arr.filter(v => v !== value));
    else setter([...arr, value]);
  };

  const activeScouts = useMemo(() => scouts.filter(s => s.is_active), [scouts]);
  const inactiveScouts = useMemo(() => scouts.filter(s => !s.is_active), [scouts]);

  const branchCounts = useMemo(() => activeScouts.reduce((acc, s) => {
    const branch = getEffectiveBranch(s);
    if (branch) acc[branch.key] = (acc[branch.key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [activeScouts]);

  const handleToggleActive = async (scout: Scout) => {
    const newStatus = !scout.is_active;
    const { error } = await supabase.from('scouts').update({ is_active: newStatus }).eq('id', scout.id);
    if (error) {
      toast.error('Erro ao alterar status: ' + error.message);
      return;
    }
    if (user) {
      await logAudit(user.id, 'status_change', undefined, {
        target_id: scout.id,
        target_name: scout.name,
      }, { is_active: scout.is_active }, { is_active: newStatus });
    }
    toast.success(newStatus ? `${scout.name} reativado!` : `${scout.name} desativado.`);
    fetchData();
  };

  const getGuardiansForScout = (scoutId: string) =>
    guardiansByScoutId.get(scoutId) ?? [];


  const handleCreateSubgroup = async (branchKey: string) => {
    if (!user || !newSubgroupName.trim()) return null;
    setCreatingSubgroup(true);
    const name = newSubgroupName.trim();
    const { data, error } = await supabase.from('subgroups').insert({
      name,
      branch_key: branchKey,
      created_by: user.id,
    }).select('*').single();
    setCreatingSubgroup(false);
    if (error) {
      toast.error('Erro ao criar equipe: ' + error.message);
      return null;
    }
    if (data) {
      toast.success('Equipe criada!');
      setNewSubgroupName('');
      setSubgroups(prev => [...prev, data as Subgroup]);
      return data.id;
    }
    return null;
  };

  const handleExportPDF = async () => {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const filterLabel = branchFilter === 'all' ? 'Todos' : ALL_CATEGORIES.find(b => b.key === branchFilter)?.name || branchFilter;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Load logo
    let logoBase64: string | null = null;
    try {
      const logoResponse = await fetch('/images/logo-grupo.png');
      const logoBlob = await logoResponse.blob();
      logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
    } catch (e) {
      console.warn('Logo não carregado:', e);
    }

    const drawHeader = (pageDoc: any) => {
      pageDoc.setFillColor(34, 139, 34);
      pageDoc.rect(0, 0, pageWidth, 30, 'F');
      
      if (logoBase64) {
        try { 
          pageDoc.setFillColor(255, 255, 255);
          pageDoc.circle(10 + 10, 15, 12, 'F');
          pageDoc.addImage(logoBase64, 'PNG', 10 + 3, 8, 14, 14, undefined, 'FAST'); 
        } catch { /* */ }
      }
      
      pageDoc.setTextColor(255, 255, 255);
      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setFontSize(10);
      pageDoc.text('LISTA DE INTEGRANTES', 10 + 25, 12);
      pageDoc.setFontSize(14);
      pageDoc.text(`Integrantes - ${filterLabel} (${filteredScouts.length})`, 10 + 25, 22);
      
      pageDoc.setFont('helvetica', 'normal');
      pageDoc.setFontSize(8);
      const now = new Date();
      pageDoc.text(`Exportado em: ${formatDatePtBR(now)} ${formatTimePtBR(now)} • 12º GEMC`, pageWidth - 10, 22, { align: 'right' });
    };

    drawHeader(doc);

    const isVoluntario = branchFilter === 'voluntario';
    const headers = isVoluntario
      ? ['ID', 'Nome', 'Ramo', 'Seção', '1ª Função', '2ª Função', 'Celular', 'Data Nasc.', 'Idade']
      : ['ID', 'Nome', 'Ramo', 'Seção', 'Equipe', 'Celular', 'Data Nasc.', 'Idade', 'Responsável'];
    const sortedScouts = [...filteredScouts].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
    const rows = sortedScouts.map(scout => {
      const branch = getEffectiveBranch(scout);
      const sg = subgroups.find(s => s.id === scout.subgroup_id);
      const scoutGuards = getGuardiansForScout(scout.id);
      const responsavel = scoutGuards.map(g => g.name.toUpperCase()).join('; ') || '';
      if (isVoluntario) {
        const { secao, cargo1, cargo2 } = parseVolunteerSection(scout.section);
        return [
          scout.registration_id || '',
          scout.name.toUpperCase(),
          branch?.name || '',
          secao,
          cargo1,
          cargo2,
          formatPhoneBR(scout.phone) || '',
          parseLocalDate(scout.birth_date).toLocaleDateString('pt-BR'),
          formatAge(parseLocalDate(scout.birth_date)),
        ];
      }
      return [
        scout.registration_id || '',
        scout.name.toUpperCase(),
        branch?.name || '',
        scout.section || '',
        sg?.name || '',
        formatPhoneBR(scout.phone) || '',
        parseLocalDate(scout.birth_date).toLocaleDateString('pt-BR'),
        formatAge(parseLocalDate(scout.birth_date)),
        responsavel,
      ];
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 35,
      styles: { fontSize: 8, cellPadding: 2, textColor: [20, 20, 20] },
      headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 240] },
      margin: { top: 35 },
      didDrawPage: (data: any) => {
        // Draw header on every new page (except first, already drawn)
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
        // Page number footer
        const totalPages = doc.getNumberOfPages();
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(
          `Página ${data.pageNumber} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      },
    });

    // Fix page numbers (totalPages is only accurate after all pages are drawn)
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(120);
      // White rect to clear previous footer text
      doc.setFillColor(255, 255, 255);
      doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    }

    doc.save(`integrantes_${filterLabel.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`${filteredScouts.length} integrantes exportados em PDF!`);
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const filterLabel = branchFilter === 'all' ? 'Todos' : ALL_CATEGORIES.find(b => b.key === branchFilter)?.name || branchFilter;

    const isVoluntario = branchFilter === 'voluntario';
    const sortedScouts = [...filteredScouts].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
    const rows = sortedScouts.map(scout => {
      const branch = getEffectiveBranch(scout);
      const sg = subgroups.find(s => s.id === scout.subgroup_id);
      const scoutGuards = getGuardiansForScout(scout.id);
      const responsavel = scoutGuards.map(g => g.name.toUpperCase()).join('; ') || '';
      if (isVoluntario) {
        const { secao, cargo1, cargo2 } = parseVolunteerSection(scout.section);
        return {
          'ID': scout.registration_id || '',
          'Nome': scout.name.toUpperCase(),
          'Ramo': branch?.name || '',
          'Seção': secao,
          '1ª Função': cargo1,
          '2ª Função': cargo2,
          'Celular': formatPhoneBR(scout.phone) || '',
          'Data de Nascimento': parseLocalDate(scout.birth_date).toLocaleDateString('pt-BR'),
          'Idade': formatAge(parseLocalDate(scout.birth_date)),
        };
      }
      return {
        'ID': scout.registration_id || '',
        'Nome': scout.name.toUpperCase(),
        'Ramo': branch?.name || '',
        'Seção': scout.section || '',
        'Equipe': sg?.name || '',
        'Celular': formatPhoneBR(scout.phone) || '',
        'Data de Nascimento': parseLocalDate(scout.birth_date).toLocaleDateString('pt-BR'),
        'Idade': formatAge(parseLocalDate(scout.birth_date)),
        'Responsável': responsavel,
      };
    });

    const now = new Date();
    const dateStr = formatDatePtBR(now);
    const timeStr = formatTimePtBR(now);
    const headerRows = [
      [`Integrantes - ${filterLabel} (${filteredScouts.length})`],
      ['12º Grupo Escoteiro Monte Caburai-12º GEMC'],
      [`Exportado em: ${dateStr}`],
      [`Horário: ${timeStr}`],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headerRows);
    XLSX.utils.sheet_add_json(ws, rows, { origin: `A${headerRows.length + 1}` });
    const colWidths = isVoluntario
      ? [10, 30, 12, 14, 30, 30, 16, 16, 14]
      : [10, 30, 12, 18, 18, 16, 16, 14, 30];
    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, filterLabel);
    XLSX.writeFile(wb, `integrantes_${filterLabel.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filteredScouts.length} integrantes exportados em Excel!`);
  };

  const handleExportDocx = async () => {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType, PageOrientation } = await import('docx');
    const filterLabel = branchFilter === 'all' ? 'Todos' : ALL_CATEGORIES.find(b => b.key === branchFilter)?.name || branchFilter;
    const isVoluntario = branchFilter === 'voluntario';

    const headers = isVoluntario
      ? ['ID', 'Nome', 'Ramo', 'Seção', '1ª Função', '2ª Função', 'Celular', 'Nascimento', 'Idade']
      : ['ID', 'Nome', 'Ramo', 'Seção', 'Equipe', 'Celular', 'Nascimento', 'Idade', 'Responsável'];

    const sortedScouts = [...filteredScouts].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
    const rowsData = sortedScouts.map(scout => {
      const branch = getEffectiveBranch(scout);
      const sg = subgroups.find(s => s.id === scout.subgroup_id);
      const scoutGuards = getGuardiansForScout(scout.id);
      const responsavel = scoutGuards.map(g => g.name.toUpperCase()).join('; ') || '';
      if (isVoluntario) {
        const { secao, cargo1, cargo2 } = parseVolunteerSection(scout.section);
        return [
          scout.registration_id || '',
          scout.name.toUpperCase(),
          branch?.name || '',
          secao,
          cargo1,
          cargo2,
          formatPhoneBR(scout.phone) || '',
          parseLocalDate(scout.birth_date).toLocaleDateString('pt-BR'),
          formatAge(parseLocalDate(scout.birth_date)),
        ];
      }
      return [
        scout.registration_id || '',
        scout.name.toUpperCase(),
        branch?.name || '',
        scout.section || '',
        sg?.name || '',
        formatPhoneBR(scout.phone) || '',
        parseLocalDate(scout.birth_date).toLocaleDateString('pt-BR'),
        formatAge(parseLocalDate(scout.birth_date)),
        responsavel,
      ];
    });

    const border = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
    const borders = { top: border, bottom: border, left: border, right: border };

    const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map(h => new TableCell({
        borders,
        shading: { fill: 'E8E8E8', type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })],
      })),
    });

    const bodyRows = rowsData.map(row => new TableRow({
      children: row.map(cellText => new TableCell({
        borders,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: String(cellText), size: 16 })] })],
      })),
    }));

    const doc = new Document({
      styles: {
        default: { document: { run: { font: 'Arial', size: 18 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 15840, height: 12240, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Integrantes - ${filterLabel}`, bold: true, size: 32 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '12º Grupo Escoteiro Monte Caburai-12º GEMC', size: 20, color: '444444' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Exportado em: ${formatDatePtBR()}`, size: 18, color: '666666' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: `Horário: ${formatTimePtBR()} • Total: ${filteredScouts.length}`, size: 18, color: '666666' })],
          }),
          new Table({
            width: { size: 14400, type: WidthType.DXA },
            rows: [headerRow, ...bodyRows],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `integrantes_${filterLabel.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${filteredScouts.length} integrantes exportados em .docx! Você pode abrir no Google Docs (Drive → Novo → Upload).`);
  };

  const renderScoutForm = (
    onSubmit: (e: React.FormEvent) => Promise<void>,
    name: string, setName: (v: string) => void,
    birth: string, setBirth: (v: string) => void,
    notes: string, setNotes: (v: string) => void,
    photoPreview: string | null,
    onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void,
    isUploading: boolean,
    submitLabel: string,
    photoInputId: string,
    branchOverride: string, setBranchOverride: (v: string) => void,
    subgroupId: string, setSubgroupId: (v: string) => void,
    formTarget: 'new' | 'edit',
    registrationId: string, setRegistrationId: (v: string) => void,
    phoneVal: string, setPhoneVal: (v: string) => void,
    sectionVal: string, setSectionVal: (v: string) => void,
    transitionDate: string, setTransitionDate: (v: string) => void,
    admissionDate: string, setAdmissionDate: (v: string) => void,
    scoutId?: string,

    guardianFields?: {
      name: string; setName: (v: string) => void;
      email: string; setEmail: (v: string) => void;
      phone: string; setPhone: (v: string) => void;
      auth: boolean; setAuth: (v: boolean) => void;
    },
  ) => {
    const detectedBranch = birth ? getCurrentBranch(parseLocalDate(birth)) : null;
    const effectiveBranch = branchOverride !== 'auto' 
      ? ALL_CATEGORIES.find(b => b.key === branchOverride) 
      : detectedBranch;
    const effectiveBranchKey = effectiveBranch?.key || '';
    const filteredSubgroups = subgroups.filter(sg => sg.branch_key === effectiveBranchKey);
    const sectionsForBranch = effectiveBranchKey
      ? [...new Set(scouts.filter(s => (s.manual_branch || '') === effectiveBranchKey && s.section).map(s => s.section))].sort()
      : [];
    const isMinor = birth ? (calculateAge(parseLocalDate(birth)).years < 18) : false;

    // Determine if transition date field should show
    const nextBranchChange = birth ? getNextBranchChange(parseLocalDate(birth)) : null;
    const ageBranch = birth ? getCurrentBranch(parseLocalDate(birth)) : null;
    const currentBranchIdx = effectiveBranch ? SCOUT_BRANCHES.findIndex(b => b.key === effectiveBranch.key) : -1;
    const ageBranchIdx = ageBranch ? SCOUT_BRANCHES.findIndex(b => b.key === ageBranch.key) : -1;
    const needsTransition = birth && effectiveBranchKey !== 'voluntario' && (
      (nextBranchChange && nextBranchChange.monthsLeft <= 0 && nextBranchChange.daysLeft <= 0) ||
      (ageBranchIdx > currentBranchIdx && currentBranchIdx >= 0)
    );
    // Also keep showing when transitionDate is already filled (branch was overridden)
    const showTransitionDate = needsTransition || (!!transitionDate && birth && effectiveBranchKey !== 'voluntario');

    const nextBranch = showTransitionDate
      ? (transitionDate && effectiveBranch ? effectiveBranch : (ageBranchIdx > currentBranchIdx ? ageBranch : (nextBranchChange ? nextBranchChange.branch : null)))
      : null;

    const hasChanges = formTarget === 'edit' && editingScout ? (
      name !== editingScout.name ||
      birth !== editingScout.birth_date ||
      notes !== (editingScout.notes || '') ||
      branchOverride !== (editingScout.manual_branch || 'auto') ||
      subgroupId !== (editingScout.subgroup_id || 'none') ||
      registrationId !== (editingScout.registration_id ? editingScout.registration_id.padStart(4, '0') : '') ||
      phoneVal !== (editingScout.phone || '') ||
      sectionVal !== (editingScout.section || '') ||
      transitionDate !== (editingScout.transition_date || '') ||
      admissionDate !== (editingScout.admission_date || (editingScout.created_at ? editingScout.created_at.split('T')[0] : '')) ||
      !!editPhoto

    ) : false;

    return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <label
            htmlFor={photoInputId}
            className={`cursor-pointer ${cameraStatus !== 'available' ? 'opacity-80' : ''}`}
            onClick={async (e) => { 
              // Stop propagation to avoid triggering any parent click listeners
              // but don't preventDefault so the label still triggers the file input
              e.stopPropagation();
              handlePhotoPickStart();
              
              if (cameraStatus === 'available') {
                // Verificação extra ao clicar se necessário
                if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    stream.getTracks().forEach(track => track.stop());
                  } catch (err: any) {
                    console.warn('Acesso à câmera não disponível ou negado:', err);
                    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                      setCameraStatus('denied');
                      logCameraIssue('denied', 'getUserMedia_permission_denied', { error_name: err.name, error_message: err.message });
                      toast.error('Permissão da câmera negada. Você pode selecionar uma foto da sua galeria.');
                    } else {
                      setCameraStatus('unavailable');
                      logCameraIssue('unavailable', 'getUserMedia_error', { error_name: err?.name, error_message: err?.message });
                      toast.info('Câmera não disponível. Selecione uma foto da sua galeria.');
                    }
                  }
                }
              }
            }}
          >
            <div 
              className={cn(
                "relative h-24 w-24 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors",
                cameraStatus === 'available' 
                  ? 'border-muted-foreground/30 hover:border-primary' 
                  : 'border-amber-200 bg-amber-50/30'
              )}
              style={!photoPreview && name ? { backgroundColor: stringToColor(name) } : undefined}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover rounded-full" />
              ) : (
                name ? (
                  <span className="text-2xl font-bold text-white select-none">{getInitials(name)}</span>
                ) : (
                  cameraStatus === 'available' ? (
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-amber-500" />
                  )
                )
              )}
            </div>
          </label>
          {photoPreview && (
            <button
              type="button"
              className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90 transition-colors"
              onClick={() => {
                if (formTarget === 'new') {
                  setScoutPhoto(null);
                  setScoutPhotoPreview(null);
                } else {
                  setEditPhoto(null);
                  setEditPhotoPreview(null);
                  if (editingScout) {
                    setEditingScout({ ...editingScout, photo_url: null });
                  }
                }
              }}
              title="Remover foto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <input id={photoInputId} type="file" accept="image/*" className="hidden" onChange={onPhotoSelect} />
        <div className="text-center space-y-1">
          <span className="text-xs font-medium block">
            {cameraStatus === 'available' 
              ? 'Toque para tirar foto ou galeria' 
              : 'Selecione uma foto da galeria'}
          </span>
          {cameraStatus === 'denied' && (
            <p className="text-[10px] text-amber-600 max-w-[180px]">
              Acesso à câmera negado. Por favor, use a galeria ou verifique as permissões do navegador.
            </p>
          )}
          {cameraStatus === 'unavailable' && (
            <p className="text-[10px] text-amber-600 max-w-[180px]">
              Câmera não detectada neste dispositivo. Use a galeria para adicionar uma foto.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setCloudPickerTarget(formTarget);
              setCloudPickerInitialSearch(scoutId || name);
              setCloudPickerOpen(true);
            }}
          >
            <Cloud className="h-4 w-4" />
            Galeria da Nuvem
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-4">
        <div className="space-y-2">
          <Label>ID</Label>
          <Input value={registrationId} readOnly placeholder="Auto" className="h-11 bg-muted/50 font-mono text-center" />
        </div>
        <div className="space-y-2">
          <Label>Nome completo *</Label>
          <Input value={name} onChange={e => setName(e.target.value.toUpperCase())} required placeholder="Nome completo" className="h-11 uppercase" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Celular</Label>
        <Input value={formatPhoneBR(phoneVal)} onChange={e => setPhoneVal(formatPhoneBR(e.target.value))} placeholder="(00) 00000-0000" className="h-11" inputMode="tel" maxLength={15} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="scout-birth-date">Data de nascimento *</Label>
          <Input
            id="scout-birth-date"
            type="date"
            value={birth}
            onChange={e => setBirth(e.target.value)}
            onClick={(e) => { const el = e.currentTarget as any; if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch {} } }}
            onFocus={(e) => { const el = e.currentTarget as any; if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch {} } }}
            required
            className="h-11 cursor-pointer"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scout-admission-date">Ingresso no grupo</Label>
          <Input
            id="scout-admission-date"
            type="date"
            value={admissionDate}
            onChange={e => setAdmissionDate(e.target.value)}
            onClick={(e) => { const el = e.currentTarget as any; if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch {} } }}
            onFocus={(e) => { const el = e.currentTarget as any; if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch {} } }}
            className="h-11 cursor-pointer"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Ramo</Label>
        <Select value={branchOverride} onValueChange={v => { setBranchOverride(v); setCustomSectionMode(false); }}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Selecione o ramo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automático (por idade)</SelectItem>
            {ALL_CATEGORIES.map(b => (
              <SelectItem key={b.key} value={b.key}>
                {b.icon} {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(() => {
          if (!birth || branchOverride === 'auto' || branchOverride === 'voluntario') return null;
          const selectedBranchInfo = SCOUT_BRANCHES.find(b => b.key === branchOverride);
          if (!selectedBranchInfo) return null;
          const ageInMonths = Math.floor((new Date().getTime() - parseLocalDate(birth).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
          const expectedBranch = getCurrentBranch(parseLocalDate(birth));
          if (expectedBranch && expectedBranch.key === branchOverride) return null;
          const minYears = (selectedBranchInfo.minAge / 12).toFixed(1).replace('.0', '');
          const maxYears = (selectedBranchInfo.maxAge / 12).toFixed(1).replace('.0', '');
          return (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3 flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 mt-0.5">⚠️</span>
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-semibold">Idade não corresponde ao ramo selecionado</p>
                <p>A idade deste integrante ({formatAge(parseLocalDate(birth))}) não está na faixa etária do ramo {selectedBranchInfo.icon} {selectedBranchInfo.name} ({minYears} a {maxYears} anos).
                  {expectedBranch && <> O ramo esperado por idade é <strong>{expectedBranch.icon} {expectedBranch.name}</strong>.</>}
                  {!expectedBranch && <> Nenhum ramo juvenil corresponde a esta idade.</>}
                </p>
              </div>
            </div>
          );
        })()}
      </div>
      {showTransitionDate && nextBranch && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <Label className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Passagem para {nextBranch.icon} {nextBranch.name}
            </Label>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Integrante atingiu a idade para o próximo ramo. Informe a data da passagem para confirmar a transição.
          </p>
          <div className="relative">
            <Input
              type="date"
              value={transitionDate}
              onChange={e => {
                setTransitionDate(e.target.value);
                if (e.target.value) {
                  setBranchOverride(nextBranch.key);
                }
              }}
              className="h-11"
            />
          </div>
          {transitionDate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setTransitionDate('');
                setBranchOverride('auto');
              }}
            >
              <X className="h-3 w-3 mr-1" /> Cancelar passagem
            </Button>
          )}
        </div>
      )}
      {effectiveBranchKey === 'voluntario' ? (() => {
        const parsed = parseVolunteerSection(sectionVal);
        const updateVolunteerSection = (secao: string, cargo1: string, cargo2: string) => {
          setSectionVal(buildVolunteerSection(secao, cargo1, cargo2));
        };
        const renderCargoSelect = (label: string, value: string, onChange: (v: string) => void) => (
          <div className="space-y-2">
            <Label>{label}</Label>
            <Select value={value || '__none__'} onValueChange={v => onChange(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={`Selecione ${label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {Object.entries(VOLUNTEER_CARGO_CATEGORIES)
                  .filter(([, items]) => items.length > 0)
                  .map(([cat, items]) => (
                    <SelectGroup key={cat}>
                      <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">{cat}</SelectLabel>
                      {items.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );
        return (
          <>
            <div className="space-y-2">
              <Label>Seção</Label>
              <Select value={parsed.secao || '__none__'} onValueChange={v => {
                updateVolunteerSection(v === '__none__' ? '' : v, parsed.cargo1, parsed.cargo2);
              }}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione a seção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {VOLUNTEER_SECTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderCargoSelect('Cargo (1ª Função)', parsed.cargo1, (v) => {
              updateVolunteerSection(parsed.secao, v, parsed.cargo2);
            })}
            {renderCargoSelect('Cargo (2ª Função)', parsed.cargo2, (v) => {
              updateVolunteerSection(parsed.secao, parsed.cargo1, v);
            })}
          </>
        );
      })() : (
      <div className="space-y-2">
        <Label>Seção</Label>
        {sectionsForBranch.length > 0 && !customSectionMode ? (
          <Select value={sectionVal || '__none__'} onValueChange={v => {
            if (v === '__custom__') {
              setCustomSectionMode(true);
              setSectionVal('');
            } else {
              setSectionVal(v === '__none__' ? '' : v);
            }
          }}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecione a seção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhuma</SelectItem>
              {sectionsForBranch.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
              <SelectItem value="__custom__">✏️ Digitar outra...</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="flex gap-2">
            <Input value={sectionVal} onChange={e => setSectionVal(e.target.value)} placeholder="Digite o nome da seção" className="h-11 flex-1" autoFocus={customSectionMode} />
            {sectionsForBranch.length > 0 && (
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => { setCustomSectionMode(false); setSectionVal(''); }} title="Voltar para lista">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {effectiveBranchKey && (
          <div className="flex gap-2">
            <Input
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              placeholder="Nova seção..."
              className="h-9 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 px-3 text-sm whitespace-nowrap"
              disabled={!newSectionName.trim()}
              onClick={() => {
                setSectionVal(newSectionName.trim());
                setNewSectionName('');
                setCustomSectionMode(false);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Criar
            </Button>
          </div>
        )}
      </div>
      )}
      {effectiveBranchKey && (
        <div className="space-y-2">
          <Label>Equipe</Label>
          <Select value={subgroupId} onValueChange={setSubgroupId}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecione a equipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {filteredSubgroups.map(sg => (
                <SelectItem key={sg.id} value={sg.id}>{sg.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              value={newSubgroupName}
              onChange={e => setNewSubgroupName(e.target.value)}
              placeholder="Nova equipe..."
              className="h-9 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!newSubgroupName.trim() || creatingSubgroup}
              onClick={async () => {
                const newId = await handleCreateSubgroup(effectiveBranchKey);
                if (newId) setSubgroupId(newId);
                setCreatingSubgroup(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Data da Passagem</Label>
            <Input
              type="date"
              value={transitionDate}
              onChange={e => setTransitionDate(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      )}
      {birth && (
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <p className="text-sm font-medium">Idade: {formatAge(parseLocalDate(birth))}</p>
          {effectiveBranch && (
            <p className="text-sm text-muted-foreground">
              Ramo: {effectiveBranch.icon} {effectiveBranch.name}
              {branchOverride === 'auto' && ' (automático)'}
            </p>
          )}
          {branchOverride === 'auto' && getNextBranchChange(parseLocalDate(birth)) && (
            <p className="text-sm text-muted-foreground">
              Mudança para {getNextBranchChange(parseLocalDate(birth))!.branch.name}: {formatTimeLeft(getNextBranchChange(parseLocalDate(birth))!.monthsLeft, getNextBranchChange(parseLocalDate(birth))!.daysLeft)}
            </p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionais..." />
      </div>
      {isMinor && guardianFields && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold text-primary">Responsável (menor de idade)</Label>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Nome do responsável *</Label>
            <Input value={guardianFields.name} onChange={e => guardianFields.setName(e.target.value.toUpperCase())} placeholder="Nome completo do responsável" className="h-10 uppercase" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={guardianFields.email} onChange={e => guardianFields.setEmail(e.target.value)} placeholder="email@exemplo.com" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Telefone</Label>
              <Input value={formatPhoneBR(guardianFields.phone)} onChange={e => guardianFields.setPhone(formatPhoneBR(e.target.value))} placeholder="(00) 00000-0000" className="h-10" inputMode="tel" maxLength={15} />
            </div>
          </div>
          <div className="rounded-lg border bg-muted/50 p-2">
            <p className="text-xs leading-snug text-muted-foreground">
              Uso de imagem está de acordo com o "Termo de Autorização de Uso de Imagem (Paxtu)". Registro escoteiro (ficha de associado/Paxtu).
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col-reverse sm:flex-row gap-2">
        {formTarget === 'edit' && editingScout && (
          <AlertDialog onOpenChange={(open) => { if (!open) setDiscardConfirmText(''); }}>
            <AlertDialogTrigger asChild>
               <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto h-11"
                disabled={isUploading || !hasChanges}
              >
                Descartar alterações
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as alterações não salvas (incluindo a foto) serão perdidas e os campos voltarão ao estado atual do integrante.
                  <div className="mt-4 space-y-2">
                    <Label className="text-xs">Digite "DESCARTAR" para confirmar:</Label>
                    <Input 
                      value={discardConfirmText} 
                      onChange={e => setDiscardConfirmText(e.target.value)} 
                      placeholder="DESCARTAR" 
                      className="h-10 uppercase"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDiscardConfirmText('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  disabled={discardConfirmText.trim() !== 'DESCARTAR'}
                  onClick={() => {
                    openEditDialog(editingScout);
                    setDiscardConfirmText('');
                    toast.info('Alterações descartadas');
                  }}
                >
                  Sim, descartar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button type="submit" className="flex-1 h-11 font-semibold" disabled={isUploading}>
          {isUploading ? 'Salvando...' : submitLabel}
        </Button>
      </div>
    </form>
  );};

  return (
    <>
      {pendingResend && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700 dark:bg-amber-950/40">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Foto pendente para {pendingResend.scoutName}
              </p>
              <p className="text-sm text-amber-800/80 dark:text-amber-200/80">
                O integrante foi criado, mas a foto não foi enviada.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                console.log('[RESEND] clicked', pendingResend);
                const { data: fresh, error } = await supabase
                  .from('scouts')
                  .select('*')
                  .eq('id', pendingResend.scoutId)
                  .maybeSingle();
                console.log('[RESEND] fetch result', { fresh, error });
                if (error || !fresh) {
                  toast.error('Não foi possível abrir o integrante: ' + (error?.message ?? 'não encontrado'));
                  return;
                }
                openEditDialog(fresh as Scout);
                setEditPhoto(pendingResend.photo);
                const r = new FileReader();
                r.onloadend = () => setEditPhotoPreview(r.result as string);
                r.readAsDataURL(pendingResend.photo);
                toast.info('Clique em Salvar para reenviar a foto.');
              }}
            >
              Reenviar foto
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPendingResend(null)}>
              Descartar
            </Button>
          </div>
        </div>
      )}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrantes</h1>
          <p className="mt-1 text-muted-foreground">
            {activeScouts.length} ativos
            {inactiveScouts.length > 0 && ` · ${inactiveScouts.length} inativos`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(canManageScouts || canEditScouts) && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setPhotosHubScoutId(null);
                setPhotosHubSearch('');
                setPhotosHubOpen(true);
              }}
            >
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              Fotos
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={renumbering}
              onClick={async () => {
                setRenumbering(true);
                const t = toast.loading('Renumerando integrantes...');
                const { error } = await supabase.rpc('renumber_scouts' as any);
                toast.dismiss(t);
                if (error) {
                  toast.error('Falha ao renumerar', { description: error.message });
                } else {
                  toast.success(`${scouts.length} integrante(s) renumerado(s) em sequência (0001…)`);
                  await fetchData();
                }
                setRenumbering(false);
              }}
            >
              <ListOrdered className="h-4 w-4" />
              {renumbering ? 'Renumerando...' : 'Renumerar IDs'}
            </Button>
          )}
          {(canManageScouts || canEditScouts) && (
          <Dialog open={dialogOpen} onOpenChange={v => {
              if (!v && (cropperOpen || photoPickInProgressRef.current)) return;
              setDialogOpen(v);
              if (v) {
                setCustomSectionMode(false);
                // Auto-generate next registration_id
                const existingIds = scouts
                  .map(s => parseInt(s.registration_id, 10))
                  .filter(n => !isNaN(n));
                const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
                setScoutRegistrationId(String(nextId).padStart(4, '0'));
              }
            }}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Novo Integrante
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[90vh] overflow-y-auto"
              onInteractOutside={(e) => { 
                if (cropperOpen || photoPickInProgressRef.current || uploading) {
                  e.preventDefault(); 
                }
              }}
              onPointerDownOutside={(e) => { 
                if (cropperOpen || photoPickInProgressRef.current || uploading) {
                  e.preventDefault(); 
                }
              }}
              onEscapeKeyDown={(e) => { 
                if (cropperOpen || photoPickInProgressRef.current || uploading) {
                  e.preventDefault(); 
                }
              }}
            >
              <DialogHeader>
                <DialogTitle>Cadastrar Membro</DialogTitle>
              </DialogHeader>
              {renderScoutForm(
                handleCreateScout,
                scoutName, setScoutName,
                scoutBirth, setScoutBirth,
                scoutNotes, setScoutNotes,
                scoutPhotoPreview,
                handlePhotoSelect,
                uploading,
                'Cadastrar',
                'scout-photo-create',
                scoutBranch, setScoutBranch,
                scoutSubgroup, setScoutSubgroup,
                'new',
                scoutRegistrationId, setScoutRegistrationId,
                scoutPhone, setScoutPhone,
                scoutSection, setScoutSection,
                scoutTransitionDate, setScoutTransitionDate,
                scoutAdmissionDate, setScoutAdmissionDate,
                undefined,

                {
                  name: inlineGuardianName, setName: setInlineGuardianName,
                  email: inlineGuardianEmail, setEmail: setInlineGuardianEmail,
                  phone: inlineGuardianPhone, setPhone: setInlineGuardianPhone,
                  auth: inlineGuardianAuth, setAuth: setInlineGuardianAuth,
                },
              )}
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex gap-2 min-h-[36px]">
        <Button
          variant={statusFilter === 'active' ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => setStatusFilter('active')}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Ativos ({activeScouts.length})
        </Button>
        <Button
          variant={statusFilter === 'inactive' ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => setStatusFilter('inactive')}
        >
          <UserX className="h-3.5 w-3.5" />
          Inativos ({inactiveScouts.length})
        </Button>
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          Todos ({scouts.length})
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row min-h-[76px] sm:min-h-[36px]">
        <div className="relative w-full sm:w-auto sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, seção ou equipe..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 pl-10 text-sm" />
        </div>
        <div className="flex gap-2 flex-wrap items-center" ref={branchPickerRef}>
          <DropdownMenu open={branchPickerOpen} onOpenChange={setBranchPickerOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
              >
                {branchFilter === ''
                  ? 'Nenhum'
                  : branchFilter === 'all'
                  ? `Todos (${scouts.length})`
                  : (() => {
                      const b = ALL_CATEGORIES.find(c => c.key === branchFilter);
                      return b ? `${b.icon} ${b.name}${branchCounts[b.key] ? ` (${branchCounts[b.key]})` : ''}` : 'Nenhum';
                    })()}
                {branchPickerOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Escolha um Ramo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setBranchFilter('');
                  setBranchAnnouncement('Nenhum ramo selecionado. Lista oculta.');
                }}
                className={`cursor-pointer ${branchFilter === '' ? 'bg-primary text-primary-foreground font-semibold focus:bg-primary focus:text-primary-foreground' : ''}`}
              >
                Nenhum
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setBranchFilter('all');
                  setBranchAnnouncement(`Ramo selecionado: Todos. ${scouts.length} integrantes.`);
                }}
                className={`cursor-pointer ${branchFilter === 'all' ? 'bg-primary text-primary-foreground font-semibold focus:bg-primary focus:text-primary-foreground' : ''}`}
              >
                Todos ({scouts.length})
              </DropdownMenuItem>
              {ALL_CATEGORIES.map(b => (
                <DropdownMenuItem
                  key={b.key}
                  onSelect={() => {
                    setBranchFilter(b.key);
                    const count = branchCounts[b.key] ?? 0;
                    setBranchAnnouncement(`Ramo selecionado: ${b.name}. ${count} ${count === 1 ? 'integrante' : 'integrantes'}.`);
                  }}
                  className={`cursor-pointer ${branchFilter === b.key ? 'bg-primary text-primary-foreground font-semibold focus:bg-primary focus:text-primary-foreground' : ''}`}
                >
                  {b.icon} {b.name} {branchCounts[b.key] ? `(${branchCounts[b.key]})` : ''}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {branchAnnouncement}
          </span>

          {/* Advanced filters */}
          <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 relative">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {advancedActiveCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                    {advancedActiveCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[calc(100vw-32px)] sm:w-80 max-h-[80vh] overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Filtros avançados</h4>
                  {advancedActiveCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAdvancedFilters}>
                      Limpar
                    </Button>
                  )}
                </div>

                {availableSections.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] sm:text-[11px] uppercase tracking-wider text-primary font-black drop-shadow-sm">Seção</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSections.map(sec => {
                        const active = sectionFilter.includes(sec);
                        return (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => toggleArrayValue(sectionFilter, sec, setSectionFilter)}
                            className={`text-xs rounded-full border px-2.5 py-1 transition ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                          >
                            {sec}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {availableSubgroups.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] sm:text-[11px] uppercase tracking-wider text-primary font-black drop-shadow-sm">Equipe</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSubgroups.map(sg => {
                        const active = subgroupFilter.includes(sg.id);
                        return (
                          <button
                            key={sg.id}
                            type="button"
                            onClick={() => toggleArrayValue(subgroupFilter, sg.id, setSubgroupFilter)}
                            className={`text-xs rounded-full border px-2.5 py-1 transition ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                          >
                            {sg.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-[10px] sm:text-[11px] uppercase tracking-wider text-primary font-black drop-shadow-sm">Idade (anos)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      placeholder="Mín."
                      value={ageMinFilter}
                      onChange={e => setAgeMinFilter(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <span className="text-muted-foreground text-xs">a</span>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      placeholder="Máx."
                      value={ageMaxFilter}
                      onChange={e => setAgeMaxFilter(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] sm:text-[11px] uppercase tracking-wider text-primary font-black drop-shadow-sm">Tempo no grupo (mín. anos)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    placeholder="Ex.: 2"
                    value={tenureMinFilter}
                    onChange={e => setTenureMinFilter(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] sm:text-[11px] uppercase tracking-wider text-primary font-black drop-shadow-sm">Foto</Label>
                  <div className="flex gap-1.5">
                    {(['all', 'with', 'without'] as const).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setPhotoFilter(opt)}
                        className={`flex-1 text-xs rounded-md border px-2 py-1.5 transition ${photoFilter === opt ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                      >
                        {opt === 'all' ? 'Todos' : opt === 'with' ? 'Com foto' : 'Sem foto'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t text-xs text-muted-foreground text-center">
                  {filteredScouts.length} {filteredScouts.length === 1 ? 'integrante encontrado' : 'integrantes encontrados'}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {advancedActiveCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={clearAdvancedFilters}>
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}



          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg ring-2 ring-primary/30 ring-offset-2 ring-offset-background font-semibold transition-all"
                disabled={filteredScouts.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar ({filteredScouts.length})
                <ChevronDown className="h-3.5 w-3.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setExportConfirm('excel')} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-[#1D6F42]" />
                <span>Excel</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setExportConfirm('pdf')} className="gap-2 cursor-pointer">
                <FileDown className="h-4 w-4 text-[#D93025]" />
                <span>PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog open={exportConfirm !== null} onOpenChange={(open) => !open && setExportConfirm(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {exportConfirm === 'pdf' && 'Exportar PDF'}
                  {exportConfirm === 'excel' && 'Exportar Excel'}
                  {exportConfirm === 'docx' && 'Exportar para Documentos Google'}
                  {exportConfirm === 'sheets' && 'Exportar para Planilhas Google'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {(exportConfirm === 'pdf' || exportConfirm === 'excel') && (
                    <>Deseja exportar {filteredScouts.length} integrante{filteredScouts.length !== 1 ? 's' : ''} para {exportConfirm === 'pdf' ? 'PDF' : 'Excel'}?</>
                  )}
                  {exportConfirm === 'docx' && (
                    <>Será baixado um arquivo <strong>.docx</strong> com {filteredScouts.length} integrante{filteredScouts.length !== 1 ? 's' : ''}. Para abrir no <strong>Google Docs</strong>: acesse <strong>drive.google.com</strong> → <strong>Novo</strong> → <strong>Upload de arquivo</strong> → selecione o .docx → clique com o botão direito → <strong>Abrir com → Documentos Google</strong>.</>
                  )}
                  {exportConfirm === 'sheets' && (
                    <>Será baixado um arquivo <strong>.xlsx</strong> com {filteredScouts.length} integrante{filteredScouts.length !== 1 ? 's' : ''}. Para abrir no <strong>Google Sheets</strong>: acesse <strong>drive.google.com</strong> → <strong>Novo</strong> → <strong>Upload de arquivo</strong> → selecione o .xlsx → clique com o botão direito → <strong>Abrir com → Planilhas Google</strong>.</>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                  if (exportConfirm === 'pdf') handleExportPDF();
                  else if (exportConfirm === 'excel') handleExportExcel();
                  else if (exportConfirm === 'docx') handleExportDocx();
                  else if (exportConfirm === 'sheets') handleExportExcel();
                  setExportConfirm(null);
                }}>
                  {exportConfirm === 'docx' || exportConfirm === 'sheets' ? 'Baixar arquivo' : 'Exportar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : branchFilter === '' ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Users className="h-8 w-8" />
          </div>
          <p className="text-lg font-medium text-foreground">Selecione um ramo para visualizar os integrantes</p>
          <p className="mt-1 text-sm">Use os botões acima (Todos, Lobinho, Escoteiro, Sênior, Pioneiro ou Voluntário)</p>
        </div>
      ) : filteredScouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Users className="h-8 w-8" />
          </div>
          <p className="text-lg font-medium text-foreground">Nenhum membro cadastrado</p>
          <p className="mt-1 text-sm">Cadastre o primeiro membro</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 min-h-[200px]">
          {filteredScouts.map((scout, index) => {
            const branch = getEffectiveBranch(scout);
            const birthDateObj = parseLocalDate(scout.birth_date);
            const isAdult = branch?.key === 'voluntario' || calculateAgeInMonths(birthDateObj) >= 252;
            const nextChange = !isAdult ? getNextBranchChange(birthDateObj) : null;
            const scoutGuardians = getGuardiansForScout(scout.id);
            const isExpanded = expandedScouts.has(scout.id);

            return (
              <motion.div
                key={scout.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className={`border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden ${!scout.is_active ? 'opacity-60' : ''}`}>
                  <CardContent className="p-0">
                    {/* Main row: photo, branch, name, age */}
                    <div className="flex items-center gap-3 p-4">
                      <ScoutAvatar
                        name={scout.name}
                        photoUrl={scout.photo_url}
                        className="h-14 w-14 ring-2 ring-muted flex-shrink-0 cursor-pointer hover:ring-primary transition-all shadow-sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (scout.photo_url) {
                            const signed = await getSignedPhotoUrl(scout.photo_url);
                            if (signed) setViewingPhoto(signed);
                            else toast.error('Foto não disponível');
                          }
                        }}
                        onBroken={() => handleBrokenPhoto(scout.id, document.createElement('img'))}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col items-start gap-0.5">
                          <h3
                            className="max-w-full whitespace-normal break-words font-semibold tracking-tight leading-tight cursor-pointer transition-colors hover:text-primary uppercase" style={{ overflowWrap: 'anywhere' }}
                            onClick={(e) => { e.stopPropagation(); setViewingScout(scout); }}
                          >
                            {scout.name}
                          </h3>
                          {scout.registration_id && (
                            <span className="text-xs font-mono text-muted-foreground">#{String(parseInt(scout.registration_id, 10) || 0).padStart(4, '0')}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{formatAge(parseLocalDate(scout.birth_date))}</p>
                        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                          {branch && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground/70 w-[52px] shrink-0">Ramo:</span>
                              <Badge className={`${branchColorMap[branch.color]} border font-normal text-xs`}>
                                {branch.icon} {branch.name}
                              </Badge>
                            </div>
                          )}
                          {branch?.key === 'voluntario' ? (
                            <>
                              {(() => {
                                const { secao, cargo1, cargo2 } = parseVolunteerSection(scout.section);
                                return (
                                  <>
                                    {secao && (
                                      <div className="flex items-start gap-1.5">
                                        <span className="font-medium text-foreground/70 w-[52px] shrink-0">Seção:</span>
                                        <span>{secao}</span>
                                      </div>
                                    )}
                                    {cargo1 && (
                                      <div className="flex items-start gap-1.5">
                                        <span className="font-medium text-foreground/70 shrink-0 whitespace-nowrap">1ª Função:</span>
                                        <span className="break-words" style={{ overflowWrap: 'anywhere' }}>{cargo1}</span>
                                      </div>
                                    )}
                                    {cargo2 && (
                                      <div className="flex items-start gap-1.5">
                                        <span className="font-medium text-foreground/70 shrink-0 whitespace-nowrap">2ª Função:</span>
                                        <span className="break-words" style={{ overflowWrap: 'anywhere' }}>{cargo2}</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          ) : (
                            <>
                              {scout.section && (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-foreground/70 w-[52px] shrink-0">Seção:</span>
                                  <span>{scout.section}</span>
                                </div>
                              )}
                              {scout.subgroup_id && (() => {
                                const sg = subgroups.find(s => s.id === scout.subgroup_id);
                                return sg ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground/70 w-[52px] shrink-0">Equipe:</span>
                                    <Badge variant="secondary" className="font-normal text-xs">{sg.name}</Badge>
                                  </div>
                                ) : null;
                              })()}
                            </>
                          )}
                          {!scout.is_active && (
                            <Badge variant="destructive" className="font-normal text-xs mt-1">Inativo</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => toggleExpand(scout.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {/* Expandable details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-3 border-t pt-3">
                            {nextChange && (
                              <div className="rounded-lg bg-muted/50 p-2.5">
                                <div className="flex items-center gap-2 text-sm">
                                  <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {nextChange.branch.icon} {nextChange.branch.name} em{' '}
                                    <span className="font-medium text-foreground">{formatTimeLeft(nextChange.monthsLeft, nextChange.daysLeft)}</span>
                                  </span>
                                </div>
                              </div>
                            )}

                            {scout.notes && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Obs:</span> {scout.notes}
                              </div>
                            )}

                            {/* Guardians - only show for minors (under 18) */}
                            {(() => {
                              const ageInYears = calculateAge(parseLocalDate(scout.birth_date)).years;
                              const isMinor = ageInYears < 18;
                              if (!isMinor && scoutGuardians.length === 0) return null;
                              return (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {scoutGuardians.length > 0
                                        ? `${scoutGuardians.length} responsável(is)`
                                        : isMinor
                                          ? <span className="text-amber-600">Sem responsável</span>
                                          : null}
                                    </span>
                                    {(canManageScouts || canEditScouts) && isMinor && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1 text-xs"
                                        onClick={() => {
                                          setSelectedScout(scout);
                                          setEditingGuardianId(null);
                                          setGuardianName(''); setGuardianEmail(''); setGuardianPhone(''); setGuardianAuth(true);
                                          setGuardianDialogOpen(true);
                                        }}
                                      >
                                        <UserPlus className="h-3 w-3" />
                                        Responsável
                                      </Button>
                                    )}
                                  </div>
                                  {scoutGuardians.length > 0 && (
                                    <div className="space-y-1">
                                      {scoutGuardians.map(g => (
                                        <div key={g.id} className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                                          <span className="truncate">{g.name}</span>
                                          {(canManageScouts || canEditScouts) && (
                                            <div className="flex items-center gap-1 shrink-0">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => openEditGuardian(scout, g)}
                                                title="Editar responsável"
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" title="Remover responsável">
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                    <AlertDialogTitle>Remover responsável?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                      Tem certeza que deseja remover <strong>{g.name}</strong>? Esta ação não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteGuardian(g.id)}>Remover</AlertDialogAction>
                                                  </AlertDialogFooter>
                                                </AlertDialogContent>
                                              </AlertDialog>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Actions: Edit, Activate/Deactivate, Delete */}
                            <div className="flex gap-2 pt-1 flex-wrap">
                              {(canManageScouts || canEditScouts) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 flex-1"
                                  onClick={() => openEditDialog(scout)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                              )}
                              {canUpload && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 flex-1"
                                  onClick={() => {
                                    setPhotosHubScoutId(scout.id);
                                    setPhotosHubOpen(true);
                                  }}
                                >
                                  <Camera className="h-3.5 w-3.5" />
                                  Fotos
                                </Button>
                              )}
                              {canManageScouts && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant={scout.is_active ? 'outline' : 'default'}
                                      size="sm"
                                      className="gap-1.5"
                                    >
                                      <Power className="h-3.5 w-3.5" />
                                      {scout.is_active ? 'Desativar' : 'Reativar'}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {scout.is_active ? `Desativar "${scout.name}"?` : `Reativar "${scout.name}"?`}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {scout.is_active
                                          ? 'O integrante ficará inativo e não aparecerá nas listagens padrão. Dados e histórico serão mantidos.'
                                          : 'O integrante voltará a aparecer nas listagens operacionais.'}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleToggleActive(scout)}>
                                        {scout.is_active ? 'Desativar' : 'Reativar'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {canManageScouts && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="gap-1.5">
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Excluir
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir "{scout.name}"?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação é irreversível. Considere desativar o integrante ao invés de excluí-lo para manter o histórico.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteScout(scout.id)}>Excluir permanentemente</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(v) => { if (!v && (cropperOpen || photoPickInProgressRef.current)) return; setEditDialogOpen(v); }}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => { 
            if (cropperOpen || photoPickInProgressRef.current || editUploading) {
              e.preventDefault(); 
            }
          }}
          onPointerDownOutside={(e) => { 
            if (cropperOpen || photoPickInProgressRef.current || editUploading) {
              e.preventDefault(); 
            }
          }}
          onEscapeKeyDown={(e) => { 
            if (cropperOpen || photoPickInProgressRef.current || editUploading) {
              e.preventDefault(); 
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
          </DialogHeader>
          {renderScoutForm(
            handleEditScout,
            editName, setEditName,
            editBirth, setEditBirth,
            editNotes, setEditNotes,
            editPhotoPreview,
            handleEditPhotoSelect,
            editUploading,
            'Salvar Alterações',
            'scout-photo-edit',
            editBranch, setEditBranch,
            editSubgroup, setEditSubgroup,
            'edit',
            editRegistrationId, setEditRegistrationId,
            editPhone, setEditPhone,
            editSection, setEditSection,
            editTransitionDate, setEditTransitionDate,
            editAdmissionDate, setEditAdmissionDate,
            editingScout?.id,
          )}


          {editingScout && (
            <div className="mt-6 border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">
                Fotos do integrante
              </h4>
              <Tabs defaultValue="galeria" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="galeria">Galeria</TabsTrigger>
                  <TabsTrigger value="pastas">Pastas (Ano › Data)</TabsTrigger>
                </TabsList>
                <TabsContent value="galeria" className="mt-4">
                  <ScoutGallery scoutId={editingScout.id} scoutName={editingScout.name} onPickStart={handlePhotoPickStart} />
                </TabsContent>
                <TabsContent value="pastas" className="mt-4">
                  <ScoutFolders scoutId={editingScout.id} scoutName={editingScout.name} onPickStart={handlePhotoPickStart} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Photos Hub Dialog — quick access to gallery/folders by member */}
      <Dialog open={photosHubOpen} onOpenChange={(v) => {
        if (!v && uploading) {
          // If in ScoutFolders and uploading, this will be handled by the inner dialog confirmation
          // but we block closing the outer one to avoid accidental data loss
          return;
        }
        if (!v && (cropperOpen || photoPickInProgressRef.current)) return;
        setPhotosHubOpen(v);
        if (!v) {
          setPhotosHubScoutId(null);
          setPhotosHubSearch('');
          photosHubDragCounter.current = 0;
          setPhotosHubDragging(false);
          setPhotosHubSummary(null);
        }
      }}>
        <DialogContent
          className="max-w-3xl max-h-[95vh] p-0 flex flex-col"
          onDragEnter={(e) => {
            if (!photosHubScoutId) return;
            if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
            e.preventDefault();
            photosHubDragCounter.current += 1;
            setPhotosHubDragging(true);
          }}
          onDragOver={(e) => {
            if (!photosHubScoutId) return;
            if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            if (!photosHubScoutId) return;
            e.preventDefault();
            photosHubDragCounter.current = Math.max(0, photosHubDragCounter.current - 1);
            if (photosHubDragCounter.current === 0) setPhotosHubDragging(false);
          }}
          onDrop={(e) => {
            if (!photosHubScoutId) return;
            e.preventDefault();
            photosHubDragCounter.current = 0;
            setPhotosHubDragging(false);
            const files = Array.from(e.dataTransfer?.files || []);
            if (files.length > 0) processPhotosHubFiles(files);
          }}
        >
          <div className="p-6 overflow-y-auto flex-1">
            <DialogHeader className="mb-4">
            <DialogTitle>
              {photosHubScoutId
                ? (scouts.find(s => s.id === photosHubScoutId)?.name.toUpperCase() ?? 'Fotos')
                : 'Fotos por Integrante'}
            </DialogTitle>
          </DialogHeader>

          {!photosHubScoutId ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Pesquisar pelo nome do integrante..."
                  value={photosHubSearch}
                  onChange={(e) => setPhotosHubSearch(e.target.value)}
                  className="pl-9 h-12 text-base"
                />
              </div>
              <div className="max-h-[60vh] overflow-y-auto rounded-md border divide-y">
                {(() => {
                  const q = photosHubSearch.trim().toLowerCase();
                  const list = scouts
                    .filter(s => s.is_active)
                    .filter(s => !q || s.name.toLowerCase().includes(q))
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
                  if (list.length === 0) {
                    return (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        Nenhum integrante encontrado.
                      </div>
                    );
                  }
                  return list.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setPhotosHubScoutId(s.id)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent transition-colors"
                    >
                      <ScoutAvatar
                        name={s.name}
                        photoUrl={s.photo_url}
                        className="h-10 w-10 shrink-0"
                      />
                      <div className="flex-1 min-w-0" aria-hidden="true">
                        <p className="font-semibold uppercase break-words">{s.name}</p>
                        {s.section && (
                          <p className="text-xs text-muted-foreground">{s.section}</p>
                        )}
                      </div>
                    </button>
                  ));
                })()}
              </div>
            </div>
          ) : (
            <div className="relative space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={() => setPhotosHubScoutId(null)}
                >
                  <X className="h-4 w-4" /> Trocar integrante
                </Button>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Dica: arraste imagens para esta janela para enviá-las.
                </p>
              </div>

              {photosHubUploading && (
                <div 
                  className="rounded-md border bg-primary/5 border-primary/20 p-4 text-sm space-y-3"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      <span className="font-medium">
                        Enviando foto <span aria-live="assertive">{photosHubProgress.current}</span> de {photosHubProgress.total}
                      </span>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          Cancelar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancelar upload?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso irá parar o envio das fotos restantes. Fotos já enviadas não serão removidas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Continuar enviando</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            autoFocus
                            onClick={() => {
                              if ((window as any)._photosHubAbortController) {
                                (window as any)._photosHubAbortController.abort();
                              }
                            }}
                          >
                            Sim, cancelar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div 
                    className="w-full bg-muted rounded-full h-2 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round((photosHubProgress.current / photosHubProgress.total) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <motion.div 
                      className="bg-primary h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(photosHubProgress.current / photosHubProgress.total) * 100}%` }}
                    />
                  </div>
                  {photosHubProgress.currentFileName && (
                    <p className="text-[10px] text-muted-foreground truncate italic">
                      Atual: {photosHubProgress.currentFileName}
                    </p>
                  )}
                </div>
              )}

              {photosHubSummary?.error && (
                <div 
                  className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive space-y-2"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <X className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="flex-1">
                      <p className="font-semibold">Erro no envio</p>
                      <p className="text-xs opacity-90">{photosHubSummary.error}</p>
                    </div>
                  </div>
                  
                  {photosHubSummary.failedFiles && photosHubSummary.failedFiles.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-24 overflow-y-auto pr-1">
                      {photosHubSummary.failedFiles.map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-[10px] bg-destructive/10 p-1.5 rounded">
                          <span className="truncate flex-1" title={f.name}>{f.name}</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-5 px-2 text-[9px] hover:bg-destructive/20 text-destructive"
                            onClick={() => uploadPhotosHubFiles([f.file])}
                          >
                            Tentar foto
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <Button 
                      variant="link" 
                      className="h-auto p-0 text-xs font-semibold text-destructive hover:no-underline"
                      onClick={() => {
                        if (photosHubSummary.failedFiles) {
                          uploadPhotosHubFiles(photosHubSummary.failedFiles.map(f => f.file));
                        } else if (photosHubSummary.rawFiles) {
                          uploadPhotosHubFiles(photosHubSummary.rawFiles);
                        }
                      }}
                    >
                      Tentar todas as falhas
                    </Button>
                  </div>
                </div>
              )}

              {photosHubSummary && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 rounded-md border bg-muted/30 text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">Aceitos:</span>
                      <span className="font-bold text-emerald-600">{photosHubSummary.accepted}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-destructive" />
                      <span className="text-muted-foreground">Rejeitados:</span>
                      <span className="font-bold text-destructive">{photosHubSummary.rejected}</span>
                    </div>
                    {photosHubSummary.pending > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-muted-foreground">Pendentes:</span>
                        <span className="font-bold text-amber-600">{photosHubSummary.pending}</span>
                      </div>
                    )}
                    {photosHubSummary.pending === 0 && photosHubSummary.accepted > 0 && (
                      <div className="flex items-center gap-1.5 ml-auto text-emerald-600 font-medium">
                        <Check className="h-3.5 w-3.5" /> Concluído
                      </div>
                    )}
                  </div>

                  {photosHubSummary.acceptedFiles && photosHubSummary.acceptedFiles.length > 0 && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50/30 overflow-hidden">
                      <div className="bg-emerald-100/50 px-3 py-1.5 text-xs font-semibold text-emerald-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-3 w-3" /> Arquivos Aceitos
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 hover:bg-emerald-200/50 text-emerald-700"
                            onClick={() => setPhotosHubSort(prev => ({ field: 'name', direction: prev.field === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                            title="Ordenar por Nome"
                          >
                            <span className="text-[10px]">A-Z</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 hover:bg-emerald-200/50 text-emerald-700"
                            onClick={() => setPhotosHubSort(prev => ({ field: 'size', direction: prev.field === 'size' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                            title="Ordenar por Tamanho"
                          >
                            <SlidersHorizontal className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-32 overflow-y-auto divide-y divide-emerald-100">
                        {(photosHubSummary.acceptedFiles || [])
                          .slice()
                          .sort((a, b) => {
                            const dir = photosHubSort.direction === 'asc' ? 1 : -1;
                            if (photosHubSort.field === 'name') return a.name.localeCompare(b.name) * dir;
                            if (photosHubSort.field === 'size') return (a.size - b.size) * dir;
                            if (photosHubSort.field === 'type') return a.type.localeCompare(b.type) * dir;
                            return 0;
                          })
                          .map((file, idx) => (
                            <div key={idx} className="px-3 py-2 text-xs flex justify-between items-center gap-4 group">
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium truncate text-muted-foreground">{file.name}</span>
                                <span className="text-[10px] text-muted-foreground/70 uppercase">{file.type}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-emerald-600 font-medium">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                  onClick={() => removeFileFromQueue(file.name)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {photosHubSummary.rejectedFiles && photosHubSummary.rejectedFiles.length > 0 && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/5 overflow-hidden">
                      <div className="bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <X className="h-3 w-3" /> Arquivos Rejeitados
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              const validOnly = photosHubSummary.rawFiles?.filter(f => {
                                const type = (f.type || '').toLowerCase();
                                const ext = (f.name.split('.').pop() || '').toLowerCase();
                                const isAllowed = (type && PHOTOS_HUB_ALLOWED_TYPES.includes(type)) || (!type.startsWith('video/') && PHOTOS_HUB_ALLOWED_EXT.includes(ext));
                                return isAllowed && f.size <= PHOTOS_HUB_MAX_SIZE;
                              }) || [];
                              processPhotosHubFiles(validOnly);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              multiple
                              accept="image/*"
                              onChange={(e) => {
                                const newFiles = Array.from(e.target.files || []);
                                if (newFiles.length > 0) {
                                  // Add new files to the current list
                                  const updatedFiles = [...(photosHubSummary.rawFiles || []), ...newFiles];
                                  processPhotosHubFiles(updatedFiles);
                                }
                              }}
                            />
                            <div className="p-1 rounded-sm hover:bg-destructive/10 text-destructive">
                              <ArrowRightLeft className="h-3 w-3" />
                            </div>
                          </label>
                        </div>
                      </div>
                      <div className="max-h-32 overflow-y-auto divide-y divide-destructive/10">
                        {photosHubSummary.rejectedFiles.map((file, idx) => (
                          <div key={idx} className="px-3 py-2 text-xs flex justify-between items-start gap-4 group">
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="font-medium truncate text-muted-foreground">{file.name}</span>
                              <span className="text-destructive text-[10px] sm:text-xs">{file.reason}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const newFile = e.target.files?.[0];
                                    if (newFile && photosHubSummary.rawFiles) {
                                      // Get raw file from rawFiles to compare MIME types
                                      const oldRawFile = photosHubSummary.rawFiles.find(f => f.name === file.name);
                                      const oldMime = oldRawFile?.type || '';
                                      const newMime = newFile.type || '';
                                      
                                      const oldExt = (file.name.split('.').pop() || '').toLowerCase();
                                      const newExt = (newFile.name.split('.').pop() || '').toLowerCase();
                                      
                                      const sameMime = oldMime && newMime && oldMime === newMime;
                                      const sameExt = oldExt && newExt && oldExt === newExt;

                                      if (!sameMime && !sameExt) {
                                        const oldDetails = getFileDetails(oldRawFile || { name: file.name });
                                        const newDetails = getFileDetails(newFile);
                                        
                                        // Determinar motivo específico para ícone/cor
                                        const isDifferentExt = oldExt !== newExt;
                                        const isDifferentMime = oldMime !== newMime;
                                        const isTooLarge = newFile.size > PHOTOS_HUB_MAX_SIZE;

                                        toast.error(
                                          <div className="flex flex-col gap-2 py-1" role="alert" aria-live="assertive">
                                            <div className="flex items-center gap-2 border-b border-destructive/20 pb-2 mb-1">
                                              <X className="h-4 w-4 text-destructive" aria-hidden="true" />
                                              <p className="font-bold text-sm">
                                                {isTooLarge ? 'Arquivo muito grande' : 'Incompatibilidade de Arquivo'}
                                              </p>
                                            </div>
                                            
                                            <div className="space-y-1 bg-destructive/5 p-2 rounded border border-destructive/10" aria-label="Informações do arquivo atual">
                                              <p className="text-[10px] uppercase font-bold text-muted-foreground opacity-60 tracking-wider text-destructive">Arquivo Atual</p>
                                              <p className="text-[11px] font-medium truncate leading-none">{oldDetails.name}</p>
                                              <p className="text-[10px] font-mono opacity-80" aria-label={`Extensão ${oldDetails.ext} e tipo ${oldDetails.mime}`}>
                                                [.{oldDetails.ext.toUpperCase()}] {oldDetails.mime}
                                              </p>
                                              <p className="text-[10px] font-mono opacity-60">{oldDetails.size}</p>
                                            </div>

                                            <div className={`space-y-1 p-2 rounded border ${isDifferentExt || isDifferentMime ? 'bg-amber-500/5 border-amber-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`} aria-label="Informações do novo arquivo">
                                              <p className={`text-[10px] uppercase font-bold tracking-wider ${isDifferentExt || isDifferentMime ? 'text-amber-600' : 'text-emerald-600'}`}>Novo Arquivo</p>
                                              <p className="text-[11px] font-medium truncate leading-none">{newDetails.name}</p>
                                              <p className={`text-[10px] font-mono ${isDifferentExt ? 'text-amber-600 font-bold' : 'opacity-80'}`}>
                                                [.{newDetails.ext.toUpperCase()}] {newDetails.mime}
                                              </p>
                                              <p className={`text-[10px] font-mono ${isTooLarge ? 'text-destructive font-bold' : 'opacity-60'}`}>{newDetails.size}</p>
                                            </div>
                                            
                                            <p className="text-[10px] italic text-center text-muted-foreground mt-1">
                                              {isTooLarge ? 'O arquivo excede o limite de 10MB.' : 'Certifique-se de que a extensão e o tipo de arquivo sejam idênticos.'}
                                            </p>
                                          </div>,
                                          { duration: 8000 }
                                        );
                                        return;
                                      }
                                      
                                      const updatedFiles = photosHubSummary.rawFiles.filter(f => f.name !== file.name);
                                      processPhotosHubFiles([...updatedFiles, newFile]);
                                    }
                                  }}
                                />
                                <div className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive" title="Substituir arquivo">
                                  <ArrowRightLeft className="h-3 w-3" />
                                </div>
                              </label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:text-destructive"
                                onClick={() => removeFileFromQueue(file.name)}
                                title="Remover da fila"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!photosHubUploading && photosHubSummary.accepted > 0 && (
                    <Button
                      type="button"
                      className="w-full h-10 font-bold bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                      onClick={() => uploadPhotosHubFiles(photosHubSummary.rawFiles?.filter(f => {
                        const type = (f.type || '').toLowerCase();
                        const ext = (f.name.split('.').pop() || '').toLowerCase();
                        const isAllowed = (type && PHOTOS_HUB_ALLOWED_TYPES.includes(type)) || (!type.startsWith('video/') && PHOTOS_HUB_ALLOWED_EXT.includes(ext));
                        return isAllowed && f.size <= PHOTOS_HUB_MAX_SIZE;
                      }) || [])}
                    >
                      <Cloud className="mr-2 h-4 w-4" /> INICIAR ENVIO DE {photosHubSummary.accepted} FOTOS
                    </Button>
                  )}
                </div>
              )}

              <Tabs defaultValue="galeria" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="galeria">Galeria</TabsTrigger>
                  <TabsTrigger value="pastas">Pastas (Ano › Data)</TabsTrigger>
                </TabsList>
                <TabsContent value="galeria" className="mt-4">
                  <ScoutGallery
                    key={`gal-${photosHubScoutId}-${photosHubReloadKey}`}
                    scoutId={photosHubScoutId}
                    scoutName={scouts.find(s => s.id === photosHubScoutId)?.name ?? ''}
                    onPickStart={handlePhotoPickStart}
                  />
                </TabsContent>
                <TabsContent value="pastas" className="mt-4">
                  <ScoutFolders
                    key={`fld-${photosHubScoutId}-${photosHubReloadKey}`}
                    scoutId={photosHubScoutId}
                    scoutName={scouts.find(s => s.id === photosHubScoutId)?.name ?? ''}
                    onPickStart={handlePhotoPickStart}
                  />
                </TabsContent>
              </Tabs>

              {photosHubDragging && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-2 font-semibold text-primary">
                      Solte para enviar para {scouts.find(s => s.id === photosHubScoutId)?.name.toUpperCase()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>

      {/* Guardian Dialog */}
      <Dialog open={guardianDialogOpen} onOpenChange={(o) => { setGuardianDialogOpen(o); if (!o) setEditingGuardianId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGuardianId ? 'Editar' : 'Adicionar'} Responsável — {selectedScout?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddGuardian} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do responsável *</Label>
              <Input value={guardianName} onChange={e => setGuardianName(e.target.value)} required placeholder="Nome completo" className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={guardianEmail} onChange={e => setGuardianEmail(e.target.value)} placeholder="email@exemplo.com" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formatPhoneBR(guardianPhone)} onChange={e => setGuardianPhone(formatPhoneBR(e.target.value))} placeholder="(00) 00000-0000" className="h-11" inputMode="tel" maxLength={15} />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs leading-snug text-muted-foreground">
                Uso de imagem está de acordo com o "Termo de Autorização de Uso de Imagem (Paxtu)". Registro escoteiro (ficha de associado/Paxtu).
              </p>
            </div>
            <Button type="submit" className="w-full h-11 font-semibold">{editingGuardianId ? 'Salvar Alterações' : 'Adicionar Responsável'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <ImageCropper
        open={cropperOpen}
        imageSrc={cropperImage}
        onClose={() => {
          setCropperOpen(false);
          photoPickInProgressRef.current = false;
        }}
        onCropComplete={handleCropComplete}
      />

      <CloudPhotoPickerDialog
        open={cloudPickerOpen}
        initialSearch={cloudPickerInitialSearch}
        onClose={() => setCloudPickerOpen(false)}
        onSelect={(file) => {
          setCropperImage(URL.createObjectURL(file));
          setCropperTarget(cloudPickerTarget);
          setCropperOpen(true);
          setCloudPickerOpen(false);
        }}
      />

      {/* Scout detail viewer dialog */}
      <Dialog open={!!viewingScout} onOpenChange={(v) => { if (!v && (cropperOpen || photoPickInProgressRef.current)) return; setViewingScout(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>Perfil do Integrante</span>
              {viewingScout && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 mr-6"
                  onClick={async () => {
                    const { exportScoutProfilePdf } = await import('@/lib/scoutPdfExport');
                    await exportScoutProfilePdf(viewingScout, getGuardiansForScout(viewingScout.id));
                  }}
                >
                  <FileDown className="h-4 w-4" />
                  Exportar PDF
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewingScout && (() => {
            const birthDateObj = parseLocalDate(viewingScout.birth_date);
            const branch = getCurrentBranch(birthDateObj);
            const isAdult = branch?.key === 'voluntario' || calculateAgeInMonths(birthDateObj) >= 252;
            const nextChange = !isAdult ? getNextBranchChange(birthDateObj) : null;
            const scoutGuardians = getGuardiansForScout(viewingScout.id);
            const ageInYears = calculateAge(parseLocalDate(viewingScout.birth_date)).years;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <ScoutAvatar
                    name={viewingScout.name}
                    photoUrl={viewingScout.photo_url}
                    className="h-20 w-20 ring-2 ring-muted cursor-pointer hover:ring-primary transition-all text-3xl shadow-sm"
                    onBroken={() => handleBrokenPhoto(viewingScout.id, document.createElement('img'))}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold uppercase break-words">{viewingScout.name}</h3>
                      {viewingScout.registration_id && (
                        <span className="text-xs text-muted-foreground font-mono">#{String(parseInt(viewingScout.registration_id, 10) || 0).padStart(4, '0')}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{formatAge(parseLocalDate(viewingScout.birth_date))}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {branch && (
                        <Badge className={`${branchColorMap[branch.color]} border font-normal text-xs`}>
                          {branch.icon} {branch.name}
                        </Badge>
                      )}
                      {viewingScout.section && (
                        <Badge variant="outline" className="font-normal text-xs">{viewingScout.section}</Badge>
                      )}
                      {viewingScout.scout_group && (
                        <Badge variant="outline" className="font-normal text-xs">{viewingScout.scout_group}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Tabs defaultValue="dados" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="dados">Dados</TabsTrigger>
                    <TabsTrigger value="fotos">Fotos</TabsTrigger>
                    <TabsTrigger value="eventos">Eventos</TabsTrigger>
                    <TabsTrigger value="conquistas">Conquistas</TabsTrigger>
                    <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
                    <TabsTrigger value="historico">Histórico</TabsTrigger>
                  </TabsList>

                  <TabsContent value="dados" className="mt-4 space-y-4">
                    <ScoutStats
                      scoutId={viewingScout.id}
                      scoutCreatedAt={viewingScout.created_at}
                      scoutBirthDate={viewingScout.birth_date}
                      admissionDate={viewingScout.admission_date}
                    />

                    <div className="space-y-2 text-sm">
                      {viewingScout.registration_id && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">ID do Associado</span>
                          <span className="font-medium font-mono">{viewingScout.registration_id}</span>
                        </div>
                      )}
                      {viewingScout.phone && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Celular</span>
                          <span className="font-medium">{formatPhoneBR(viewingScout.phone)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Data de nascimento</span>
                        <span className="font-medium">
                          {parseLocalDate(viewingScout.birth_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 py-2 border-b">
                        <span className="text-muted-foreground">Ingresso no grupo</span>
                        {canEditScouts ? (
                          <Input
                            type="date"
                            className="h-9 w-[160px] text-sm"
                            value={viewingScout.admission_date || (viewingScout.created_at ? viewingScout.created_at.split('T')[0] : '')}
                            onChange={async (e) => {
                              const newDate = e.target.value || null;
                              const prev = viewingScout;
                              setViewingScout({ ...viewingScout, admission_date: newDate });
                              const { error } = await supabase.from('scouts').update({ admission_date: newDate }).eq('id', viewingScout.id);
                              if (error) {
                                toast.error('Erro ao atualizar data de ingresso');
                                setViewingScout(prev);
                              } else {
                                toast.success('Data de ingresso atualizada');
                                fetchData();
                              }
                            }}
                          />
                        ) : (
                          <span className="font-medium">
                            {viewingScout.admission_date
                              ? parseLocalDate(viewingScout.admission_date).toLocaleDateString('pt-BR')
                              : parseLocalDate((viewingScout.created_at || '').split('T')[0]).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      {viewingScout.scout_group && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Grupo Escoteiro</span>
                          <span className="font-medium">{viewingScout.scout_group}</span>
                        </div>
                      )}
                      {viewingScout.section && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Seção</span>
                          <span className="font-medium">{viewingScout.section}</span>
                        </div>
                      )}
                      {nextChange && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Próximo ramo</span>
                          <span className="font-medium">
                            {nextChange.branch.icon} {nextChange.branch.name} em {formatTimeLeft(nextChange.monthsLeft, nextChange.daysLeft)}
                          </span>
                        </div>
                      )}
                      {viewingScout.notes && (
                        <div className="py-2 border-b">
                          <span className="text-muted-foreground">Observações</span>
                          <p className="mt-1 font-medium">{viewingScout.notes}</p>
                        </div>
                      )}
                    </div>

                    {scoutGuardians.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Responsáveis</h4>
                        <div className="space-y-2">
                          {scoutGuardians.map(g => (
                            <div key={g.id} className="rounded-lg border p-3 text-sm space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{g.name}</span>
                              </div>
                              {g.email && <p className="text-muted-foreground">{g.email}</p>}
                              {g.phone && <p className="text-muted-foreground">{formatPhoneBR(g.phone)}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {ageInYears < 18 && scoutGuardians.length === 0 && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-3">
                        <p>
                          ⚠️ <strong>Responsável obrigatório.</strong> Este integrante é menor de idade e ainda não possui um responsável legal vinculado. Para atender à LGPD e ao ECA, cadastre pelo menos um responsável.
                        </p>
                        {canEditScouts && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedScout(viewingScout);
                              setEditingGuardianId(null);
                              setGuardianName('');
                              setGuardianEmail('');
                              setGuardianPhone('');
                              setGuardianAuth(false);
                              setGuardianDialogOpen(true);
                            }}
                          >
                            ➕ Cadastrar Responsável
                          </Button>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="fotos" className="mt-4">
                    <Tabs defaultValue="galeria" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="galeria">Galeria</TabsTrigger>
                        <TabsTrigger value="pastas">Pastas (Ano › Data)</TabsTrigger>
                      </TabsList>
                      <TabsContent value="galeria" className="mt-4">
                        <ScoutGallery scoutId={viewingScout.id} scoutName={viewingScout.name} onPickStart={handlePhotoPickStart} />
                      </TabsContent>
                      <TabsContent value="pastas" className="mt-4">
                        <ScoutFolders scoutId={viewingScout.id} scoutName={viewingScout.name} onPickStart={handlePhotoPickStart} />
                      </TabsContent>
                    </Tabs>
                  </TabsContent>

                  <TabsContent value="eventos" className="mt-4">
                    <ScoutEvents scoutId={viewingScout.id} />
                  </TabsContent>

                  <TabsContent value="conquistas" className="mt-4">
                    <ScoutAchievements scoutId={viewingScout.id} />
                  </TabsContent>

                  <TabsContent value="timeline" className="mt-4">
                    <ScoutTimeline
                      scoutId={viewingScout.id}
                      scoutCreatedAt={viewingScout.created_at}
                      scoutBirthDate={viewingScout.birth_date}
                      transitionDate={viewingScout.transition_date}
                      admissionDate={viewingScout.admission_date}
                      currentSection={viewingScout.section}
                    />

                  </TabsContent>

                  <TabsContent value="historico" className="mt-4">
                    <ScoutHistory scoutId={viewingScout.id} />
                  </TabsContent>
                </Tabs>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Photo viewer dialog */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-none bg-transparent shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto do integrante</DialogTitle>
          </DialogHeader>
          {viewingPhoto && (
            <div className="relative">
              <img
                src={viewingPhoto}
                alt="Foto do integrante"
                className="w-full h-auto rounded-2xl object-contain max-h-[85vh] shadow-2xl"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="hidden flex-col items-center justify-center py-16 text-muted-foreground bg-background/95 rounded-2xl">
                <ImageIcon className="h-16 w-16 mb-3 opacity-40" />
                <p className="text-sm font-medium">Foto não disponível</p>
                <p className="text-xs mt-1">A imagem foi removida do armazenamento</p>
              </div>
              <div className="flex justify-center mt-4 pb-4">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full shadow-lg"
                  onClick={async () => {
                    try {
                      const response = await fetch(viewingPhoto);
                      if (!response.ok) throw new Error('Not found');
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'foto-escoteiro.jpg';
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      toast.error('Foto não disponível para download');
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-1" /> Baixar foto
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </>
  );
};

export default Scouts;
