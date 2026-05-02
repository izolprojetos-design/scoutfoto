import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Cloud, FolderOpen, Upload as UploadIcon, Check, ChevronsUpDown, Link2, Loader2, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Scout = {
  id: string;
  name: string;
  section: string | null;
  manual_branch: string | null;
};

type DriveUpload = {
  id: string;
  scout_name: string;
  branch: string;
  photo_date: string;
  file_name: string;
  status: string;
  drive_folder_url: string | null;
  error_message: string | null;
  created_at: string;
};

type GoogleConn = {
  google_email: string;
  expires_at: string;
} | null;

const sectionToBranch = (section: string | null | undefined, manual?: string | null) => {
  if (manual) return manual;
  if (!section) return '';
  return section;
};

const BancoImagens = () => {
  const { user } = useAuth();
  const [connection, setConnection] = useState<GoogleConn>(null);
  const [loadingConn, setLoadingConn] = useState(true);

  const [scouts, setScouts] = useState<Scout[]>([]);
  const [scoutOpen, setScoutOpen] = useState(false);
  const [scoutId, setScoutId] = useState<string | null>(null);
  const [photoDate, setPhotoDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const [history, setHistory] = useState<DriveUpload[]>([]);

  const selectedScout = useMemo(
    () => scouts.find((s) => s.id === scoutId) || null,
    [scoutId, scouts],
  );
  const branch = selectedScout
    ? sectionToBranch(selectedScout.section, selectedScout.manual_branch)
    : '';

  // Load Google connection
  const loadConnection = async () => {
    if (!user) return;
    setLoadingConn(true);
    const { data } = await supabase
      .from('user_google_tokens' as any)
      .select('google_email, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setConnection((data as any) || null);
    setLoadingConn(false);
  };

  // Load scouts
  const loadScouts = async () => {
    const { data, error } = await supabase
      .from('scouts')
      .select('id, name, section, manual_branch')
      .eq('is_active', true)
      .order('name');
    if (error) {
      toast.error('Erro ao carregar integrantes');
      return;
    }
    setScouts((data as any) || []);
  };

  // Load history
  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('drive_uploads' as any)
      .select('id, scout_name, branch, photo_date, file_name, status, drive_folder_url, error_message, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory((data as any) || []);
  };

  useEffect(() => {
    loadConnection();
    loadScouts();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleConnectDrive = () => {
    toast.info('Configuração OAuth pendente — aguardando credenciais do Google Cloud.');
  };

  const handleDisconnect = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('user_google_tokens' as any)
      .delete()
      .eq('user_id', user.id);
    if (error) {
      toast.error('Erro ao desconectar');
      return;
    }
    toast.success('Conta Google desconectada');
    loadConnection();
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScout) {
      toast.error('Selecione um integrante');
      return;
    }
    if (!photoDate) {
      toast.error('Informe a data');
      return;
    }
    if (files.length === 0) {
      toast.error('Selecione ao menos uma foto');
      return;
    }
    if (!connection) {
      toast.error('Conecte sua conta Google Drive primeiro');
      return;
    }

    setUploading(true);
    try {
      // Placeholder: registrar como pending até a Edge Function de upload existir
      const rows = files.map((f) => ({
        user_id: user!.id,
        scout_id: selectedScout.id,
        scout_name: selectedScout.name,
        branch,
        photo_date: photoDate,
        file_name: f.name,
        file_size: f.size,
        mime_type: f.type,
        status: 'pending',
      }));
      const { error } = await supabase.from('drive_uploads' as any).insert(rows);
      if (error) throw error;
      toast.success(`${files.length} foto(s) enfileirada(s) — upload Drive em breve`);
      setFiles([]);
      loadHistory();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enfileirar envio');
    } finally {
      setUploading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'secondary', label: 'Pendente' },
      uploading: { variant: 'secondary', label: 'Enviando' },
      success: { variant: 'default', label: 'Enviado' },
      error: { variant: 'destructive', label: 'Erro' },
    };
    const cfg = map[status] || { variant: 'secondary', label: status };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  return (
    <>
      <Helmet>
        <title>Banco de Imagens — Google Drive | ScoutFoto</title>
        <meta name="description" content="Salve fotos no Google Drive organizadas por ramo, integrante e data." />
      </Helmet>

      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
        <header className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Cloud className="h-7 w-7 text-primary" />
            Banco de Imagens
          </h1>
          <p className="text-sm text-muted-foreground">
            Salve fotos diretamente no seu Google Drive, organizadas por Ramo / Integrante / Data.
          </p>
        </header>

        {/* Conexão Google */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conexão com o Google Drive</CardTitle>
            <CardDescription>
              Cada usuário conecta sua própria conta Google. As fotos vão para o Drive pessoal de quem envia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingConn ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Verificando conexão…
              </div>
            ) : connection ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  Conectado como <strong>{connection.google_email || 'conta Google'}</strong>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Nenhuma conta conectada. A integração OAuth está aguardando configuração das credenciais do Google Cloud.
                  </span>
                </div>
                <Button onClick={handleConnectDrive} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Conectar Google Drive
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Salvar fotos no Drive</CardTitle>
            <CardDescription>
              Estrutura criada: <code className="text-xs">Ramo / Nome / Data / Fotos</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Integrante */}
                <div className="space-y-2">
                  <Label>Integrante *</Label>
                  <Popover open={scoutOpen} onOpenChange={setScoutOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-12 font-normal"
                      >
                        {selectedScout ? (
                          <span className="truncate uppercase">{selectedScout.name}</span>
                        ) : (
                          <span className="text-muted-foreground">Selecionar integrante…</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar integrante…" />
                        <CommandList>
                          <CommandEmpty>Nenhum integrante encontrado</CommandEmpty>
                          <CommandGroup>
                            {scouts.map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.name}
                                onSelect={() => {
                                  setScoutId(s.id);
                                  setScoutOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    scoutId === s.id ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                <span className="uppercase break-words">{s.name}</span>
                                {s.section && (
                                  <span className="ml-auto text-xs text-muted-foreground">{s.section}</span>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Ramo (somente leitura) */}
                <div className="space-y-2">
                  <Label>Ramo</Label>
                  <Input value={branch || ''} readOnly placeholder="Selecione um integrante" />
                </div>

                {/* Data */}
                <div className="space-y-2">
                  <Label htmlFor="photo-date">Data *</Label>
                  <Input
                    id="photo-date"
                    type="date"
                    value={photoDate}
                    onChange={(e) => setPhotoDate(e.target.value)}
                    required
                  />
                </div>

                {/* Arquivos */}
                <div className="space-y-2">
                  <Label htmlFor="files">Fotos *</Label>
                  <Input
                    id="files"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFilesChange}
                  />
                  {files.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {files.length} arquivo(s) selecionado(s)
                    </p>
                  )}
                </div>
              </div>

              <Button type="submit" disabled={uploading} className="w-full md:w-auto gap-2">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadIcon className="h-4 w-4" />
                )}
                Salvar no Google Drive
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5" /> Histórico de envios
            </CardTitle>
            <CardDescription>Últimos 50 envios feitos por você.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum envio ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Integrante</TableHead>
                      <TableHead>Ramo</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pasta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(h.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="uppercase break-words max-w-[180px]">
                          {h.scout_name}
                        </TableCell>
                        <TableCell className="text-xs">{h.branch}</TableCell>
                        <TableCell className="text-xs break-all max-w-[200px]">
                          {h.file_name}
                        </TableCell>
                        <TableCell>{statusBadge(h.status)}</TableCell>
                        <TableCell>
                          {h.drive_folder_url ? (
                            <a
                              href={h.drive_folder_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                            >
                              <FolderOpen className="h-3 w-3" /> Abrir
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default BancoImagens;
