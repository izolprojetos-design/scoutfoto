import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload as UploadIcon, X, ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const Upload = () => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [consent, setConsent] = useState(false);
  const [minorAge, setMinorAge] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'group' | 'public'>('group');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    supabase.from('branches').select('*').order('sort_order').then(({ data }) => {
      if (data) setBranches(data);
    });
  }, []);

  const handleFile = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error('Formato não aceito. Use JPG, PNG ou WebP.');
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !branchId || !user) return;
    if (!consent) {
      toast.error('Você precisa confirmar o consentimento.');
      return;
    }

    setUploading(true);
    setProgress(20);

    const branch = branches.find(b => b.id === branchId);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;
    const storagePath = `${branch?.key}/${fileName}`;

    setProgress(40);

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) {
      toast.error('Erro no upload: ' + uploadError.message);
      setUploading(false);
      return;
    }

    setProgress(70);

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    const { error: dbError } = await supabase.from('images').insert({
      user_id: user.id,
      branch_id: branchId,
      filename: fileName,
      storage_path: storagePath,
      caption,
      tags: parsedTags,
      consent,
      minor_age: minorAge ? parseInt(minorAge) : null,
      visibility,
    });

    if (dbError) {
      toast.error('Erro ao salvar: ' + dbError.message);
      setUploading(false);
      return;
    }

    // Log upload
    await supabase.from('upload_logs').insert({
      user_id: user.id,
      action: 'upload',
    });

    setProgress(100);
    toast.success('Foto enviada com sucesso!');

    // Reset form
    setFile(null);
    setPreview(null);
    setCaption('');
    setTags('');
    setConsent(false);
    setMinorAge('');
    setVisibility('group');
    setUploading(false);
    setProgress(0);
  };

  return (
    <AppLayout>
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
                  <div className="relative">
                    <img src={preview} alt="Preview" className="max-h-64 rounded-lg object-contain" />
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
                    <UploadIcon className="mb-2 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Arraste uma imagem ou clique para selecionar
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP • Máx 10MB</p>
                  </>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              {/* Branch */}
              <div className="space-y-2">
                <Label>Ramo</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ramo" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.icon} {b.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Caption */}
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva a atividade..."
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  maxLength={500}
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input
                  placeholder="acampamento, trilha, cerimônia"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                />
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <Label>Visibilidade</Label>
                <Select value={visibility} onValueChange={(v: 'private' | 'group' | 'public') => setVisibility(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">🔒 Privada</SelectItem>
                    <SelectItem value="group">👥 Grupo</SelectItem>
                    <SelectItem value="public">🌍 Pública</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Minor age */}
              <div className="space-y-2">
                <Label>Idade do menor (se aplicável)</Label>
                <Input
                  type="number"
                  min="1"
                  max="17"
                  placeholder="Deixe vazio se não houver menor"
                  value={minorAge}
                  onChange={e => setMinorAge(e.target.value)}
                />
              </div>

              {/* Consent */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(checked === true)}
                />
                <Label htmlFor="consent" className="text-sm leading-snug">
                  Confirmo que tenho autorização para enviar esta imagem e que todas as pessoas retratadas consentiram com sua publicação.
                </Label>
              </div>

              {/* Progress */}
              {uploading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Progress value={progress} className="h-2" />
                  <p className="mt-1 text-center text-xs text-muted-foreground">Enviando...</p>
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!file || !branchId || !consent || uploading}
                size="lg"
              >
                <UploadIcon className="mr-2 h-4 w-4" />
                Enviar Foto
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Upload;
