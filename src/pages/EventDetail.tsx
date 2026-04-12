import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, MapPin, Upload, Camera, Eye, Download, Trash2, X, ImageIcon, Plus, Video, Film } from 'lucide-react';
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
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos

const EventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, canUpload, canViewMinors } = useAuth();
  const { canUploadEventPhotos, canDownloadEventPhotos, canDeleteEventPhotos } = usePermissions();

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
    await supabase.storage.from('images').remove([img.storage_path]);
    if (img.thumbnail_path) {
      await supabase.storage.from('images').remove([img.thumbnail_path]);
    }
    const { error } = await supabase.from('images').delete().eq('id', img.id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Foto excluída!');
      setImages(prev => prev.filter(i => i.id !== img.id));
      setSelectedImage(null);
      if (user) await logAudit(user.id, 'delete', img.id);
    }
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
          <p className="text-sm text-muted-foreground">
            {images.filter(i => i.media_type === 'image').length} foto{images.filter(i => i.media_type === 'image').length !== 1 ? 's' : ''}
            {images.filter(i => i.media_type === 'video').length > 0 && ` • ${images.filter(i => i.media_type === 'video').length} vídeo${images.filter(i => i.media_type === 'video').length !== 1 ? 's' : ''}`}
          </p>
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
                    Enviar {files.length > 1 ? `${files.length} fotos` : ''}
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
             {(canUploadEventPhotos || canUpload) ? 'Adicione a primeira foto ou vídeo!' : 'Aguarde o upload de mídias.'}
           </p>
           {(canUploadEventPhotos || canUpload) && (
            <div className="mt-4 flex gap-2">
              <Button className="gap-2" onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4" />
                Adicionar Foto
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setShowUpload(true)}>
                <Video className="h-4 w-4" />
                Adicionar Vídeo
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.map((img, index) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(index * 0.02, 0.5) }}
              className="group relative cursor-pointer overflow-hidden rounded-xl bg-muted"
              onClick={() => handleViewImage(img)}
            >
              <div className="aspect-square overflow-hidden">
                {img.media_type === 'video' ? (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    {(thumbUrls[img.id] || imageUrls[img.id]) ? (
                      <img
                        src={thumbUrls[img.id] || imageUrls[img.id]}
                        alt={img.caption || img.filename}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <Film className="h-10 w-10 text-muted-foreground" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white">
                        <Video className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                ) : (thumbUrls[img.id] || imageUrls[img.id]) ? (
                  <img
                    src={thumbUrls[img.id] || imageUrls[img.id]}
                    alt={img.caption || img.filename}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-2xl">📷</span>
                  </div>
                )}
              </div>
              {img.media_type === 'video' && (
                <div className="absolute left-2 top-2">
                  <Badge variant="secondary" className="text-xs gap-1"><Film className="h-3 w-3" />Vídeo</Badge>
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
      )}

      {/* Media Viewer Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl border-0 p-0 overflow-hidden">
          {selectedImage && (
            <div>
              <div className="bg-black">
                {imageUrls[selectedImage.id] && selectedImage.media_type === 'video' ? (
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
                ) : null}
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
                  {canDownloadEventPhotos && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload(selectedImage)}>
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  )}
                  {(canDeleteEventPhotos || user?.id === selectedImage.user_id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
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
            <AlertDialogTitle>Excluir esta foto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteImage) handleDeleteImage(deleteImage); setDeleteImage(null); }}>
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
    </>
  );
};

export default EventDetail;
