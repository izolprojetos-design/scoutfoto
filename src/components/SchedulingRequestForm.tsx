import { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, Send, CheckCircle2, Upload, X, FileText, Image as ImageIcon, AlertCircle, Check, RotateCcw } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { SCHEDULING_TYPES } from '@/lib/schedulingTypes';
import { VOLUNTEER_SECTIONS, VOLUNTEER_CARGOS, VOLUNTEER_CARGO_CATEGORIES, parseVolunteerSection } from '@/lib/sectionOptions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import SchedulingAttachments from '@/components/SchedulingAttachments';

const MAX_FILES = 5;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXT = '.pdf,.jpg,.jpeg,.png';

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface Branch {
  id: string;
  display_name: string;
  icon: string;
}

interface Props {
  onSuccess?: () => void;
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
}

type FileUploadStatus = 'pending' | 'uploading' | 'done' | 'error';

interface FileUploadState {
  file: File;
  status: FileUploadStatus;
  progress: number; // 0-100
  error?: string;
}

/** Upload via XHR to get real progress events */
function uploadWithProgress(
  bucket: string,
  path: string,
  file: File,
  token: string,
  onProgress: (pct: number) => void,
): Promise<{ error: string | null }> {
  return new Promise((resolve) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ error: null });
      else {
        try {
          const body = JSON.parse(xhr.responseText);
          resolve({ error: body.message || body.error || `HTTP ${xhr.status}` });
        } catch {
          resolve({ error: `HTTP ${xhr.status}` });
        }
      }
    };
    xhr.onerror = () => resolve({ error: 'Erro de rede' });
    const formData = new FormData();
    formData.append('', file, path);
    // Send raw file with content-type header instead of FormData
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

