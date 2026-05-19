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
import { ArrowLeft, Calendar, MapPin, Upload, Camera, Eye, Download, Trash2, X, ImageIcon, Plus, Video, Film, Pencil, Link as LinkIcon, ExternalLink, FileText } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/scoutUtils';
import { ptBR } from 'date-fns/locale';
import { logAudit } from '@/lib/auditLog';
import { compressImage, createThumbnail } from '@/lib/imageCompression';
import { usePermissions } from '@/hooks/usePermissions';


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
  const { canUploadEventPhotos, canDownloadEventPhotos, canDeleteEventPhotos, canEditEvents } = usePermissions();
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

  // External Link state
  const [externalOpen, setExternalOpen] = useState(false);
  const [editingExternal, setEditingExternal] = useState<ImageData | null>(null);
  const [externalTitle, setExternalTitle] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
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
      if (img.thumbnail_path) paths.push({ path: img.thumbnail_path, id: img.id, type: 'thumb' });
      paths.push({ path: img.storage_path, id: img.id, type: 'full' });
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
    setLoading(false);
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
    setSelectedImage(img);
    if (user) await logAudit(user.id, 'view', img.id);
  };

  const handleDownload = async (img: ImageData) => {
    const url = imageUrls[img.id];
    if (!url) return;
    window.open(url, '_blank');
    if (user) await logAudit(user.id, 'download', img.id);
  };

  const handleDeleteImage = async (img: ImageData) => {
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
      if (user) await logAudit(user.id, 'delete', img.id);
    }
  };

  const handleExternalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !eventId || !externalUrl || !externalTitle || !externalBranchId) return;

    // Validate URL
    try {
      new URL(externalUrl);
    } catch {
      toast.error('URL inválida. Certifique-se de incluir http:// ou https://');
      return;
    }

    setSavingExternal(true);
    const payload = {
      user_id: user.id,
      event_id: eventId,
      branch_id: externalBranchId === 'all' ? (event?.branch_id || branches[0]?.id || '') : externalBranchId,
      filename: externalTitle,
      external_url: externalUrl,
