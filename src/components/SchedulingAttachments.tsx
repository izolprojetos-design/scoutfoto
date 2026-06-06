import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, FileText, Image as ImageIcon, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILES = 5;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXT = '.pdf,.jpg,.jpeg,.png';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
}

interface SchedulingAttachmentsProps {
  requestId: string;
  editable: boolean;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileIcon = ({ type }: { type: string }) =>
  type === 'application/pdf'
    ? <FileText className="h-5 w-5 text-destructive shrink-0" />
    : <ImageIcon className="h-5 w-5 text-primary shrink-0" />;

const SchedulingAttachments = ({ requestId, editable, attachments, onAttachmentsChange }: SchedulingAttachmentsProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) return;
    const fileArray = Array.from(files);

    if (attachments.length + fileArray.length > MAX_FILES) {
      toast({ title: 'Limite excedido', description: `Máximo de ${MAX_FILES} arquivos.`, variant: 'destructive' });
      return;
    }

    for (const f of fileArray) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast({ title: 'Tipo não aceito', description: `"${f.name}" — aceito apenas PDF, JPG e PNG.`, variant: 'destructive' });
        return;
      }
      if (f.size > MAX_SIZE_BYTES) {
        toast({ title: 'Arquivo muito grande', description: `"${f.name}" excede 5 MB.`, variant: 'destructive' });
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);
    const newAttachments: Attachment[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const ext = file.name.split('.').pop() ?? '';
      const storagePath = `${user.id}/${requestId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('anexos-agendamentos')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        toast({ title: 'Erro no upload', description: uploadError.message, variant: 'destructive' });
        continue;
      }

      const { data: row, error: insertError } = await supabase
        .from('agendamento_anexos')
        .insert({
          agendamento_id: requestId,
          file_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
        })
        .select('id, file_name, file_path, file_size, content_type')
        .single();

      if (insertError) {
        toast({ title: 'Erro ao registrar anexo', description: insertError.message, variant: 'destructive' });
        continue;
      }

      newAttachments.push(row);
      setUploadProgress(Math.round(((i + 1) / fileArray.length) * 100));
    }

    onAttachmentsChange([...attachments, ...newAttachments]);
    setUploading(false);
    setUploadProgress(0);
    if (newAttachments.length > 0) {
      toast({ title: `${newAttachments.length} arquivo(s) anexado(s)` });
    }
  }, [user, requestId, attachments, onAttachmentsChange]);

  const handleRemove = async (att: Attachment) => {
    const { error: delStorage } = await supabase.storage
      .from('anexos-agendamentos')
      .remove([att.file_path]);
    if (delStorage) {
      toast({ title: 'Erro ao remover', description: delStorage.message, variant: 'destructive' });
      return;
    }
    await supabase.from('agendamento_anexos').delete().eq('id', att.id);
    onAttachmentsChange(attachments.filter(a => a.id !== att.id));
    toast({ title: 'Anexo removido' });
  };

  const handleDownload = async (att: Attachment) => {
    const { data } = await supabase.storage.from('anexos-agendamentos').createSignedUrl(att.file_path, 60);
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = att.file_name;
      a.target = '_blank';
      a.click();
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!editable || uploading) return;
    uploadFiles(e.dataTransfer.files);
  }, [editable, uploading, uploadFiles]);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Anexos (máx. {MAX_FILES} arquivos, 5 MB cada)</label>

      {/* Drop zone */}
      {editable && attachments.length < MAX_FILES && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors text-sm',
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
            uploading && 'pointer-events-none opacity-60'
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Enviando...</span>
              <Progress value={uploadProgress} className="w-48 h-2" />
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-muted-foreground">Arraste arquivos aqui ou clique para selecionar</span>
              <span className="text-xs text-muted-foreground">PDF, JPG ou PNG</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXT}
            multiple
            className="hidden"
            onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      )}

      {/* File list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {[...attachments]
            .sort((a, b) => a.file_name.localeCompare(b.file_name, undefined, { numeric: true, sensitivity: 'base' }))
            .map(att => (
            <div key={att.id} className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
              <FileIcon type={att.content_type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{att.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(att)}>
                  <Download className="h-4 w-4" />
                </Button>
                {editable && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleRemove(att)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchedulingAttachments;
