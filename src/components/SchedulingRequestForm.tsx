import { useEffect, useState } from 'react';
import { Loader2, Send, CheckCircle2, User, CalendarDays, FileText, Mail } from 'lucide-react';

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
import { cn } from '@/lib/utils';

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

interface Props {
  onSuccess?: () => void;
}

const SchedulingRequestForm = ({ onSuccess }: Props) => {
  const { user, profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dados pessoais (do usuário logado, somente leitura)
  const [nomeAssociado, setNomeAssociado] = useState('');
  const [secao, setSecao] = useState('');
  const [cargo1, setCargo1] = useState('');
  const [cargo2, setCargo2] = useState('');
  const [emailDe, setEmailDe] = useState('');

  // Dados do destinatário (editáveis)
  const [destNome, setDestNome] = useState('');
  const [destSecao, setDestSecao] = useState('');
  const [destCargo1, setDestCargo1] = useState('');
  const [destCargo2, setDestCargo2] = useState('');
  const [emailPara, setEmailPara] = useState('');

  // Evento
  const [dataSecao, setDataSecao] = useState('');
  const [horario, setHorario] = useState('');
  const [local, setLocal] = useState('');
  const [ramoEscoteiro, setRamoEscoteiro] = useState('');
  const [tipoAtividade, setTipoAtividade] = useState('reuniao');

  // Detalhes
  const [observacoes, setObservacoes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('branches').select('id, key, display_name, icon').order('sort_order')
      .then(({ data }) => setBranches((data as Branch[]) ?? []));
  }, []);

  // Mapeia o cargo do perfil para a key do ramo escoteiro
  const deriveBranchKeyFromCargo = (cargo: string): string => {
    if (!cargo) return 'voluntario';
    if (/Alcateia/i.test(cargo)) return 'lobinho';
    if (/Tropa Escoteira/i.test(cargo)) return 'escoteiro';
    if (/Tropa S[êe]nior/i.test(cargo)) return 'senior';
    if (/Cl[ãa] Pioneiro/i.test(cargo)) return 'pioneiro';
    return 'voluntario';
  };

  useEffect(() => {
    if (profile?.name && !nomeAssociado) setNomeAssociado(profile.name);
    if ((profile?.email || user?.email) && !emailDe) setEmailDe(profile?.email ?? user?.email ?? '');
    if (profile?.section && !secao && !cargo1) {
      const parsed = parseVolunteerSection(profile.section);
      if (parsed.secao) setSecao(parsed.secao);
      if (parsed.cargo1) setCargo1(parsed.cargo1);
      if (parsed.cargo2) setCargo2(parsed.cargo2);
    }
  }, [profile, user, nomeAssociado, emailDe, secao, cargo1]);

  // Auto-preenche o ramo escoteiro a partir do cargo1, quando os ramos carregarem
  useEffect(() => {
    if (!ramoEscoteiro && cargo1 && branches.length > 0) {
      const targetKey = deriveBranchKeyFromCargo(cargo1);
      const match = branches.find(b => b.key === targetKey);
      if (match) setRamoEscoteiro(match.id);
    }
  }, [cargo1, branches, ramoEscoteiro]);

  const resetForm = () => {
    setDataSecao(''); setHorario(''); setLocal(''); setRamoEscoteiro('');
    setTipoAtividade('reuniao'); setObservacoes('');
    setDestNome(''); setDestSecao(''); setDestCargo1(''); setDestCargo2(''); setEmailPara('');
    setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    if (nomeAssociado.trim().length < 2) e.nomeAssociado = 'Informe o nome completo do associado';
    if (!secao) e.secao = 'Selecione a seção';
    if (!cargo1) e.cargo1 = 'Selecione o cargo principal';
    if (!emailRegex.test(emailDe.trim())) e.emailDe = 'E-mail inválido';

    // Destinatário
    if (destNome.trim().length < 2) e.destNome = 'Informe o nome do destinatário';
    if (!destSecao) e.destSecao = 'Selecione a seção do destinatário';
    if (!destCargo1) e.destCargo1 = 'Selecione o cargo do destinatário';
    if (!emailRegex.test(emailPara.trim())) e.emailPara = 'E-mail do destinatário inválido';

    if (!dataSecao) {
      e.dataSecao = 'Selecione a data da seção';
    } else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [y, m, d] = dataSecao.split('-').map(Number);
      const sel = new Date(y, m - 1, d);
      if (sel < today) e.dataSecao = 'A data não pode ser no passado';
    }

    if (!/^\d{2}:\d{2}$/.test(horario)) e.horario = 'Informe um horário válido (HH:MM)';
    if (local.trim().length < 2) e.local = 'Informe o local';
    if (!ramoEscoteiro) e.ramoEscoteiro = 'Selecione o ramo escoteiro';
    if (!tipoAtividade) e.tipoAtividade = 'Selecione o tipo de atividade';
    if (observacoes.trim().length < 5) e.observacoes = 'As observações são obrigatórias (mín. 5 caracteres)';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user) return;
    if (!validate()) {
      toast({ title: 'Verifique os campos', description: 'Há campos obrigatórios pendentes.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const { data: inserted, error } = await supabase
      .from('agendamentos')
      .insert({
        user_id: user.id,
        nome_associado: nomeAssociado.trim(),
        secao,
        dirigente: nomeAssociado.trim(),
        cargo_1: cargo1,
        cargo_2: cargo2,
        email_de: emailDe.trim(),
        email_para: emailPara.trim(),
        data_secao: dataSecao,
        horario,
        local: local.trim(),
        ramo_escoteiro: ramoEscoteiro,
        tipo_atividade: tipoAtividade,
        observacoes: observacoes.trim(),
        status: 'confirmado',
      })
      .select('id')
      .single();

    if (error) {
      setSubmitting(false);
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }

    // Envio de e-mail (não bloqueia o fluxo principal)
    const tipoLabel = SCHEDULING_TYPES.find(t => t.value === tipoAtividade)?.label ?? tipoAtividade;
    const ramoLabel = branches.find(b => b.id === ramoEscoteiro)
      ? `${branches.find(b => b.id === ramoEscoteiro)!.icon} ${branches.find(b => b.id === ramoEscoteiro)!.display_name}`
      : ramoEscoteiro;
    const dataFormatada = (() => {
      const [y, m, d] = dataSecao.split('-').map(Number);
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    })();

    const templateData = {
      nomeAssociado: nomeAssociado.trim(),
      secao,
      dirigente: nomeAssociado.trim(),
      cargo1,
      cargo2,
      data: dataFormatada,
      horario,
      local: local.trim(),
      ramo: ramoLabel,
      tipoAtividade: tipoLabel,
      observacoes: observacoes.trim(),
      emailDe: emailDe.trim(),
      destinatarioNome: destNome.trim(),
      destinatarioSecao: destSecao,
      destinatarioCargo1: destCargo1,
      destinatarioCargo2: destCargo2,
      emailPara: emailPara.trim(),
    };

    const recipients: string[] = [];
    if (emailPara.trim()) recipients.push(emailPara.trim());

    let emailOk = true;
    try {
      await Promise.all(
        recipients.map((to, idx) =>
          supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'agendamento-notificacao',
              recipientEmail: to,
              idempotencyKey: `agendamento-${inserted?.id}-${idx}`,
              templateData,
            },
          }),
        ),
      );
    } catch (err) {
      console.error('Falha no envio do e-mail de agendamento', err);
      emailOk = false;
    }

    setSubmitting(false);

    if (emailOk) {
      toast({
        title: 'Agendamento criado e e-mail enviado',
        description: 'O agendamento foi confirmado e a notificação foi enviada aos contatos.',
      });
    } else {
      toast({
        title: 'Agendamento criado, mas falha no envio do e-mail',
        description: 'Seu agendamento foi salvo, porém não conseguimos enviar a notificação por e-mail.',
        variant: 'destructive',
      });
    }

    setSubmitted(true);
    resetForm();
    onSuccess?.();
  };

  if (submitted) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <AlertTitle>Agendamento registrado com sucesso</AlertTitle>
          <AlertDescription className="mt-1">
            Seu agendamento foi salvo com status <strong>Confirmado</strong>.
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={() => setSubmitted(false)} variant="default">
            Criar novo agendamento
          </Button>
        </div>
      </div>
    );
  }

  const fieldError = (key: string) => errors[key] && (
    <p className="text-xs text-destructive mt-1" role="alert">{errors[key]}</p>
  );

  const errCls = (key: string) => errors[key] ? 'border-destructive focus-visible:ring-destructive' : '';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto" noValidate>
      {/* Seção 1: Dados Pessoais */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Dados Pessoais</CardTitle>
              <CardDescription>Identificação do solicitante e contatos</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="nomeAssociado">Nome do associado <span className="text-destructive">*</span></Label>
            <Input
              id="nomeAssociado"
              value={nomeAssociado}
              onChange={(e) => setNomeAssociado(e.target.value)}
              placeholder="Nome completo"
              className={cn('mt-1.5', errCls('nomeAssociado'))}
              aria-invalid={!!errors.nomeAssociado}
            />
            {fieldError('nomeAssociado')}
          </div>

          <div>
            <Label htmlFor="secao">Seção <span className="text-destructive">*</span></Label>
            <select
              id="secao"
              value={secao}
              onChange={(e) => setSecao(e.target.value)}
              className={cn(
                'mt-1.5 flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                errCls('secao'),
              )}
              aria-invalid={!!errors.secao}
            >
              <option value="">Selecione...</option>
              {VOLUNTEER_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {fieldError('secao')}
          </div>

          <div>
            <Label htmlFor="cargo1">Cargo 1 <span className="text-destructive">*</span></Label>
            <select
              id="cargo1"
              value={cargo1}
              onChange={(e) => setCargo1(e.target.value)}
              className={cn(
                'mt-1.5 flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-h-[300px]',
                errCls('cargo1'),
              )}
              aria-invalid={!!errors.cargo1}
            >
              <option value="">Selecione...</option>
              {Object.entries(VOLUNTEER_CARGO_CATEGORIES).map(([cat, list]) => (
                <optgroup key={cat} label={cat}>
                  {list.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              ))}
            </select>
            {fieldError('cargo1')}
          </div>

          <div>
            <Label htmlFor="cargo2">Cargo 2 <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <select
              id="cargo2"
              value={cargo2}
              onChange={(e) => setCargo2(e.target.value)}
              className="mt-1.5 flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-h-[300px]"
            >
              <option value="">Nenhum</option>
              {Object.entries(VOLUNTEER_CARGO_CATEGORIES).map(([cat, list]) => (
                <optgroup key={cat} label={cat}>
                  {list.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="emailDe">E-mail de <span className="text-destructive">*</span></Label>
            <Input
              id="emailDe"
              type="email"
              value={emailDe}
              onChange={(e) => setEmailDe(e.target.value)}
              placeholder="seu@email.com"
              className={cn('mt-1.5', errCls('emailDe'))}
              aria-invalid={!!errors.emailDe}
            />
            {fieldError('emailDe')}
          </div>
        </CardContent>
      </Card>

      {/* Seção 2: Evento */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Evento</CardTitle>
              <CardDescription>Quando, onde e o tipo de atividade</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dataSecao">Data da seção <span className="text-destructive">*</span></Label>
            <Input
              id="dataSecao"
              type="date"
              value={dataSecao}
              onChange={(e) => setDataSecao(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className={cn('mt-1.5', errCls('dataSecao'))}
              aria-invalid={!!errors.dataSecao}
            />
            {fieldError('dataSecao')}
          </div>

          <div>
            <Label htmlFor="horario">Horário <span className="text-destructive">*</span></Label>
            <Input
              id="horario"
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className={cn('mt-1.5', errCls('horario'))}
              aria-invalid={!!errors.horario}
            />
            {fieldError('horario')}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="local">Local <span className="text-destructive">*</span></Label>
            <Input
              id="local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex: Sede do Grupo Escoteiro"
              className={cn('mt-1.5', errCls('local'))}
              aria-invalid={!!errors.local}
            />
            {fieldError('local')}
          </div>

          <div>
            <Label htmlFor="ramoEscoteiro">Ramo escoteiro <span className="text-destructive">*</span></Label>
            <select
              id="ramoEscoteiro"
              value={ramoEscoteiro}
              onChange={(e) => setRamoEscoteiro(e.target.value)}
              className={cn(
                'mt-1.5 flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                errCls('ramoEscoteiro'),
              )}
              aria-invalid={!!errors.ramoEscoteiro}
            >
              <option value="">Selecione...</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.icon} {b.display_name}</option>
              ))}
            </select>
            {fieldError('ramoEscoteiro')}
          </div>

          <div>
            <Label htmlFor="tipoAtividade">Tipo de atividade <span className="text-destructive">*</span></Label>
            <select
              id="tipoAtividade"
              value={tipoAtividade}
              onChange={(e) => setTipoAtividade(e.target.value)}
              className={cn(
                'mt-1.5 flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                errCls('tipoAtividade'),
              )}
              aria-invalid={!!errors.tipoAtividade}
            >
              {SCHEDULING_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {fieldError('tipoAtividade')}
          </div>
        </CardContent>
      </Card>

      {/* Seção 3: Detalhes */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Detalhes</CardTitle>
              <CardDescription>Observações adicionais sobre o agendamento</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Label htmlFor="observacoes">Observações <span className="text-destructive">*</span></Label>
          <Textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Descreva detalhes importantes do agendamento..."
            rows={5}
            className={cn('mt-1.5 resize-y', errCls('observacoes'))}
            aria-invalid={!!errors.observacoes}
          />
          {fieldError('observacoes')}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
          Limpar formulário
        </Button>
        <Button type="submit" disabled={submitting} className="gap-2 sm:min-w-[200px]">
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
          ) : (
            <><Send className="h-4 w-4" /> Criar agendamento</>
          )}
        </Button>
      </div>
    </form>
  );
};

export default SchedulingRequestForm;
