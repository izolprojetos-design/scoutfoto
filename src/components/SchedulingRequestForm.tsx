import { useEffect, useState } from 'react';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';

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
import SchedulingAttachments from '@/components/SchedulingAttachments';

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

const SchedulingRequestForm = ({ onSuccess }: Props) => {
  const { user, profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

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

  useEffect(() => {
    supabase.from('branches').select('id, display_name, icon').order('sort_order')
      .then(({ data }) => setBranches(data ?? []));
  }, []);

  useEffect(() => {
    if (profile?.name && !nomeResponsavel) setNomeResponsavel(profile.name);
    if ((profile?.email || user?.email) && !email) setEmail(profile?.email ?? user?.email ?? '');
  }, [profile, user, nomeResponsavel, email]);

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
    setErrors(e);
    return Object.keys(e).length === 0;
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

    setSubmitting(false);
    setInsertedId(inserted.id);
    setSubmitted(true);
    toast({ title: 'Solicitação enviada!', description: 'Verifique seu e-mail para confirmar a solicitação.' });
    setData(''); setHorario(''); setLocal(''); setBranchId(''); setTipo('reuniao'); setDescricao(''); setDestinatarioEmail('');
    setAttachments([]);
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
              <Label htmlFor="nome">Nome do responsável *</Label>
              <Input id="nome" value={nomeResponsavel} onChange={e => setNomeResponsavel(e.target.value)} placeholder="Seu nome completo" />
              {errors.nomeResponsavel && <p className="text-sm text-destructive">{errors.nomeResponsavel}</p>}
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

          <p className="text-xs text-muted-foreground">Após enviar, você poderá anexar arquivos (PDF, JPG, PNG) na tela de confirmação.</p>

          <div className="flex justify-end pt-2">
            <Button type="submit" size="lg" disabled={submitting} className="gap-2">
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                : <><Send className="h-4 w-4" /> Enviar Solicitação</>}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default SchedulingRequestForm;
