import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
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
import { ArrowLeft, Calendar, MapPin, Upload, Camera, Eye, Download, Trash2, X, ImageIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAudit } from '@/lib/auditLog';
import { compressImage, createThumbnail } from '@/lib/imageCompression';
import ImageCropper from '@/components/ImageCropper';

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
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

const EventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, canUpload, canViewMinors } = useAuth();

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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [branchId, setBranchId] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [consent, setConsent] = useState(false);
  const [responsibleName, setResponsibleName] = useState('');
  const [minorAge, setMinorAge] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'group' | 'public'>('group');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawPreview, setRawPreview] = useState<string | null>(null);

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
  const handleFile = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error('Formato não aceito. Use JPG, PNG ou WebP.');
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }
    setRawPreview(URL.createObjectURL(f));
    setCropperOpen(true);
  };

  const handleCropComplete = useCallback((croppedFile: File) => {
    setFile(croppedFile);
    setPreview(URL.createObjectURL(croppedFile));
    setCropperOpen(false);
    setRawPreview(null);
  }, []);

  const handleCropCancel = useCallback(() => {
    setCropperOpen(false);
    setRawPreview(null);
  }, []);

  const resetUploadForm = () => {
    setFile(null);
    setPreview(null);
    setBranchId('');
    setCaption('');
    setTags('');
    setConsent(false);
    setResponsibleName('');
    setMinorAge('');
    setVisibility('group');
    setProgress(0);
  };

  useEffect(() => {
    if (minorAge && parseInt(minorAge) > 0 && visibility === 'public') {
      setVisibility('group');
      toast.info('Fotos de menores não podem ser públicas.');
    }
  }, [minorAge, visibility]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !branchId || !user || !eventId) return;

    const hasMinor = minorAge && parseInt(minorAge) > 0;
    if (hasMinor && !consent) {
      toast.error('Consentimento obrigatório para fotos de menores.');
      return;
    }
    if (!consent) {
      toast.error('Você precisa confirmar o consentimento.');
      return;
    }

    setUploading(true);
    setProgress(10);

    const compressed = await compressImage(file);
    setProgress(30);
    const thumbnail = await createThumbnail(file);
    setProgress(40);

    const branch = branches.find(b => b.id === branchId);
    const ext = file.name.split('.').pop();
    const ts = Date.now();
    const storagePath = `${branch?.key}/${ts}.${ext}`;
    const thumbPath = `${branch?.key}/thumb_${ts}.webp`;

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(storagePath, compressed, { contentType: compressed.type });

    if (uploadError) {
      toast.error('Erro no upload: ' + uploadError.message);
      setUploading(false);
      return;
    }
    setProgress(60);

    await supabase.storage
      .from('images')
      .upload(thumbPath, thumbnail, { contentType: 'image/webp' });
    setProgress(75);

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    const { data: imgData, error: dbError } = await supabase.from('images').insert({
      user_id: user.id,
      branch_id: branchId,
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
    }).select('id').single();

    if (dbError) {
      toast.error('Erro ao salvar: ' + dbError.message);
      setUploading(false);
      return;
    }

    await logAudit(user.id, 'upload', imgData?.id);
    setProgress(100);
    toast.success('Foto enviada com sucesso!');
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
    <AppLayout>
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
          {event?.event_date && (
            <Badge variant="secondary" className="gap-1 font-normal">
              <Calendar className="h-3 w-3" />
              {format(new Date(event.event_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Badge>
          )}
          {event?.location && (
            <Badge variant="outline" className="gap-1 font-normal">
              <MapPin className="h-3 w-3" />
              {event.location}
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
          <p className="text-sm text-muted-foreground">{images.length} foto{images.length !== 1 ? 's' : ''}</p>
          {canUpload && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowUpload(!showUpload)}>
                <Upload className="h-4 w-4" />
                Adicionar Foto
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && canUpload && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          <Card className="mb-6 border shadow-sm">
            <CardContent className="p-5">
              <form onSubmit={handleUpload} className="space-y-4">
                {/* Drop zone */}
                <div
                  className="relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById('event-file-input')?.click()}
                >
                  {preview ? (
                    <div className="relative">
                      <img src={preview} alt="Preview" className="max-h-48 rounded-lg object-contain" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -right-2 -top-2 h-7 w-7"
                        onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Arraste ou clique para selecionar</p>
                      <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP • Máx 10MB</p>
                    </>
                  )}
                  <input
                    id="event-file-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  <input
                    id="event-camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
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

                <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                  <Checkbox id="event-consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} />
                  <Label htmlFor="event-consent" className="text-xs leading-snug">
                    Confirmo que tenho autorização para enviar esta imagem e que todas as pessoas retratadas consentiram.
                  </Label>
                </div>

                {uploading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Progress value={progress} className="h-2" />
                    <p className="mt-1 text-center text-xs text-muted-foreground">
                      {progress < 30 ? 'Comprimindo...' : progress < 60 ? 'Enviando...' : progress < 90 ? 'Salvando...' : 'Concluído!'}
                    </p>
                  </motion.div>
                )}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowUpload(false); resetUploadForm(); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={!file || !branchId || !consent || uploading}>
                    <Upload className="mr-2 h-4 w-4" />
                    Enviar
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
          <p className="text-lg font-medium text-foreground">Nenhuma foto neste evento</p>
          <p className="mt-1 text-sm">
            {canUpload ? 'Adicione a primeira foto!' : 'Aguarde o upload de fotos.'}
          </p>
          {canUpload && (
            <Button className="mt-4 gap-2" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4" />
              Adicionar Foto
            </Button>
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
                {(thumbUrls[img.id] || imageUrls[img.id]) ? (
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
              {img.minor_age && (
                <div className="absolute right-2 top-2">
                  <Badge variant="destructive" className="text-xs">Menor</Badge>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Image Viewer Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl border-0 p-0 overflow-hidden">
          {selectedImage && (
            <div>
              <div className="bg-black">
                {imageUrls[selectedImage.id] && (
                  <img
                    src={imageUrls[selectedImage.id]}
                    alt={selectedImage.caption || ''}
                    className="mx-auto max-h-[70vh] object-contain"
                  />
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
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload(selectedImage)}>
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  {(user?.id === selectedImage.user_id) && (
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

      {/* Cropper */}
      {rawPreview && (
        <ImageCropper
          open={cropperOpen}
          imageSrc={rawPreview}
          onClose={handleCropCancel}
          onCropComplete={handleCropComplete}
        />
      )}
    </AppLayout>
  );
};

export default EventDetail;
