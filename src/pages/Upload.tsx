import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload as UploadIcon, X, Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import { compressImage, createThumbnail } from '@/lib/imageCompression';
import { logAudit } from '@/lib/auditLog';
import ImageCropper from '@/components/ImageCropper';

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

interface Event {
  id: string;
  name: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

const Upload = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [branchId, setBranchId] = useState('');
  const [eventId, setEventId] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [consent, setConsent] = useState(false);
  const [responsibleName, setResponsibleName] = useState('');
  const [minorAge, setMinorAge] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'group' | 'public'>('group');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawPreview, setRawPreview] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('branches').select('*').order('sort_order').then(({ data }) => {
      if (data) setBranches(data);
    });
    supabase.from('events').select('id, name').order('event_date', { ascending: false }).then(({ data }) => {
      if (data) setEvents(data);
    });
  }, []);

  // Pre-select event and open camera from query params
  useEffect(() => {
    const qEventId = searchParams.get('eventId');
    const qCamera = searchParams.get('camera');
    if (qEventId) setEventId(qEventId);
    if (qCamera === 'true') {
      setTimeout(() => document.getElementById('camera-input')?.click(), 500);
    }
  }, [searchParams]);

  // Force visibility when minor
  useEffect(() => {
    if (minorAge && parseInt(minorAge) > 0 && visibility === 'public') {
      setVisibility('group');
      toast.info('Fotos de menores não podem ser públicas.');
    }
  }, [minorAge, visibility]);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !branchId || !user) return;

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

    // Compress image
    const compressed = await compressImage(file);
    setProgress(30);

    // Create thumbnail
    const thumbnail = await createThumbnail(file);
    setProgress(40);

    const branch = branches.find(b => b.id === branchId);
    const ext = file.name.split('.').pop();
    const ts = Date.now();
    const storagePath = `${branch?.key}/${ts}.${ext}`;
    const thumbPath = `${branch?.key}/thumb_${ts}.webp`;

    // Upload main image
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(storagePath, compressed, { contentType: compressed.type });

    if (uploadError) {
      toast.error('Erro no upload: ' + uploadError.message);
      setUploading(false);
      return;
    }
    setProgress(60);

    // Upload thumbnail
    await supabase.storage
      .from('images')
      .upload(thumbPath, thumbnail, { contentType: 'image/webp' });

    setProgress(75);

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    const { data: imgData, error: dbError } = await supabase.from('images').insert({
      user_id: user.id,
      branch_id: branchId,
      event_id: eventId || null,
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

    // Audit log
    await logAudit(user.id, 'upload', imgData?.id);

    setProgress(100);
    toast.success('Foto enviada com sucesso!');

    // Reset form
    setFile(null);
    setPreview(null);
    setCaption('');
    setTags('');
    setConsent(false);
    setResponsibleName('');
    setMinorAge('');
    setVisibility('group');
    setEventId('');
    setUploading(false);
    setProgress(0);
  };

  return (
    <>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
          Upload de Fotos
        </h1>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <form onSubmit={handleUpload} className="space-y-6">
              {/* Drop zone */}
              <div
                className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                  dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                {preview ? (
                  <div className="relative inline-block">
                    <img src={preview} alt="Preview" className="max-h-64 rounded-lg object-contain" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7 shadow-md"
                      onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <UploadIcon className="mb-2 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Arraste uma imagem ou clique para selecionar</p>
                    <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP • Máx 10MB • Compressão automática</p>
                  </>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <input
                  id="camera-input"
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
                className="w-full"
                onClick={() => document.getElementById('camera-input')?.click()}
              >
                <Camera className="mr-2 h-4 w-4" />
                Tirar Foto com Câmera
              </Button>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ramo *</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o ramo" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Evento (opcional)</Label>
                  <Select value={eventId} onValueChange={setEventId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum evento</SelectItem>
                      {events.map(ev => (
                        <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea placeholder="Descreva a atividade..." value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} />
              </div>

              <div className="space-y-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input placeholder="acampamento, trilha, cerimônia" value={tags} onChange={e => setTags(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Visibilidade</Label>
                  <Select value={visibility} onValueChange={(v: 'private' | 'group' | 'public') => setVisibility(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">🔒 Privada</SelectItem>
                      <SelectItem value="group">👥 Grupo</SelectItem>
                      <SelectItem value="public" disabled={!!minorAge && parseInt(minorAge) > 0}>🌍 Pública</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Idade do menor</Label>
                  <Input type="number" min="1" max="17" placeholder="Se aplicável" value={minorAge} onChange={e => setMinorAge(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nome do responsável</Label>
                  <Input placeholder="Se menor" value={responsibleName} onChange={e => setResponsibleName(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
                <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} />
                <Label htmlFor="consent" className="text-sm leading-snug">
                  Confirmo que tenho autorização para enviar esta imagem e que todas as pessoas retratadas consentiram com sua publicação.
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

              <Button type="submit" className="w-full" disabled={!file || !branchId || !consent || uploading} size="lg">
                <UploadIcon className="mr-2 h-4 w-4" />
                Enviar Foto
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {rawPreview && (
        <ImageCropper
          open={cropperOpen}
          imageSrc={rawPreview}
          onClose={handleCropCancel}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  );
};

export default Upload;
