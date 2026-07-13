import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, Trash2, Loader2, Image as ImageIcon, Eye, FileText, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { getSignedUrlsBatch } from '@/lib/storageUtils';
import { parseLocalDate } from '@/lib/scoutUtils';
import {
  getGroupLogoPublicUrl,
  uploadGroupLogo,
  removeGroupLogo,
  invalidateGroupLogoCache,
} from '@/lib/groupLogo';
// PDF exports loaded dynamically to keep jsPDF out of the Admin bundle
type ScoutPdfExports = typeof import('@/lib/scoutPdfExport');
const loadScoutPdfExport = (): Promise<ScoutPdfExports> => import('@/lib/scoutPdfExport');

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_BYTES = 2 * 1024 * 1024;

type PreviewKind = 'profile' | 'folder';

interface ScoutOpt {
  id: string;
  name: string;
  birth_date: string;
  created_at: string;
  section: string | null;
  scout_group: string | null;
  registration_id: string | null;
  phone: string | null;
  notes: string | null;
  transition_date: string | null;
  photo_url: string | null;
}

export default function GroupLogoSettings() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Real-data preview state
  const [scouts, setScouts] = useState<ScoutOpt[]>([]);
  const [scoutsLoading, setScoutsLoading] = useState(true);
  const [selectedScoutId, setSelectedScoutId] = useState<string>('');
  const [folderDates, setFolderDates] = useState<{ key: string; count: number }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState<PreviewKind | null>(null);
  const [previewOpen, setPreviewOpen] = useState<{ kind: PreviewKind; url: string; title: string } | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setCurrentUrl(await getGroupLogoPublicUrl());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Load scouts the current user can see (RLS handles section scoping)
  useEffect(() => {
    (async () => {
      setScoutsLoading(true);
      const { data, error } = await supabase
        .from('scouts')
        .select('id, name, birth_date, created_at, section, scout_group, registration_id, phone, notes, transition_date, photo_url')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(500);
      if (error) {
        toast.error('Não foi possível carregar a lista de integrantes.');
      } else {
        setScouts((data || []) as ScoutOpt[]);
      }
      setScoutsLoading(false);
    })();
  }, []);

  // Load photo dates whenever the selected scout changes
  useEffect(() => {
    setSelectedDate('');
    setFolderDates([]);
    if (!selectedScoutId) return;
    (async () => {
      const { data } = await supabase
        .from('scout_photos')
        .select('storage_path, created_at')
        .eq('scout_id', selectedScoutId)
        .order('created_at', { ascending: false })
        .limit(500);
      const counts = new Map<string, number>();
      (data || []).forEach((p: any) => {
        const k = format(new Date(p.created_at), 'yyyy-MM-dd');
        counts.set(k, (counts.get(k) || 0) + 1);
      });
      const list = Array.from(counts.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.key.localeCompare(a.key));
      setFolderDates(list);
      if (list.length > 0) setSelectedDate(list[0].key);
    })();
  }, [selectedScoutId]);

  const selectedScout = useMemo(
    () => scouts.find(s => s.id === selectedScoutId) || null,
    [scouts, selectedScoutId],
  );

  const closePreview = () => setPreviewOpen(null);

  const openInNewTab = () => {
    if (!previewOpen) return;
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${previewOpen.url}" style="border:0;width:100%;height:100vh"></iframe>`,
      );
    } else {
      toast.error('Bloqueado pelo navegador. Permita pop-ups.');
    }
  };

  const downloadPreview = () => {
    if (!previewOpen) return;
    const a = document.createElement('a');
    a.href = previewOpen.url;
    a.download = `previa-${previewOpen.kind}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const previewProfile = async () => {
    if (!selectedScout) return;
    setPreviewLoading('profile');
    try {
      invalidateGroupLogoCache();
      const { data: gData } = await supabase
        .from('guardians')
        .select('name, email, phone')
        .eq('scout_id', selectedScout.id);
      const { exportScoutProfilePdf } = await loadScoutPdfExport();
      const url = await exportScoutProfilePdf(selectedScout, (gData || []) as any, { preview: true });
      if (typeof url === 'string') {
        setPreviewOpen({
          kind: 'profile',
          url,
          title: `Perfil + Linha do Tempo — ${selectedScout.name}`,
        });
      }
    } catch (err: any) {
      toast.error(`Falha na pré-visualização: ${err.message || 'erro'}`);
    } finally {
      setPreviewLoading(null);
    }
  };

  const previewFolder = async () => {
    if (!selectedScout || !selectedDate) return;
    setPreviewLoading('folder');
    try {
      invalidateGroupLogoCache();
      const { data: photos } = await supabase
        .from('scout_photos')
        .select('id, storage_path, created_at')
        .eq('scout_id', selectedScout.id)
        .order('created_at', { ascending: false })
        .limit(500);
      const filtered = (photos || []).filter(
        (p: any) => format(new Date(p.created_at), 'yyyy-MM-dd') === selectedDate,
      );
      if (!filtered.length) {
        toast.error('Sem fotos nessa data.');
        return;
      }
      const signedUrls = await getSignedUrlsBatch(
        'scout-photos',
        filtered.map((p: any) => p.storage_path),
        3600,
      );
      const { exportScoutFolderPdf } = await loadScoutPdfExport();
      const url = await exportScoutFolderPdf(
        selectedScout.name,
        selectedDate,
        filtered as any,
        signedUrls,
        { preview: true },
      );
      if (typeof url === 'string') {
        setPreviewOpen({
          kind: 'folder',
          url,
          title: `Pasta — ${selectedScout.name} • ${format(parseLocalDate(selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
        });
      }
    } catch (err: any) {
      toast.error(`Falha na pré-visualização: ${err.message || 'erro'}`);
    } finally {
      setPreviewLoading(null);
    }
  };

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
    <div className="space-y-6">
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
                <img src={currentUrl} alt="Logomarca do grupo" className="max-h-full max-w-full object-contain" />
              ) : (
                <img src="/images/logo-grupo.png" alt="Logomarca padrão" className="max-h-full max-w-full object-contain opacity-80" />
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <p className="text-sm">
                <span className="font-medium">Status: </span>
                {loading ? '—' : currentUrl ? 'Logomarca personalizada ativa' : 'Usando logomarca padrão'}
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
                <Button onClick={() => inputRef.current?.click()} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {currentUrl ? 'Trocar logomarca' : 'Enviar logomarca'}
                </Button>
                {currentUrl && (
                  <Button variant="outline" onClick={handleRemove} disabled={busy} className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Pré-visualizar PDFs com dados reais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione um integrante para gerar uma pré-visualização real do PDF (perfil completo + linha do tempo)
            e da pasta de fotos por data, usando os dados que estão no sistema.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Integrante</Label>
              <Select value={selectedScoutId} onValueChange={setSelectedScoutId} disabled={scoutsLoading}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder={scoutsLoading ? 'Carregando…' : 'Selecione um integrante'} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {scouts.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name.toUpperCase()}{s.section ? ` • ${s.section}` : ''}
                    </SelectItem>
                  ))}
                  {scouts.length === 0 && !scoutsLoading && (
                    <div className="px-2 py-3 text-sm text-muted-foreground">Nenhum integrante disponível.</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Data da pasta de fotos</Label>
              <Select
                value={selectedDate}
                onValueChange={setSelectedDate}
                disabled={!selectedScoutId || folderDates.length === 0}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder={
                    !selectedScoutId
                      ? 'Selecione um integrante primeiro'
                      : folderDates.length === 0
                        ? 'Sem pastas de fotos'
                        : 'Selecione uma data'
                  } />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {folderDates.map(d => (
                    <SelectItem key={d.key} value={d.key}>
                      {format(parseLocalDate(d.key), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} — {d.count} foto{d.count === 1 ? '' : 's'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={previewProfile}
              disabled={!selectedScout || previewLoading !== null}
              className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-left transition hover:border-primary hover:shadow-md disabled:opacity-60"
            >
              <div className="flex w-full items-center justify-between">
                <FileText className="h-5 w-5 text-primary" />
                {previewLoading === 'profile'
                  ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  : <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary" />}
              </div>
              <div>
                <p className="text-sm font-semibold">Perfil + Linha do Tempo</p>
                <p className="text-xs text-muted-foreground">PDF completo do integrante selecionado</p>
              </div>
            </button>

            <button
              type="button"
              onClick={previewFolder}
              disabled={!selectedScout || !selectedDate || previewLoading !== null}
              className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-left transition hover:border-primary hover:shadow-md disabled:opacity-60"
            >
              <div className="flex w-full items-center justify-between">
                <FolderOpen className="h-5 w-5 text-primary" />
                {previewLoading === 'folder'
                  ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  : <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary" />}
              </div>
              <div>
                <p className="text-sm font-semibold">Pasta de Fotos por Data</p>
                <p className="text-xs text-muted-foreground">Capa + uma foto por página da data escolhida</p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!previewOpen} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewOpen?.title || 'Pré-visualização'}</DialogTitle>
          </DialogHeader>
          {previewOpen && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={openInNewTab} className="gap-2">
                  <Eye className="h-4 w-4" /> Abrir em nova aba
                </Button>
                <Button size="sm" variant="outline" onClick={downloadPreview} className="gap-2">
                  <FileText className="h-4 w-4" /> Baixar PDF
                </Button>
              </div>
              <div className="flex-1 overflow-hidden rounded-md border bg-muted/30">
                <object
                  data={previewOpen.url}
                  type="application/pdf"
                  className="h-[70vh] w-full"
                  aria-label="Pré-visualização do PDF"
                >
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    Seu navegador não conseguiu exibir o PDF aqui. Use os botões acima para abrir em nova aba ou baixar.
                  </div>
                </object>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
