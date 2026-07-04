import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, MapPin, Upload, Camera, Eye, Download, Trash2, X, ImageIcon, Plus, Video, Film, Pencil, Link as LinkIcon, ExternalLink, FileText, ChevronDown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/scoutUtils';
import { ptBR } from 'date-fns/locale';
import { logAudit } from '@/lib/auditLog';
import { compressImage, createThumbnail } from '@/lib/imageCompression';
import { usePermissions } from '@/hooks/usePermissions';
import { useRenderDiagnostics } from '@/lib/useRenderDiagnostics';


interface EventData {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  branch_id: string | null;
  scout_group: string | null;
  created_at: string;
}

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

interface ImageData {
  id: string;
  filename: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  tags: string[] | null;
  minor_age: number | null;
  visibility: string;
  created_at: string;
  user_id: string;
  views: number;
  downloads: number;
  branch_id: string;
  media_type: string;
  duration_seconds: number | null;
  external_url: string | null;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos

const EventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, canUpload, canViewMinors, isAdmin, isVoluntario } = useAuth();
  const { 
    canUploadEventPhotos, 
    canDownloadEventPhotos, 
    canDeleteEventPhotos, 
    canEditEvents, 
    canManageGoogleDrive,
    canAddDriveImages,
    canAddDriveVideos,
    canAddDriveDocuments
  } = usePermissions();
  const canEditThisEvent = isAdmin || isVoluntario || canEditEvents;

  const [event, setEvent] = useState<EventData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [deleteImage, setDeleteImage] = useState<ImageData | null>(null);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [branchId, setBranchId] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [consent, setConsent] = useState(true);
  const [responsibleName, setResponsibleName] = useState('');
  const [minorAge, setMinorAge] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'group' | 'public'>('group');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadingIndex, setUploadingIndex] = useState(0);

  // Filters
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video' | 'document'>('all');

  // External Link state
  const [externalOpen, setExternalOpen] = useState(false);
  const [editingExternal, setEditingExternal] = useState<ImageData | null>(null);
  const [externalTitle, setExternalTitle] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [externalThumbnail, setExternalThumbnail] = useState('');
  const [externalType, setExternalType] = useState<'image' | 'video' | 'document'>('document');
  const [externalBranchId, setExternalBranchId] = useState('');
  const [savingExternal, setSavingExternal] = useState(false);


  // Edit event state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editBranchId, setEditBranchId] = useState('');
  const [editScoutGroup, setEditScoutGroup] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useRenderDiagnostics('EventDetail', {
    eventId, user, event, branches, images, loading,
    imageUrls, thumbUrls, selectedImage, deleteImage,
    showUpload, files, uploading, progress, mediaFilter,
    externalOpen, editOpen,
  });



  const openEditDialog = () => {
    if (!event) return;
    setEditName(event.name);
    setEditDescription(event.description || '');
    setEditEventDate(event.event_date || '');
    setEditLocation(event.location || '');
    setEditBranchId(event.branch_id || '');
    setEditScoutGroup(event.scout_group || '');
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error('O nome do evento é obrigatório.');
      return;
    }
    if (trimmedName.length > 200) {
      toast.error('O nome do evento deve ter no máximo 200 caracteres.');
      return;
    }

    if (editEventDate) {
      // Expect YYYY-MM-DD from <input type="date">
      if (!/^\d{4}-\d{2}-\d{2}$/.test(editEventDate)) {
        toast.error('Data inválida. Use o formato AAAA-MM-DD.');
        return;
      }
      const parsed = parseLocalDate(editEventDate);
      if (Number.isNaN(parsed.getTime())) {
        toast.error('Data inválida.');
        return;
      }
      const [y, m, d] = editEventDate.split('-').map(Number);
      if (
        parsed.getFullYear() !== y ||
        parsed.getMonth() !== m - 1 ||
        parsed.getDate() !== d ||
        y < 1900 ||
        y > 2100
      ) {
        toast.error('Data inválida.');
        return;
      }
    }

    setSavingEdit(true);
    const { error } = await supabase
      .from('events')
      .update({
        name: trimmedName,
        description: editDescription,
        event_date: editEventDate || null,
        location: editLocation,
        branch_id: editBranchId && editBranchId !== 'all' ? editBranchId : null,
        scout_group: editScoutGroup || '',
      })
      .eq('id', event.id);
    setSavingEdit(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    toast.success('Evento atualizado!');
    setEditOpen(false);
    fetchEvent();
  };

  const fetchEvent = async () => {
    if (!eventId) return;
    const { data } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (data) setEvent(data);
    else navigate('/events');
  };

  const fetchImages = useCallback(async () => {
    if (!eventId) return;
    try {
      const { data } = await supabase
        .from('images')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      let filtered = data || [];
      if (!canViewMinors) {
        filtered = filtered.filter(img => img.minor_age === null);
      }
      // Sort: photos first, then videos
      filtered.sort((a, b) => {
        const aIsVideo = a.media_type === 'video' ? 1 : 0;
        const bIsVideo = b.media_type === 'video' ? 1 : 0;
        if (aIsVideo !== bIsVideo) return aIsVideo - bIsVideo;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setImages(filtered);

      // Get signed URLs
      const allPaths = filtered.flatMap(img => {
        const paths: { path: string; id: string; type: 'full' | 'thumb' }[] = [];
      if (img.thumbnail_path) {
        // Only try to sign if it doesn't look like a direct external URL
        if (!img.thumbnail_path.startsWith('http')) {
          paths.push({ path: img.thumbnail_path, id: img.id, type: 'thumb' });
        } else {
          // Direct external URL - set it directly
          thumbs[img.id] = img.thumbnail_path;
        }
      }
      if (img.storage_path) paths.push({ path: img.storage_path, id: img.id, type: 'full' });
        return paths;
      });

      const urls: Record<string, string> = {};
      const thumbs: Record<string, string> = {};
      const batchSize = 10;

      for (let i = 0; i < allPaths.length; i += batchSize) {
        const batch = allPaths.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(item => supabase.storage.from('images').createSignedUrl(item.path, 3600))
        );
        results.forEach((res, idx) => {
          const item = batch[idx];
          if (res.data?.signedUrl) {
            if (item.type === 'thumb') thumbs[item.id] = res.data.signedUrl;
            else urls[item.id] = res.data.signedUrl;
          }
        });
      }

      setImageUrls(prev => ({ ...prev, ...urls }));
      setThumbUrls(prev => ({ ...prev, ...thumbs }));
    } catch (err) {
      console.error('Error fetching images:', err);
      toast.error('Erro ao carregar mídias do evento.');
    } finally {
      setLoading(false);
    }
  }, [eventId, canViewMinors]);

  useEffect(() => {
    supabase.from('branches').select('*').order('sort_order').then(({ data }) => {
      if (data) setBranches(data);
    });
    fetchEvent();
    fetchImages();
  }, [eventId]);

  const getBranchInfo = (bId: string | null) => {
    if (!bId) return null;
    return branches.find(br => br.id === bId);
  };

  const branchInfo = event ? getBranchInfo(event.branch_id) : null;

  // Upload handlers
  const handleFiles = (fileList: FileList) => {
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    Array.from(fileList).forEach(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: formato não aceito.`);
        return;
      }
      const isVideo = ACCEPTED_VIDEO_TYPES.includes(f.type);
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      if (f.size > maxSize) {
        toast.error(`${f.name}: muito grande (máx ${isVideo ? '100MB' : '10MB'}).`);
        return;
      }
      newFiles.push(f);
      newPreviews.push(URL.createObjectURL(f));
    });
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const resetUploadForm = () => {
    setFiles([]);
    setPreviews([]);
    setBranchId('');
    setCaption('');
    setTags('');
    
    setResponsibleName('');
    setMinorAge('');
    setVisibility('group');
    setProgress(0);
    setUploadingIndex(0);
  };

  useEffect(() => {
    if (minorAge && parseInt(minorAge) > 0 && visibility === 'public') {
      setVisibility('group');
      toast.info('Fotos de menores não podem ser públicas.');
    }
  }, [minorAge, visibility]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0 || !branchId || !user || !eventId) return;

    const hasMinor = minorAge && parseInt(minorAge) > 0;
    if (hasMinor && !consent) {
      toast.error('Consentimento obrigatório para fotos de menores.');
      return;
    }

    setUploading(true);
    const totalFiles = files.length;
    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    const resolvedBranchId = branchId === 'all' ? (event?.branch_id || branches[0]?.id || '') : branchId;
    const branch = branches.find(b => b.id === resolvedBranchId);
    let successCount = 0;

    for (let i = 0; i < totalFiles; i++) {
      setUploadingIndex(i + 1);
      setProgress(Math.round(((i) / totalFiles) * 100));

      const currentFile = files[i];
      const isVideo = ACCEPTED_VIDEO_TYPES.includes(currentFile.type);
      const ext = currentFile.name.split('.').pop();
      const ts = Date.now() + i;
      const storagePath = `${branch?.key}/${ts}.${ext}`;

      let fileToUpload: Blob = currentFile;
      let thumbPath: string | null = null;

      if (isVideo) {
        // Upload video directly (no compression)
        fileToUpload = currentFile;
      } else {
        // Compress image and create thumbnail
        fileToUpload = await compressImage(currentFile);
        const thumbnail = await createThumbnail(currentFile);
        thumbPath = `${branch?.key}/thumb_${ts}.webp`;
        await supabase.storage
          .from('images')
          .upload(thumbPath, thumbnail, { contentType: 'image/webp' });
      }

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(storagePath, fileToUpload, { contentType: fileToUpload.type || currentFile.type });

      if (uploadError) {
        toast.error(`Erro no upload (${i + 1}/${totalFiles}): ${uploadError.message}`);
        continue;
      }

      const { data: imgData, error: dbError } = await supabase.from('images').insert({
        user_id: user.id,
        branch_id: resolvedBranchId,
        event_id: eventId,
        filename: `${ts}.${ext}`,
        storage_path: storagePath,
        thumbnail_path: thumbPath,
        caption,
        tags: parsedTags,
        consent,
        responsible_name: responsibleName,
        minor_age: hasMinor ? parseInt(minorAge) : null,
        visibility: hasMinor ? (visibility === 'public' ? 'group' : visibility) : visibility,
        media_type: isVideo ? 'video' : 'image',
      }).select('id').single();

      if (dbError) {
        toast.error(`Erro ao salvar (${i + 1}/${totalFiles}): ${dbError.message}`);
        continue;
      }

      await logAudit(user.id, 'upload', imgData?.id);
      successCount++;
    }

    setProgress(100);
    toast.success(`${successCount} foto${successCount !== 1 ? 's' : ''} enviada${successCount !== 1 ? 's' : ''} com sucesso!`);
    resetUploadForm();
    setShowUpload(false);
    setUploading(false);
    fetchImages();
  };

  const handleViewImage = async (img: ImageData) => {
    try {
      console.log('[Gallery] Abrindo mídia:', img.id, img.filename);
      setSelectedImage(img);
      if (user) {
        logAudit(user.id, 'view', img.id).catch(err => {
          console.warn('[Audit] Falha silenciosa ao registrar visualização:', err);
        });
      }
    } catch (err) {
      console.error('[Gallery] Erro ao abrir visualizador:', err);
      toast.error('Erro ao abrir a imagem. Tente recarregar a página.');
    }
  };

  const handleDownload = async (img: ImageData) => {
    const url = imageUrls[img.id];
    if (!url) return;
    window.open(url, '_blank');
    if (user) await logAudit(user.id, 'download', img.id);
  };

  const handleDeleteImage = async (img: ImageData) => {
    if (!user) return;
    if (img.storage_path) {
      await supabase.storage.from('images').remove([img.storage_path]);
      if (img.thumbnail_path) {
        await supabase.storage.from('images').remove([img.thumbnail_path]);
      }
    }
    const { error } = await supabase.from('images').delete().eq('id', img.id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success(img.external_url ? 'Link excluído!' : 'Mídia excluída!');
      setImages(prev => prev.filter(i => i.id !== img.id));
      setSelectedImage(null);
      if (img.external_url) {
        await logAudit(user.id, 'delete_external_link', img.id);
      } else {
        await logAudit(user.id, 'delete', img.id);
      }
    }
  };


  const openExternalAdd = (type: 'image' | 'video' | 'document' = 'document') => {
    setEditingExternal(null);
    setExternalTitle('');
    setExternalUrl('');
    setExternalThumbnail('');
    setExternalType(type);
    setExternalBranchId(event?.branch_id || 'all');
    setExternalOpen(true);
  };

  const handleExternalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !eventId || !externalUrl || !externalTitle || !externalBranchId) return;

    let normalizedUrl = externalUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Validate URL
    try {
      new URL(normalizedUrl);
    } catch {
      toast.error('URL inválida. Certifique-se de que o endereço está correto.');
      return;
    }

    // Check for Google Drive links and permissions
    const isGoogleDrive = normalizedUrl.includes('drive.google.com') || normalizedUrl.includes('docs.google.com');
    
    // Check global block for Drive and specific allowed types (Admins bypass global settings)
    if (isGoogleDrive && !isAdmin) {
      // 1. Basic permission check
      if (!canManageGoogleDrive) {
        toast.error('Você não tem permissão para adicionar links do Google Drive. Entre em contato com um administrador.');
        await logAudit(user.id, 'access_denied', undefined, { 
          reason: 'missing_google_drive_links_permission',
          url: normalizedUrl,
          type: externalType,
          event_id: eventId
        });
        return;
      }

      const { data: configData } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'google_drive_integration')
        .single();
      
      const config = configData?.value as any;
      if (config) {
        const allowedTypes = config.allowed_types || [];
        const isGloballyDisabled = config.enabled === false;
        const isTypeGloballyAllowed = allowedTypes.includes(externalType);
        
        // Exception check: Specific permissions override global block
        const hasException = (externalType === 'image' && canAddDriveImages) ||
                            (externalType === 'video' && canAddDriveVideos) ||
                            (externalType === 'document' && canAddDriveDocuments);

        if (!hasException && (isGloballyDisabled || !isTypeGloballyAllowed)) {
          const typeLabels: Record<string, string> = {
            image: 'Links de Foto',
            video: 'Links de Vídeo',
            document: 'Links de Documento'
          };
          const requestedType = typeLabels[externalType] || 'Este tipo de link';
          const reason = isGloballyDisabled ? 'global_drive_disabled' : 'type_blocked';
          
          toast.error(`Acesso Negado: O administrador desativou a inclusão de ${requestedType} do Google Drive.`);
          
          await logAudit(user.id, 'access_denied', undefined, { 
            reason,
            url: normalizedUrl,
            type: externalType,
            requested_label: requestedType,
            event_id: eventId
          });
          return;
        }
      }
    }

    setSavingExternal(true);
    const payload = {
      user_id: user.id,
      event_id: eventId,
      branch_id: externalBranchId === 'all' ? (event?.branch_id || branches[0]?.id || '') : externalBranchId,
      filename: externalTitle,
      external_url: normalizedUrl,
      thumbnail_path: externalThumbnail.trim() || null,
      media_type: externalType,
      visibility: 'group' as 'group' | 'private' | 'public',
      consent: true,
    };

    if (editingExternal) {
      const { error } = await supabase
        .from('images')
        .update(payload as any)
        .eq('id', editingExternal.id);

      if (error) {
        toast.error('Erro ao atualizar link: ' + error.message);
      } else {
        toast.success('Link atualizado!');
        setExternalOpen(false);
        setEditingExternal(null);
        await logAudit(user.id, 'edit_external_link', editingExternal.id);
        fetchImages();
      }
    } else {
      const { data: newLink, error } = await supabase
        .from('images')
        .insert([payload] as any)
        .select('id')
        .single();

      if (error) {
        toast.error('Erro ao salvar link: ' + error.message);
      } else {
        toast.success('Link externo adicionado!');
        setExternalOpen(false);
        if (newLink) {
          await logAudit(user.id, 'add_external_link', newLink.id);
        }
        fetchImages();
      }
    }
    
    setSavingExternal(false);
    setExternalTitle('');
    setExternalUrl('');
    setExternalThumbnail('');
    setExternalType('document');
  };

  const openExternalLink = (url: string | null, img?: ImageData) => {
    const contextId = Math.random().toString(36).substring(7);
    console.group(`[Google Drive] Abertura de link (${contextId})`);
    console.log('URL:', url);
    console.log('Mídia ID:', img?.id);
    console.log('Tipo:', img?.media_type);
    
    if (!url) {
      const errorMsg = 'URL não disponível para este link.';
      console.error('[Google Drive] Erro:', errorMsg);
      toast.error(errorMsg, {
        description: "O registro deste link parece estar incompleto no banco de dados."
      });
      if (user && img) {
        logAudit(user.id, 'access_denied', img.id, { 
          reason: 'missing_url',
          filename: img.filename,
          context_id: contextId
        }).catch(err => console.error('[Google Drive] Erro ao registrar auditoria:', err));
      }
      console.groupEnd();
      return;
    }

    try {
      console.log('[Google Drive] Validando formato da URL...');
      const validUrl = new URL(url);
      
      console.log('[Google Drive] Solicitando abertura de nova aba...');
      const newWindow = window.open(validUrl.toString(), '_blank');
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        const errorMsg = 'Abertura do link bloqueada pelo navegador.';
        console.warn('[Google Drive] Pop-up bloqueado.');
        
        toast.warning(errorMsg, {
          description: "Pop-ups estão bloqueados. Clique no botão abaixo para tentar novamente ou copiar o link.",
          action: {
            label: "Copiar Link",
            onClick: () => {
              navigator.clipboard.writeText(validUrl.toString());
              toast.success("Link copiado para a área de transferência!");
            }
          }
        });
        
        if (user && img) {
          logAudit(user.id, 'access_denied', img.id, { 
            reason: 'popup_blocked',
            url: validUrl.toString(),
            context_id: contextId
          }).catch(err => console.error('[Google Drive] Erro ao registrar auditoria:', err));
        }
      } else {
        console.log('[Google Drive] Janela aberta com sucesso.');
        toast.success('Abrindo link do Google Drive...', {
          icon: <LinkIcon className="h-4 w-4" />
        });
      }
    } catch (err: any) {
      const errorMsg = 'Link inválido ou mal formatado.';
      console.error('[Google Drive] Erro crítico:', err);
      toast.error(errorMsg, {
        description: "O endereço salvo não é uma URL válida do Google Drive."
      });
      if (user && img) {
        logAudit(user.id, 'access_denied', img.id, { 
          reason: 'invalid_url_format',
          error_message: err.message,
          raw_url: url,
          context_id: contextId
        }).catch(e => console.error('[Google Drive] Erro ao registrar auditoria:', e));
      }
    }
    console.groupEnd();
  };


  const openExternalEdit = (img: ImageData) => {
    setEditingExternal(img);
    setExternalTitle(img.filename || '');
    setExternalUrl(img.external_url || '');
    setExternalThumbnail(img.thumbnail_path || '');
    setExternalType(img.media_type as any);
    setExternalBranchId(img.branch_id || event?.branch_id || 'all');
    setExternalOpen(true);
  };


  if (!event && !loading) return null;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/events')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{event?.name}</h1>
            {event?.description && (
              <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
            )}
          </div>
          {event && canEditThisEvent && (
            <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-2">
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {event && (
            <Badge variant="secondary" className="gap-1 font-normal">
              Cadastro: {format(new Date(event.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          )}
          {event?.event_date && (
            <Badge variant="secondary" className="gap-1 font-normal">
              <Calendar className="h-3 w-3" />
              Evento: {format(parseLocalDate(event.event_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Badge>
          )}
          {event?.location && (
            <Badge variant="outline" className="gap-1 font-normal">
              <MapPin className="h-3 w-3" />
              Local: {event.location}
            </Badge>
          )}
          {branchInfo && (
            <Badge variant="secondary" className="font-normal">
              {branchInfo.icon} {branchInfo.display_name}
            </Badge>
          )}
          {event?.scout_group && (
            <Badge variant="outline" className="font-normal">
              {event.scout_group}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {(() => {
              const photoCount = images.filter(i => i.media_type === 'image' || i.media_type === 'photo').length;
              const videoCount = images.filter(i => i.media_type === 'video').length;
              const docCount = images.filter(i => i.media_type === 'document').length;
              return (
                <>
                  {photoCount > 0 && (
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {photoCount} foto{photoCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {photoCount > 0 && (videoCount > 0 || docCount > 0) && <span>•</span>}
                  {videoCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Film className="h-3.5 w-3.5" />
                      {videoCount} vídeo{videoCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {(photoCount > 0 || videoCount > 0) && docCount > 0 && <span>•</span>}
                  {docCount > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {docCount} documento{docCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {photoCount === 0 && videoCount === 0 && docCount === 0 && (
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" />
                      0 fotos
                    </span>
                  )}
                </>
              );
            })()}

          </div>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (canUploadEventPhotos || canUpload) && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          <Card className="mb-6 border shadow-sm">
            <CardContent className="p-5">
              <form onSubmit={handleUpload} className="space-y-4">
                {/* Drop zone / previews */}
                <div
                  className="relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById('event-file-input')?.click()}
                >
                  {previews.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-3" onClick={e => e.stopPropagation()}>
                      {previews.map((p, i) => {
                        const isVid = ACCEPTED_VIDEO_TYPES.includes(files[i]?.type);
                        return (
                          <div key={i} className="relative">
                            {isVid ? (
                              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
                                <Film className="h-8 w-8 text-muted-foreground" />
                              </div>
                            ) : (
                              <img src={p} alt={`Preview ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                            )}
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute right-0.5 top-0.5 h-5 w-5"
                              onClick={() => removeFile(i)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                      <div
                        className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                        onClick={() => document.getElementById('event-file-input')?.click()}
                      >
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Arraste ou clique para selecionar</p>
                      <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, MP4, MOV, WebM • Fotos até 10MB • Vídeos até 100MB</p>
                    </>
                  )}
                  <input
                    id="event-file-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm"
                    multiple
                    className="hidden"
                    onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                  />
                  <input
                    id="event-camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => document.getElementById('event-camera-input')?.click()}
                >
                  <Camera className="h-4 w-4" />
                  Tirar Foto
                </Button>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ramo *</Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🌐 Todos os Ramos</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Visibilidade</Label>
                    <Select value={visibility} onValueChange={(v: 'private' | 'group' | 'public') => setVisibility(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">🔒 Privada</SelectItem>
                        <SelectItem value="group">👥 Grupo</SelectItem>
                        <SelectItem value="public" disabled={!!minorAge && parseInt(minorAge) > 0}>🌍 Pública</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea placeholder="Descreva a foto..." value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} className="min-h-[60px]" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Tags (separadas por vírgula)</Label>
                  <Input placeholder="acampamento, trilha" value={tags} onChange={e => setTags(e.target.value)} className="h-9" />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Idade do menor</Label>
                    <Input type="number" min="1" max="17" placeholder="Se aplicável" value={minorAge} onChange={e => setMinorAge(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do responsável</Label>
                    <Input placeholder="Se menor" value={responsibleName} onChange={e => setResponsibleName(e.target.value)} className="h-9" />
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs leading-snug text-muted-foreground">
                    Uso de imagem está de acordo com o "Termo de Autorização de Uso de Imagem (Paxtu)". Registro escoteiro (ficha de associado/Paxtu).
                  </p>
                </div>

                {uploading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Progress value={progress} className="h-2" />
                    <p className="mt-1 text-center text-xs text-muted-foreground">
                      Enviando foto {uploadingIndex} de {files.length}... {progress}%
                    </p>
                  </motion.div>
                )}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowUpload(false); resetUploadForm(); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={files.length === 0 || !branchId || uploading}>
                    <Upload className="mr-2 h-4 w-4" />
                    Enviar {files.length > 1 ? `${files.length} arquivo${files.length !== 1 ? 's' : ''}` : ''}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Gallery */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <ImageIcon className="h-8 w-8" />
          </div>
          <p className="text-lg font-medium text-foreground">Nenhuma mídia neste evento</p>
           <p className="mt-1 text-sm">
             {(canUploadEventPhotos || canUpload) ? 'Adicione fotos, vídeos ou links do Drive!' : 'Aguarde o upload de mídias.'}
           </p>
           {(canUploadEventPhotos || canUpload) && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button className="gap-2" onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4" />
                Adicionar Foto
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setShowUpload(true)}>
                <Video className="h-4 w-4" />
                Adicionar Vídeo
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2" data-testid="link-externo-dropdown">
                    <LinkIcon className="h-4 w-4" />
                    Link Externo
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openExternalAdd('image')} className="gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Link de Foto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openExternalAdd('video')} className="gap-2">
                    <Film className="h-4 w-4" />
                    Link de Vídeo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openExternalAdd('document')} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Link de Documento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {(canUploadEventPhotos || canUpload) && !showUpload && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowUpload(true)}>
                  <Plus className="h-4 w-4" />
                  Novo Upload
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2" data-testid="link-externo-dropdown">
                      <LinkIcon className="h-4 w-4" />
                      Link Externo
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => openExternalAdd('image')} className="gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Link de Foto
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openExternalAdd('video')} className="gap-2">
                      <Film className="h-4 w-4" />
                      Link de Vídeo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openExternalAdd('document')} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Link de Documento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground mr-1">Filtrar:</span>
              <Select value={mediaFilter} onValueChange={(v: any) => setMediaFilter(v)}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Filtrar mídias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="image">Fotos</SelectItem>
                  <SelectItem value="video">Vídeos</SelectItem>
                  <SelectItem value="document">Documentos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {images
              .filter(img => mediaFilter === 'all' || img.media_type === mediaFilter)
              .map((img, index) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
                data-testid={`media-item-${img.id}`}
                className="group relative cursor-pointer overflow-hidden rounded-xl bg-muted"
                onClick={() => handleViewImage(img)}
              >
                <div className="aspect-square overflow-hidden">
                  {img.external_url ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-muted p-4 text-center">
                      <div className="mb-2 rounded-full bg-primary/10 p-3 text-primary">
                        {img.media_type === 'video' ? <Film className="h-6 w-6" /> : 
                         img.media_type === 'image' ? <ImageIcon className="h-6 w-6" /> : 
                         <FileText className="h-6 w-6" />}
                      </div>
                      <p className="text-xs font-medium line-clamp-2 px-1">{img.filename}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openExternalLink(img.external_url, img);
                        }}
                        aria-label="Abrir no Google Drive"
                        className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir no Google Drive
                      </button>
                    </div>
                  ) : img.media_type === 'video' ? (
                  <div className="relative flex h-full w-full items-center justify-center bg-muted">
                    {imageUrls[img.id] ? (
                      <video
                        src={imageUrls[img.id]}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                        playsInline
                        onLoadedData={(e) => {
                          const vid = e.currentTarget;
                          vid.currentTime = 0.5;
                        }}
                      />
                    ) : (
                      <Film className="h-10 w-10 text-muted-foreground" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white">
                        <Video className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                ) : (img.external_url && img.thumbnail_path && img.thumbnail_path.startsWith('http')) ? (
                  <img
                    src={img.thumbnail_path}
                    alt={img.filename}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (thumbUrls[img.id] || imageUrls[img.id]) ? (
                  <img
                    src={thumbUrls[img.id] || imageUrls[img.id]}
                    alt={img.caption || img.filename}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-2xl">{img.media_type === 'video' ? '🎬' : img.media_type === 'document' ? '📄' : '📷'}</span>
                  </div>
                )}

              </div>
              {(img.media_type === 'video' || (img.media_type === 'video' && img.external_url)) && (
                <div className="absolute left-2 top-2">
                  <Badge variant="secondary" className="text-xs gap-1">
                    {img.external_url ? <LinkIcon className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                    {img.external_url ? 'Vídeo (Drive)' : 'Vídeo'}
                  </Badge>
                </div>
              )}
              {(img.media_type === 'document' || (img.media_type === 'document' && img.external_url)) && (
                <div className="absolute left-2 top-2">
                  <Badge variant="secondary" className="text-xs gap-1">
                    {img.external_url ? <LinkIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {img.external_url ? 'Doc (Drive)' : 'Documento'}
                  </Badge>
                </div>
              )}
              {img.media_type === 'image' && img.external_url && (
                <div className="absolute left-2 top-2">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <LinkIcon className="h-3 w-3" />
                    Foto (Drive)
                  </Badge>
                </div>
              )}

              {img.minor_age && (
                <div className="absolute right-2 top-2">
                  <Badge variant="destructive" className="text-xs">Menor</Badge>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    )}


      {/* Media Viewer Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl border-0 p-0 overflow-hidden">




          {selectedImage && (
            <div>

              <div className="bg-black">
                {selectedImage.external_url ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-white min-h-[40vh]">
                    {selectedImage.thumbnail_path && selectedImage.thumbnail_path.startsWith('http') ? (
                      <div className="relative mb-6 w-full max-w-sm aspect-video rounded-lg overflow-hidden border border-white/10 group">
                        <img 
                          src={selectedImage.thumbnail_path} 
                          alt={selectedImage.filename} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <ExternalLink className="h-10 w-10 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 rounded-full bg-white/10 p-6">
                        <LinkIcon className="h-12 w-12" />
                      </div>
                    )}
                    <h3 className="text-xl font-bold mb-2">{selectedImage.filename}</h3>
                    <p className="text-white/60 mb-6 max-w-md">Este é um link externo do Google Drive.</p>
                    <Button 
                      className="gap-2 bg-primary hover:bg-primary/90" 
                      onClick={() => openExternalLink(selectedImage.external_url, selectedImage)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir no Google Drive
                    </Button>
                  </div>

                ) : (imageUrls[selectedImage.id] && selectedImage.media_type === 'video') ? (
                  <video
                    src={imageUrls[selectedImage.id]}
                    controls
                    className="mx-auto max-h-[70vh] w-full"
                    autoPlay
                  />
                ) : imageUrls[selectedImage.id] ? (
                  <img
                    src={imageUrls[selectedImage.id]}
                    alt={selectedImage.caption || ''}
                    className="mx-auto max-h-[70vh] object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-white min-h-[40vh]">
                    <div className="mb-4 rounded-full bg-white/10 p-6">
                      <ImageIcon className="h-12 w-12 text-white/40" />
                    </div>
                    <p className="text-white/60">Não foi possível carregar esta mídia.</p>
                  </div>
                )}
              </div>

              <div className="p-6">
                {selectedImage.caption && (
                  <p className="mb-3 text-lg font-medium">{selectedImage.caption}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(selectedImage.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {selectedImage.views} views
                  </div>
                </div>
                {selectedImage.tags && selectedImage.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedImage.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  {selectedImage.external_url ? (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => openExternalLink(selectedImage.external_url, selectedImage)}>
                      <ExternalLink className="h-4 w-4" />
                      Acessar Link
                    </Button>

                  ) : (
                    canDownloadEventPhotos && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload(selectedImage)}>
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    )
                  )}
                  
                  {selectedImage.external_url && canEditThisEvent && (
                    <Button variant="outline" size="sm" className="gap-2" data-testid="edit-external-link" onClick={() => { openExternalEdit(selectedImage); setSelectedImage(null); }}>
                      <Pencil className="h-4 w-4" />
                      Editar Link
                    </Button>
                  )}

                  {(canDeleteEventPhotos || user?.id === selectedImage.user_id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      data-testid="delete-media-button"
                      onClick={() => { setDeleteImage(selectedImage); setSelectedImage(null); }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  )}
                </div>

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteImage} onOpenChange={(open) => !open && setDeleteImage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteImage?.external_url ? 'este link' : 'esta foto'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteImage?.external_url 
                ? 'Isso removerá apenas a referência ao link externo.' 
                : 'Esta ação removerá permanentemente o arquivo do servidor.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              data-testid="confirm-delete-button"
              onClick={() => { if (deleteImage) handleDeleteImage(deleteImage); setDeleteImage(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FAB para adicionar fotos quando já existem fotos */}
      {images.length > 0 && (canUploadEventPhotos || canUpload) && !showUpload && (
        <button
          onClick={() => { setShowUpload(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
          aria-label="Adicionar Foto"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Edit Event Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do evento</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} required maxLength={200} className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Detalhes da atividade..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={editEventDate} onChange={e => setEditEventDate(e.target.value)} min="1900-01-01" max="2100-12-31" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label>Local</Label>
                <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} className="h-12 text-base" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ramo (opcional)</Label>
              <Select value={editBranchId || 'all'} onValueChange={setEditBranchId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Todos os ramos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os ramos</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grupo Escoteiro (opcional)</Label>
              <Input value={editScoutGroup} onChange={e => setEditScoutGroup(e.target.value)} placeholder="Ex: GE 015" className="h-12 text-base" />
            </div>
            <Button type="submit" disabled={savingEdit} className="w-full h-12 font-semibold">
              {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* External Link Dialog */}
      <Dialog open={externalOpen} onOpenChange={setExternalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExternal ? 'Editar Link Externo' : 'Adicionar Link Externo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleExternalSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="external-title">Título / Nome do Arquivo</Label>
              <Input 
                id="external-title"
                value={externalTitle} 
                onChange={e => setExternalTitle(e.target.value)} 
                placeholder="Ex: Documentos do Acampamento" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-url">URL do Google Drive</Label>
              <Input 
                id="external-url"
                value={externalUrl} 
                onChange={e => setExternalUrl(e.target.value)} 
                placeholder="https://drive.google.com/..." 
                required 
              />
              <p className="text-[10px] leading-tight text-muted-foreground">
                Certifique-se de que o link tenha permissão de visualização para "Qualquer pessoa com o link".
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-thumbnail">URL da Imagem de Capa (Opcional)</Label>
              <Input 
                id="external-thumbnail"
                value={externalThumbnail} 
                onChange={e => setExternalThumbnail(e.target.value)} 
                placeholder="https://exemplo.com/imagem.jpg" 
              />
              <p className="text-[10px] leading-tight text-muted-foreground">
                Cole a URL de uma foto para que o link não fique cinza na galeria.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="external-media-type">Tipo de Mídia</Label>
                <Select value={externalType} onValueChange={(v: any) => setExternalType(v)}>
                  <SelectTrigger id="external-media-type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Foto</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="external-branch">Ramo</Label>
                <Select value={externalBranchId} onValueChange={setExternalBranchId}>
                  <SelectTrigger id="external-branch">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Ramos</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setExternalOpen(false)} disabled={savingExternal}>Cancelar</Button>
              <Button type="submit" disabled={savingExternal} data-testid="save-external-link">
                {savingExternal ? 'Salvando...' : (editingExternal ? 'Salvar Alterações' : 'Adicionar Link')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EventDetail;



