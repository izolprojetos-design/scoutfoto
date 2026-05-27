import { useEffect, useRef, useState } from 'react';
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
  const { user, profile, hasRole } = useAuth();
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
  const [nomeEvento, setNomeEvento] = useState('');
  const [dataSecao, setDataSecao] = useState('');
  const [horario, setHorario] = useState('');
  const [local, setLocal] = useState('');
  const [ramoEscoteiro, setRamoEscoteiro] = useState('');
  const [tipoAtividade, setTipoAtividade] = useState('reuniao');

  // Detalhes
  const [observacoes, setObservacoes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Autocomplete do destinatário
  type DestSuggestion = { user_id: string; name: string; email: string; section: string | null };
  const [destSuggestions, setDestSuggestions] = useState<DestSuggestion[]>([]);
  const [destSearching, setDestSearching] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const destSearchTimeout = useRef<number | null>(null);
  const destBlurTimeout = useRef<number | null>(null);

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
    setNomeEvento('');
    setDataSecao(''); setHorario(''); setLocal(''); setRamoEscoteiro('');
    setTipoAtividade('reuniao'); setObservacoes('');
    setDestNome(''); setDestSecao(''); setDestCargo1(''); setDestCargo2(''); setEmailPara('');
    setDestSuggestions([]); setDestDropdownOpen(false);
    setErrors({});
  };

  // Busca usuários no banco para sugerir destinatário (com debounce)
  const handleDestNomeChange = (value: string) => {
    setDestNome(value);
    setDestDropdownOpen(true);

    if (destSearchTimeout.current) window.clearTimeout(destSearchTimeout.current);

    const q = value.trim();
    if (q.length < 2) {
      setDestSuggestions([]);
      setDestSearching(false);
      return;
    }

    setDestSearching(true);
    destSearchTimeout.current = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_users_for_scheduling', { p_query: q });
      if (!error && Array.isArray(data)) {
        setDestSuggestions(data as DestSuggestion[]);
      } else {
        setDestSuggestions([]);
      }
      setDestSearching(false);
    }, 250);
  };

  const handleSelectDestSuggestion = (s: DestSuggestion) => {
    setDestNome(s.name ?? '');
    setEmailPara(s.email ?? '');
    if (s.section) {
      const parsed = parseVolunteerSection(s.section);
      if (parsed.secao) setDestSecao(parsed.secao);
      if (parsed.cargo1) setDestCargo1(parsed.cargo1);
      if (parsed.cargo2) setDestCargo2(parsed.cargo2);
    }
    setDestSuggestions([]);
    setDestDropdownOpen(false);
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

    const nomeEventoTrim = nomeEvento.trim();
    if (!nomeEventoTrim) {
      e.nomeEvento = 'O nome do evento é obrigatório.';
    } else if (nomeEventoTrim.length < 3) {
      e.nomeEvento = 'O nome do evento deve ter pelo menos 3 caracteres.';
    } else if (nomeEventoTrim.length > 120) {
      e.nomeEvento = 'O nome do evento deve ter no máximo 120 caracteres.';
    }
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
    
    // Check role before submitting
    const canCreate = hasRole('admin') || hasRole('voluntario');
    if (!canCreate) {
      toast({ 
        title: 'Permissão negada', 
        description: 'Seu usuário não possui permissão para criar agendamentos (necessário ser Administrador ou Voluntário).', 
        variant: 'destructive' 
      });
      return;
    }

    if (!validate()) {
      const firstError = Object.values(errors)[0] || 'Há campos obrigatórios pendentes.';
      toast({ title: 'Verifique os campos', description: firstError, variant: 'destructive' });
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
        destinatario_nome: destNome.trim(),
        destinatario_secao: destSecao,
        destinatario_cargo_1: destCargo1,
        destinatario_cargo_2: destCargo2,
        data_secao: dataSecao,
        horario,
        local: local.trim(),
        ramo_escoteiro: ramoEscoteiro,
        tipo_atividade: tipoAtividade,
        nome_evento: nomeEvento.trim(),
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
      nomeEvento: nomeEvento.trim(),
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
      console.error('Falha no envio do e-mail de mensagem', err);
      emailOk = false;
    }

    setSubmitting(false);

    if (emailOk) {
      toast({
        title: 'Mensagem criada e e-mail enviado',
        description: 'A mensagem foi confirmada e a notificação foi enviada aos contatos.',
      });
    } else {
      toast({
        title: 'Mensagem criada, mas falha no envio do e-mail',
        description: 'Sua mensagem foi salva, porém não conseguimos enviar a notificação por e-mail.',
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
          <AlertTitle>Mensagem registrada com sucesso</AlertTitle>
          <AlertDescription className="mt-1">
            Sua mensagem foi salva com status <strong>Confirmado</strong>.
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={() => setSubmitted(false)} variant="default">
            Criar nova mensagem
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
      {/* Seção 1: Dados Pessoais (somente leitura - usuário logado) */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Dados Pessoais</CardTitle>
              <CardDescription>Identificação do solicitante (carregado do seu perfil)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="nomeAssociado">Nome do associado</Label>
            <Input
              id="nomeAssociado"
              value={nomeAssociado}
              onChange={(e) => setNomeAssociado(e.target.value)}
              className={cn("mt-1.5", errCls('nomeAssociado'))}
              placeholder="Informe seu nome completo"
            />
          </div>

          <div>
            <Label htmlFor="secao">Seção</Label>
            <select
              id="secao"
              value={secao}
              onChange={(e) => setSecao(e.target.value)}
              className={cn(
                'mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                errCls('secao')
              )}
            >
              <option value="">Selecione...</option>
              {VOLUNTEER_SECTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="cargo1">Cargo 1</Label>
            <select
              id="cargo1"
              value={cargo1}
              onChange={(e) => setCargo1(e.target.value)}
              className={cn(
                'mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                errCls('cargo1')
              )}
            >
              <option value="">Selecione...</option>
              {Object.entries(VOLUNTEER_CARGO_CATEGORIES).map(([cat, list]) => (
                <optgroup key={cat} label={cat}>
                  {list.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="cargo2">Cargo 2 <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <select
              id="cargo2"
              value={cargo2}
              onChange={(e) => setCargo2(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Nenhum</option>
              {Object.entries(VOLUNTEER_CARGO_CATEGORIES).map(([cat, list]) => (
                <optgroup key={cat} label={cat}>
                  {list.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="emailDe">E-mail de</Label>
            <Input
              id="emailDe"
              type="email"
              value={emailDe}
              onChange={(e) => setEmailDe(e.target.value)}
              className={cn("mt-1.5", errCls('emailDe'))}
              placeholder="seu-email@exemplo.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Seção 1b: Dados do Destinatário (editáveis) */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Dados do Destinatário</CardTitle>
              <CardDescription>Para quem esta mensagem será enviada</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 relative">
            <Label htmlFor="destNome">Nome do destinatário <span className="text-destructive">*</span></Label>
            <div className="relative mt-1.5">
              <Input
                id="destNome"
                value={destNome}
                onChange={(e) => handleDestNomeChange(e.target.value)}
                onFocus={() => { if (destSuggestions.length > 0) setDestDropdownOpen(true); }}
                onBlur={() => {
                  if (destBlurTimeout.current) window.clearTimeout(destBlurTimeout.current);
                  destBlurTimeout.current = window.setTimeout(() => setDestDropdownOpen(false), 150);
                }}
                placeholder="Digite o nome para buscar usuários cadastrados"
                autoComplete="off"
                className={cn(errCls('destNome'))}
                aria-invalid={!!errors.destNome}
                aria-autocomplete="list"
                aria-expanded={destDropdownOpen}
              />
              {destSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {destDropdownOpen && destNome.trim().length >= 2 && (destSuggestions.length > 0 || (!destSearching && destSuggestions.length === 0)) && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-y-auto">
                  {destSuggestions.length === 0 && !destSearching ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum usuário encontrado</div>
                  ) : (
                    destSuggestions.map((s) => (
                      <button
                        key={s.user_id}
                        type="button"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => handleSelectDestSuggestion(s)}
                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground border-b last:border-b-0"
                      >
                        <div className="text-sm font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.email}{s.section ? ` • ${s.section}` : ''}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {fieldError('destNome')}
          </div>


          <div>
            <Label htmlFor="destSecao">Seção <span className="text-destructive">*</span></Label>
            <select
              id="destSecao"
              value={destSecao}
              onChange={(e) => setDestSecao(e.target.value)}
              className={cn(
                'mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                errCls('destSecao')
              )}
              aria-invalid={!!errors.destSecao}
            >
              <option value="">Selecione...</option>
              {VOLUNTEER_SECTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {fieldError('destSecao')}
          </div>

          <div>
            <Label htmlFor="destCargo1">Cargo 1 <span className="text-destructive">*</span></Label>
            <select
              id="destCargo1"
              value={destCargo1}
              onChange={(e) => setDestCargo1(e.target.value)}
              className={cn(
                'mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                errCls('destCargo1')
              )}
              aria-invalid={!!errors.destCargo1}
            >
              <option value="">Selecione...</option>
              {Object.entries(VOLUNTEER_CARGO_CATEGORIES).map(([cat, list]) => (
                <optgroup key={cat} label={cat}>
                  {list.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {fieldError('destCargo1')}
          </div>

          <div>
            <Label htmlFor="destCargo2">Cargo 2 <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <select
              id="destCargo2"
              value={destCargo2}
              onChange={(e) => setDestCargo2(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Nenhum</option>
              {Object.entries(VOLUNTEER_CARGO_CATEGORIES).map(([cat, list]) => (
                <optgroup key={cat} label={cat}>
                  {list.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="emailPara">E-mail do destinatário <span className="text-destructive">*</span></Label>
            <Input
              id="emailPara"
              type="email"
              value={emailPara}
              onChange={(e) => setEmailPara(e.target.value)}
              placeholder="email-do-destinatario@exemplo.com"
              className={cn('mt-1.5', errCls('emailPara'))}
              aria-invalid={!!errors.emailPara}
            />
            {fieldError('emailPara')}
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
          <div className="md:col-span-2">
            <Label htmlFor="nomeEvento">Nome do evento <span className="text-destructive">*</span></Label>
            <Input
              id="nomeEvento"
              value={nomeEvento}
              onChange={(e) => setNomeEvento(e.target.value.slice(0, 120))}
              placeholder="Ex: Reunião ordinária da Alcateia"
              required
              maxLength={120}
              className={cn('mt-1.5', errCls('nomeEvento'))}
              aria-invalid={!!errors.nomeEvento}
              aria-describedby="nomeEvento-counter"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex-1">{fieldError('nomeEvento')}</div>
              <span
                id="nomeEvento-counter"
                className={cn(
                  'text-xs tabular-nums',
                  nomeEvento.trim().length > 120 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {nomeEvento.trim().length}/120
              </span>
            </div>
          </div>

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
            <><Send className="h-4 w-4" /> Criar mensagem</>
          )}
        </Button>
      </div>
    </form>
  );
};

export default SchedulingRequestForm;
