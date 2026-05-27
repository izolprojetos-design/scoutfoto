import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, CheckCircle2, User, CalendarDays, FileText, Mail } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { SCHEDULING_TYPES } from '@/lib/schedulingTypes';
import { VOLUNTEER_SECTIONS, VOLUNTEER_CARGOS, VOLUNTEER_CARGO_CATEGORIES, CARGO_2_OPTIONS, parseVolunteerSection } from '@/lib/sectionOptions';

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

  // Dados do remetente (do usuário logado, somente leitura)
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

    if (nomeAssociado.trim().length < 2) e.nomeAssociado = 'Informe o seu nome completo';
    if (!secao) e.secao = 'Selecione a sua seção';
    if (!cargo1) e.cargo1 = 'Selecione o seu cargo principal';
    if (!emailRegex.test(emailDe.trim())) e.emailDe = 'Seu e-mail é inválido';

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

    if (!horario) {
      e.horario = 'Informe o horário';
    } else if (!/^\d{2}:\d{2}(:\d{2})?$/.test(horario)) {
      e.horario = 'Informe um horário válido (HH:MM)';
    }

    if (local.trim().length < 2) e.local = 'Informe o local';
    if (!ramoEscoteiro) e.ramoEscoteiro = 'Selecione o ramo escoteiro';
    if (!tipoAtividade) e.tipoAtividade = 'Selecione o tipo de atividade';
    if (observacoes.trim().length < 5) e.observacoes = 'As observações são obrigatórias (mín. 5 caracteres)';

    setErrors(e);
    return e;
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

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast({ 
        title: 'Verifique os campos', 
        description: firstError, 
        variant: 'destructive' 
      });
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
        cargo_2: cargo2 || '',
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
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200" noValidate>
      {/* Cabeçalho estilo Gmail */}
      <div className="bg-[#f2f6fc] px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">Nova mensagem</span>
      </div>

      <div className="flex flex-col">
        {/* Campo De */}
        <div className="flex items-center px-4 py-2 border-b border-gray-100 group bg-gray-50/30">
          <span className="text-sm text-gray-700 font-medium w-12">De</span>
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <span className="text-sm font-semibold text-gray-900 truncate">{nomeAssociado}</span>
            <span className="text-sm text-gray-600 truncate">&lt;{emailDe}&gt;</span>
          </div>
          <div className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium border border-blue-200">
            {secao} • {cargo1}
          </div>
        </div>

        {/* Campo Para */}
        <div className="flex flex-col px-4 py-2 border-b border-gray-100 relative group">
          <div className="flex items-center">
            <span className="text-sm text-gray-700 font-medium w-12">Para</span>
            <div className="flex-1 relative">
              <input
                id="destNome"
                value={destNome}
                onChange={(e) => handleDestNomeChange(e.target.value)}
                onFocus={() => { if (destSuggestions.length > 0) setDestDropdownOpen(true); }}
                onBlur={() => {
                  if (destBlurTimeout.current) window.clearTimeout(destBlurTimeout.current);
                  destBlurTimeout.current = window.setTimeout(() => setDestDropdownOpen(false), 150);
                }}
                placeholder="Destinatário"
                autoComplete="off"
                className={cn(
                  "w-full text-sm text-gray-900 font-semibold bg-transparent border-none focus:ring-0 p-0 placeholder:text-gray-400",
                  errCls('destNome')
                )}
              />
            </div>
            {destSearching && <Loader2 className="h-4 w-4 animate-spin text-gray-600" />}
          </div>
          
          {destDropdownOpen && destNome.trim().length >= 2 && (destSuggestions.length > 0 || (!destSearching && destSuggestions.length === 0)) && (
            <div className="absolute left-16 right-4 top-full z-50 mt-1 rounded-md border bg-white shadow-xl max-h-60 overflow-y-auto">
              {destSuggestions.length === 0 && !destSearching ? (
                <div className="px-3 py-2 text-sm text-gray-500">Nenhum usuário encontrado</div>
              ) : (
                destSuggestions.map((s) => (
                  <button
                    key={s.user_id}
                    type="button"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => handleSelectDestSuggestion(s)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.email}{s.section ? ` • ${s.section}` : ''}</div>
                  </button>
                ))
              )}
            </div>
          )}
          {fieldError('destNome')}
        </div>

        {/* Assunto (Nome do Evento) */}
        <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-white">
          <input
            id="nomeEvento"
            value={nomeEvento}
            onChange={(e) => setNomeEvento(e.target.value.slice(0, 120))}
            placeholder="Assunto"
            className={cn(
              "w-full text-base text-black bg-transparent border-none focus:ring-0 p-0 placeholder:text-gray-500 font-bold",
              errCls('nomeEvento')
            )}
          />
          <span className="text-xs text-gray-600 ml-2 font-semibold">{nomeEvento.length}/120</span>
        </div>

        {/* Detalhes da Atividade */}
        <div className="bg-white px-4 py-4 border-b border-gray-200 flex flex-wrap gap-4">
          <div className="flex items-center gap-2 min-w-[150px]">
            <CalendarDays className="h-4 w-4 text-gray-700" />
            <input
              type="date"
              value={dataSecao}
              onChange={(e) => setDataSecao(e.target.value)}
              className={cn("text-sm font-bold text-gray-900 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none", errCls('dataSecao'))}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className={cn("text-sm font-bold text-gray-900 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none", errCls('horario'))}
            />
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[250px]">
            <Input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Local da atividade"
              className={cn("h-9 text-sm font-bold text-gray-900 bg-white border-gray-300 placeholder:text-gray-500", errCls('local'))}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={ramoEscoteiro}
              onChange={(e) => setRamoEscoteiro(e.target.value)}
              className={cn("text-sm font-bold text-gray-900 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none h-9", errCls('ramoEscoteiro'))}
            >
              <option value="">Ramo...</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.icon} {b.display_name}</option>
              ))}
            </select>
            <select
              value={tipoAtividade}
              onChange={(e) => setTipoAtividade(e.target.value)}
              className="text-sm font-bold text-gray-900 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none h-9"
            >
              {SCHEDULING_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Corpo da Mensagem */}
        <div className="px-4 py-4 min-h-[300px] flex flex-col">
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Escreva sua mensagem aqui..."
            className={cn(
              "flex-1 w-full text-base text-gray-900 bg-transparent border-none focus:ring-0 p-0 resize-none placeholder:text-gray-500 leading-relaxed font-semibold",
              errCls('observacoes')
            )}
          />
        </div>

        {/* Rodapé de Ações */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Button 
              type="submit" 
              disabled={submitting} 
              className="bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-full px-6 py-2 h-9 text-sm font-medium transition-shadow hover:shadow-md"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
              ) : (
                <>Enviar</>
              )}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={resetForm} 
              disabled={submitting}
              className="text-gray-500 hover:bg-gray-100 rounded-full h-9 w-9"
              title="Descartar rascunho"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-600 font-bold italic">
            <CheckCircle2 className="h-4 w-4" />
            Salvo automaticamente no sistema
          </div>
        </div>
      </div>
      
      {/* Exibição de erros flutuante ou discreta */}
      {Object.keys(errors).length > 0 && (
        <div className="px-4 py-1 bg-red-50 text-[10px] text-red-500 border-t border-red-100">
          Por favor, preencha todos os campos obrigatórios marcados em vermelho.
        </div>
      )}
    </form>
  );
};

export default SchedulingRequestForm;