const SchedulingRequestForm = ({ onSuccess }: Props) => {
  const { user, profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadStates, setUploadStates] = useState<FileUploadState[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [secao, setSecao] = useState('');
  const [cargo1, setCargo1] = useState('');
  const [cargo2, setCargo2] = useState('');
  const [email, setEmail] = useState('');
  const [destinatarioEmail, setDestinatarioEmail] = useState('');
  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [local, setLocal] = useState('');
  const [branchId, setBranchId] = useState('');
  const [tipo, setTipo] = useState('reuniao');
  const [descricao, setDescricao] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) return `"${f.name}" — tipo não aceito (apenas PDF, JPG, PNG)`;
    if (f.size > MAX_SIZE_BYTES) return `"${f.name}" — excede 5 MB (${formatFileSize(f.size)})`;
    return null;
  };

  const addPendingFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newErrors: string[] = [];
    const valid: File[] = [];

    if (pendingFiles.length + fileArray.length > MAX_FILES) {
      toast({ title: 'Limite excedido', description: `Máximo de ${MAX_FILES} arquivos.`, variant: 'destructive' });
      return;
    }

    for (const f of fileArray) {
      const err = validateFile(f);
      if (err) {
        newErrors.push(err);
      } else {
        valid.push(f);
      }
    }

    if (newErrors.length > 0) {
      setFileErrors(newErrors);
    } else {
      setFileErrors([]);
    }

    if (valid.length > 0) {
      setPendingFiles(prev => [...prev, ...valid]);
    }
  }, [pendingFiles]);

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
    setFileErrors([]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (submitting) return;
    addPendingFiles(e.dataTransfer.files);
  }, [submitting, addPendingFiles]);

  useEffect(() => {
    supabase.from('branches').select('id, display_name, icon').order('sort_order')
      .then(({ data }) => setBranches(data ?? []));
  }, []);

  useEffect(() => {
    if (profile?.name && !nomeResponsavel) setNomeResponsavel(profile.name);
    if ((profile?.email || user?.email) && !email) setEmail(profile?.email ?? user?.email ?? '');
    if (profile?.section && !secao && !cargo1) {
      const parsed = parseVolunteerSection(profile.section);
      if (parsed.secao) setSecao(parsed.secao);
      if (parsed.cargo1) setCargo1(parsed.cargo1);
      if (parsed.cargo2) setCargo2(parsed.cargo2);
    }
  }, [profile, user, nomeResponsavel, email, secao, cargo1]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (nomeResponsavel.trim().length < 2) e.nomeResponsavel = 'Informe o nome completo';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = 'E-mail inválido';
    if (destinatarioEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destinatarioEmail.trim())) e.destinatarioEmail = 'E-mail inválido';
    if (!data) e.data = 'Selecione a data';
    else {
      const today = new Date(); today.setHours(0,0,0,0);
      const [y, m, d] = data.split('-').map(Number);
      const sel = new Date(y, m - 1, d);
      if (sel < today) e.data = 'Data deve ser hoje ou futura';
    }
    if (!/^\d{2}:\d{2}$/.test(horario)) e.horario = 'Formato HH:MM';
    if (local.trim().length < 2) e.local = 'Informe o local';
    if (!branchId) e.branchId = 'Selecione um ramo';
    if (descricao.trim().length < 5) e.descricao = 'Mínimo 5 caracteres';

    // Re-validate pending files before submit
    const fErrors: string[] = [];
    for (const f of pendingFiles) {
      const err = validateFile(f);
      if (err) fErrors.push(err);
    }
    if (pendingFiles.length > MAX_FILES) {
      fErrors.push(`Máximo de ${MAX_FILES} arquivos permitido`);
    }
    setFileErrors(fErrors);

    setErrors(e);
    return Object.keys(e).length === 0 && fErrors.length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user) return;
    if (!validate()) return;

    setSubmitting(true);
    const { data: inserted, error } = await supabase
      .from('scheduling_requests')
      .insert({
        user_id: user.id,
        nome_responsavel: nomeResponsavel.trim(),
        email: email.trim(),
        destinatario_email: destinatarioEmail.trim(),
        data,
        horario,
        local: local.trim(),
        branch_id: branchId,
        tipo,
        descricao: descricao.trim(),
      })
      .select('id, token_confirmacao')
      .single();

    if (error || !inserted) {
      setSubmitting(false);
      toast({ title: 'Erro ao enviar', description: error?.message ?? 'Falha desconhecida', variant: 'destructive' });
      return;
    }

    // Fire-and-forget confirmation email
    const branchLabel = branches.find(b => b.id === branchId);
    const tipoLabel = SCHEDULING_TYPES.find(t => t.value === tipo)?.label ?? tipo;
    const [y, m, d] = data.split('-');
    const confirmUrl = `${window.location.origin}/confirmar-agendamento?token=${inserted.token_confirmacao}`;

    supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'scheduling-confirmation',
        recipientEmail: email.trim(),
        idempotencyKey: `scheduling-confirm-${inserted.id}`,
        templateData: {
          nomeResponsavel: nomeResponsavel.trim(),
          data: `${d}/${m}/${y}`,
          horario,
          local: local.trim(),
          tipo: tipoLabel,
          ramo: branchLabel ? `${branchLabel.icon} ${branchLabel.display_name}` : '',
          descricao: descricao.trim(),
          confirmUrl,
        },
      },
    }).catch(err => console.error('Failed to send confirmation email', err));

    // Notify admins about the new scheduling request (fire-and-forget)
    Promise.resolve(supabase.rpc('get_admin_emails')).then(({ data: adminRows }) => {
      if (!adminRows?.length) return;
      const templateData = {
        nomeResponsavel: nomeResponsavel.trim(),
        emailSolicitante: email.trim(),
        data: `${d}/${m}/${y}`,
        horario,
        local: local.trim(),
        tipo: tipoLabel,
        ramo: branchLabel ? `${branchLabel.icon} ${branchLabel.display_name}` : '',
        assunto: descricao.trim(),
      };
      for (const row of adminRows) {
        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'scheduling-admin-notification',
            recipientEmail: row.email,
            idempotencyKey: `scheduling-admin-${inserted.id}-${row.email}`,
            templateData,
          },
        }).catch(err => console.error('Failed to notify admin', row.email, err));
      }
    }).catch(err => console.error('Failed to fetch admin emails', err));

    // Upload pending files with real progress
    const uploadedAttachments: Attachment[] = [];
    if (pendingFiles.length > 0) {
      setIsUploadingAttachments(true);
      const states: FileUploadState[] = pendingFiles.map(f => ({ file: f, status: 'pending' as FileUploadStatus, progress: 0 }));
      setUploadStates([...states]);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? '';

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        states[i] = { ...states[i], status: 'uploading', progress: 0 };
        setUploadStates([...states]);

        const ext = file.name.split('.').pop() ?? '';
        const storagePath = `${user.id}/${inserted.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await uploadWithProgress(
          'anexos-agendamentos',
          storagePath,
          file,
          token,
          (pct) => {
            states[i] = { ...states[i], progress: pct };
            setUploadStates([...states]);
          },
        );

        if (uploadError) {
          states[i] = { ...states[i], status: 'error', error: uploadError };
          setUploadStates([...states]);
          continue;
        }

        states[i] = { ...states[i], progress: 100 };
        setUploadStates([...states]);

        const { data: row, error: insertErr } = await supabase
          .from('agendamento_anexos')
          .insert({ agendamento_id: inserted.id, file_path: storagePath, file_name: file.name, file_size: file.size, content_type: file.type })
          .select('id, file_name, file_path, file_size, content_type')
          .single();

        if (insertErr || !row) {
          states[i] = { ...states[i], status: 'error', error: insertErr?.message ?? 'Erro ao registrar' };
          setUploadStates([...states]);
          continue;
        }

        states[i] = { ...states[i], status: 'done' };
        setUploadStates([...states]);
        uploadedAttachments.push(row);
      }

      const errorCount = states.filter(s => s.status === 'error').length;
      if (uploadedAttachments.length > 0) {
        toast({ title: `${uploadedAttachments.length} anexo(s) enviado(s)${errorCount > 0 ? `, ${errorCount} com erro` : ''}` });
      } else if (errorCount > 0) {
        toast({ title: 'Falha ao enviar anexos', description: 'Nenhum anexo foi enviado com sucesso.', variant: 'destructive' });
      }
      setIsUploadingAttachments(false);
      // Keep uploadStates visible if there are errors so user can retry
      if (errorCount === 0) {
        setUploadStates([]);
      }
    }

    setSubmitting(false);
    setInsertedId(inserted.id);
    // Only show success screen if no upload errors remain
    const hasUploadErrors = uploadStates.length > 0 || pendingFiles.some((_, i) => {
      const s = uploadStates[i]; // won't exist after clearing but check states array
      return false;
    });
    const finalStates = pendingFiles.length > 0 
      ? pendingFiles.map((f, i) => {
          const s = uploadStates[i] ?? { file: f, status: 'pending' as FileUploadStatus, progress: 0 };
          return s;
        }).filter(s => s.status === 'error')
      : [];
    
    if (finalStates.length > 0) {
      // Keep form visible with error states for retry
      setAttachments(prev => [...prev, ...uploadedAttachments]);
      toast({ title: 'Solicitação enviada!', description: 'Alguns anexos falharam. Você pode tentar reenviá-los.' });
    } else {
      setSubmitted(true);
      setAttachments(uploadedAttachments);
      toast({ title: 'Solicitação enviada!', description: 'Verifique seu e-mail para confirmar a solicitação.' });
      setPendingFiles([]);
      setUploadStates([]);
    }
    setData(''); setHorario(''); setLocal(''); setBranchId(''); setTipo('reuniao'); setDescricao(''); setDestinatarioEmail(''); setSecao(''); setCargo1(''); setCargo2('');
    onSuccess?.();
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <AlertTitle>Solicitação registrada com sucesso</AlertTitle>
          <AlertDescription className="mt-1">
            Sua solicitação está com status <strong>Pendente</strong>. Você poderá acompanhá-la na aba "Minhas Solicitações".
          </AlertDescription>
        </Alert>

        {insertedId && (
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <SchedulingAttachments
                requestId={insertedId}
                editable={true}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
            </CardContent>
          </Card>
        )}

        <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setInsertedId(null); setAttachments([]); }}>
          Nova solicitação
        </Button>
      </div>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle>Solicitar Agendamento de Seção</CardTitle>
        <CardDescription>
          Preencha os dados abaixo. A solicitação passará por análise antes de virar um evento no calendário.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do associado *</Label>
              <Input id="nome" value={nomeResponsavel} onChange={e => setNomeResponsavel(e.target.value)} placeholder="Seu nome completo" />
              {errors.nomeResponsavel && <p className="text-sm text-destructive">{errors.nomeResponsavel}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="secao">Seção</Label>
              <select
                id="secao"
                value={secao}
                onChange={e => setSecao(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Selecione a seção</option>
                {VOLUNTEER_SECTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo1">Cargo (1ª Função)</Label>
              <select
                id="cargo1"
                value={cargo1}
                onChange={e => setCargo1(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Selecione o cargo</option>
                {Object.entries(VOLUNTEER_CARGO_CATEGORIES).map(([cat, cargos]) => (
                  <optgroup key={cat} label={cat}>
                    {cargos.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo2">Cargo (2ª Função)</Label>
              <select
                id="cargo2"
                value={cargo2}
                onChange={e => setCargo2(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Nenhum</option>
                {Object.entries(VOLUNTEER_CARGO_CATEGORIES).map(([cat, cargos]) => (
                  <optgroup key={cat} label={cat}>
                    {cargos.map(c => (
                      <option key={c} value={c} disabled={c === cargo1}>{c}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">De E-mail *</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="destinatario-email">Para E-mail</Label>
              <Input id="destinatario-email" type="email" value={destinatarioEmail} onChange={e => setDestinatarioEmail(e.target.value)} placeholder="destinatario@exemplo.com" />
              {errors.destinatarioEmail && <p className="text-sm text-destructive">{errors.destinatarioEmail}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="data">Data da seção *</Label>
              <Input id="data" type="date" value={data} onChange={e => setData(e.target.value)} />
              {errors.data && <p className="text-sm text-destructive">{errors.data}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="horario">Horário *</Label>
              <Input id="horario" type="time" value={horario} onChange={e => setHorario(e.target.value)} />
              {errors.horario && <p className="text-sm text-destructive">{errors.horario}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="local">Local *</Label>
              <Input id="local" value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex: Sede do grupo, Parque Anauá..." />
              {errors.local && <p className="text-sm text-destructive">{errors.local}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Ramo escoteiro *</Label>
              <select
                id="branch"
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Selecione o ramo</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.icon} {b.display_name}</option>
                ))}
              </select>
              {errors.branchId && <p className="text-sm text-destructive">{errors.branchId}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de atividade *</Label>
              <select
                id="tipo"
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {SCHEDULING_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Assunto / Observações *</Label>
            <Textarea id="descricao" rows={4} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhe a atividade, materiais necessários, observações importantes..." />
            <p className="text-sm text-muted-foreground">Mínimo 5 caracteres, máximo 1000.</p>
            {errors.descricao && <p className="text-sm text-destructive">{errors.descricao}</p>}
          </div>

          {/* Anexos inline */}
          <div className="space-y-3">
            <Label>Anexos (máx. {MAX_FILES} arquivos, 5 MB cada)</Label>

            {/* Erros de validação por arquivo — sempre no topo da seção */}
            {fileErrors.length > 0 && (
              <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="space-y-1">
                  {fileErrors.map((err, idx) => (
                    <p key={idx} className="text-sm text-destructive flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {err}
                    </p>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFileErrors([]); setPendingFiles([]); }}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                >
                  <X className="h-4 w-4 mr-1" /> Limpar erros e anexos
                </Button>
              </div>
            )}

            {pendingFiles.length < MAX_FILES && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !submitting && fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors text-sm',
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
                  submitting && 'pointer-events-none opacity-60'
                )}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-muted-foreground">Arraste arquivos aqui ou clique para selecionar</span>
                <span className="text-xs text-muted-foreground">PDF, JPG ou PNG</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXT}
                  multiple
                  className="hidden"
                  onChange={e => { if (e.target.files?.length) addPendingFiles(e.target.files); e.target.value = ''; }}
                />
              </div>
            )}

            {/* Counter - sempre visível quando há arquivos */}
            {pendingFiles.length > 0 && (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    {pendingFiles.length}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {pendingFiles.length === 1 ? 'arquivo válido na fila' : 'arquivos válidos na fila'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {isUploadingAttachments 
                    ? `${uploadStates.filter(s => s.status === 'done').length} de ${uploadStates.length} enviados`
                    : 'serão enviados ao submeter'
                  }
                </span>
              </div>
            )}

            {/* Lista de arquivos pendentes (visível quando não está enviando) */}
            {pendingFiles.length > 0 && !isUploadingAttachments && (
              <div className="space-y-2">
                {pendingFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                    {file.type === 'application/pdf'
                      ? <FileText className="h-5 w-5 text-destructive shrink-0" />
                      : <ImageIcon className="h-5 w-5 text-primary shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removePendingFile(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload progress per file */}
            {isUploadingAttachments && uploadStates.length > 0 && (
              <div className="space-y-2">
                {uploadStates.map((state, idx) => (
                  <div key={`upload-${idx}`} className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      {state.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                      {state.status === 'done' && <Check className="h-4 w-4 text-primary shrink-0" />}
                      {state.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                      {state.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{state.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {state.status === 'pending' && 'Aguardando...'}
                          {state.status === 'uploading' && `Enviando... ${state.progress}%`}
                          {state.status === 'done' && 'Concluído'}
                          {state.status === 'error' && (state.error ?? 'Erro no envio')}
                        </p>
                      </div>
                    </div>
                    {state.status === 'uploading' && (
                      <Progress value={state.progress} className="h-1.5" />
                    )}
                  </div>
                ))}
                {/* Barra de progresso geral */}
                {(() => {
                  const done = uploadStates.filter(s => s.status === 'done').length;
                  const total = uploadStates.length;
                  const pct = Math.round((done / total) * 100);
                  return (
                    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Enviando anexos...</span>
                        </div>
                        <span className="font-medium text-foreground">{done}/{total} ({pct}%)</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" size="lg" disabled={submitting} className="gap-2">
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {isUploadingAttachments ? 'Enviando anexos...' : 'Enviando...'}</>
                : <><Send className="h-4 w-4" /> Enviar Solicitação</>}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default SchedulingRequestForm;
