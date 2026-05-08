import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Trash2, Loader2, Image as ImageIcon, Eye, FileText, Clock, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import {
  getGroupLogoPublicUrl,
  uploadGroupLogo,
  removeGroupLogo,
  invalidateGroupLogoCache,
} from '@/lib/groupLogo';
import {
  buildScoutProfilePreview,
  buildTimelinePreview,
  buildPhotoFolderPreview,
} from '@/lib/pdfPreviews';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

type PreviewKind = 'profile' | 'timeline' | 'folder';
const PREVIEWS: { key: PreviewKind; label: string; description: string; icon: typeof FileText; build: () => Promise<string> }[] = [
  { key: 'profile', label: 'Perfil do Integrante', description: 'Capa com logo, nome e responsáveis', icon: FileText, build: buildScoutProfilePreview },
  { key: 'timeline', label: 'Linha do Tempo', description: 'Cabeçalho com logo e marcos', icon: Clock, build: buildTimelinePreview },
  { key: 'folder', label: 'Pasta de Fotos por Data', description: 'Capa centralizada com logo', icon: FolderOpen, build: buildPhotoFolderPreview },
];

export default function GroupLogoSettings() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setCurrentUrl(await getGroupLogoPublicUrl());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Formato não aceito. Use PNG, JPG, WEBP ou SVG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Arquivo maior que 2MB.');
      return;
    }
    setBusy(true);
    try {
      await uploadGroupLogo(file);
      toast.success('Logomarca atualizada. Será usada nos próximos PDFs.');
      await refresh();
    } catch (err: any) {
      toast.error(`Falha no upload: ${err.message || 'erro'}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remover a logomarca personalizada e voltar à logo padrão?')) return;
    setBusy(true);
    try {
      await removeGroupLogo();
      toast.success('Logomarca removida.');
      await refresh();
    } catch (err: any) {
      toast.error(`Falha ao remover: ${err.message || 'erro'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Logomarca do Grupo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A logomarca enviada aqui é usada automaticamente nos relatórios e PDFs gerados pelo
          sistema (perfil do integrante, linha do tempo, pasta de fotos). Recomendado: PNG quadrado
          com fundo transparente, até 2MB.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-md border bg-muted/30">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : currentUrl ? (
              <img
                src={currentUrl}
                alt="Logomarca do grupo"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <img
                src="/images/logo-grupo.png"
                alt="Logomarca padrão"
                className="max-h-full max-w-full object-contain opacity-80"
              />
            )}
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <p className="text-sm">
              <span className="font-medium">Status: </span>
              {loading
                ? '—'
                : currentUrl
                ? 'Logomarca personalizada ativa'
                : 'Usando logomarca padrão'}
            </p>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="gap-2"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {currentUrl ? 'Trocar logomarca' : 'Enviar logomarca'}
              </Button>

              {currentUrl && (
                <Button
                  variant="outline"
                  onClick={handleRemove}
                  disabled={busy}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
