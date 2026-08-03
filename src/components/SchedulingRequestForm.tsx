import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, CheckCircle2, User, CalendarDays, FileText, Mail, Clock, MapPin, Tag, Compass, X } from 'lucide-react';

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

  // Lista de destinatários selecionados
  const [destinatarios, setDestinatarios] = useState<DestSuggestion[]>([]);
  const [destNomeInput, setDestNomeInput] = useState('');

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
    setDestinatarios([]);
    setDestNomeInput('');
    setDestSuggestions([]); setDestDropdownOpen(false);
    setErrors({});
  };

  // Busca usuários no banco para sugerir destinatário (com debounce)
  const handleDestNomeChange = (value: string) => {
    setDestNomeInput(value);
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
        // Filtra os que já estão na lista
        const filtered = (data as DestSuggestion[]).filter(
          s => !destinatarios.some(d => d.user_id === s.user_id)
        );
        setDestSuggestions(filtered);
      } else {
        setDestSuggestions([]);
      }
      setDestSearching(false);
    }, 250);
  };

  const handleSelectDestSuggestion = (s: DestSuggestion) => {
    setDestinatarios(prev => [...prev, s]);
    setDestNomeInput('');
    setDestSuggestions([]);
    setDestDropdownOpen(false);
  };

  const removeDestinatario = (userId: string) => {
    setDestinatarios(prev => prev.filter(d => d.user_id !== userId));
  };


  const validate = () => {
    const e: Record<string, string> = {};
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    if (nomeAssociado.trim().length < 2) e.nomeAssociado = 'Informe o seu nome completo';
    if (!secao) e.secao = 'Selecione a sua seção';
    if (!cargo1) e.cargo1 = 'Selecione o seu cargo principal';
    if (!emailRegex.test(emailDe.trim())) e.emailDe = 'Seu e-mail é inválido';

    // Destinatário
    if (destinatarios.length === 0) e.destinatarios = 'Selecione pelo menos um destinatário';

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
    
    const insertPromises = destinatarios.map(dest => {
      const parsed = dest.section ? parseVolunteerSection(dest.section) : { secao: '', cargo1: '', cargo2: '' };
      return supabase
        .from('agendamentos')
        .insert({
          user_id: user.id,
          nome_associado: nomeAssociado.trim(),
          secao,
          dirigente: nomeAssociado.trim(),
          cargo_1: cargo1,
          cargo_2: cargo2 || '',
          email_de: emailDe.trim(),
          email_para: dest.email.trim(),
          destinatario_nome: dest.name.trim(),
          destinatario_secao: parsed.secao,
          destinatario_cargo_1: parsed.cargo1,
          destinatario_cargo_2: parsed.cargo2,
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
    });

    const results = await Promise.all(insertPromises);
    const errorsList = results.filter(r => r.error);

    if (errorsList.length > 0) {
      setSubmitting(false);
      toast({ title: 'Erro ao salvar algumas mensagens', description: errorsList[0].error?.message, variant: 'destructive' });
      return;
    }

    // Envio de e-mail (não bloqueia o fluxo principal)
    const dataFormatada = (() => {
      const [y, m, d] = dataSecao.split('-').map(Number);
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    })();

    const tipoLabel = SCHEDULING_TYPES.find(t => t.value === tipoAtividade)?.label ?? tipoAtividade;
    const ramoLabel = branches.find(b => b.id === ramoEscoteiro)
      ? `${branches.find(b => b.id === ramoEscoteiro)!.icon} ${branches.find(b => b.id === ramoEscoteiro)!.display_name}`
      : ramoEscoteiro;

    let emailOk = true;
    try {
      const emailPromises = destinatarios.map((dest, idx) => {
        const parsed = dest.section ? parseVolunteerSection(dest.section) : { secao: '', cargo1: '', cargo2: '' };
        const insertedId = results[idx].data?.id;
        
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
          destinatarioNome: dest.name.trim(),
          destinatarioSecao: parsed.secao,
          destinatarioCargo1: parsed.cargo1,
          destinatarioCargo2: parsed.cargo2,
          emailPara: dest.email.trim(),
        };

        return supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'agendamento-notificacao',
            recipientEmail: dest.email.trim(),
            idempotencyKey: `agendamento-${insertedId}-${idx}`,
            templateData,
          },
        });
      });

      await Promise.all(emailPromises);
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
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 my-4 sm:my-8 flex flex-col animate-in fade-in zoom-in duration-300" noValidate>
      {/* Cabeçalho estilo Gmail */}
      <div className="bg-[#f2f6fc] px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">Nova mensagem</span>
      </div>

      <div className="flex flex-col">
        {/* Campo De */}
        <div className="flex flex-col sm:flex-row sm:items-center px-4 py-2 border-b border-gray-100 group bg-gray-50/30 gap-1 sm:gap-2">
          <span className="text-xs text-gray-500 font-medium w-10 shrink-0">De</span>
          <div className="flex-1 flex flex-wrap items-center gap-2 overflow-hidden">
            <span className="text-sm font-semibold text-gray-900 truncate">{nomeAssociado}</span>
            <span className="text-xs text-gray-500 truncate">&lt;{emailDe}&gt;</span>
            <div className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium border border-blue-200">
              {secao} • {cargo1}
            </div>
          </div>
        </div>

        {/* Campo Para */}
        <div className="flex flex-col sm:flex-row sm:items-start px-4 py-2 border-b border-gray-100 relative group gap-1 sm:gap-2 bg-white min-h-[42px]">
          <span className="text-xs text-gray-500 font-medium w-10 shrink-0 mt-2">Para</span>
          <div className="flex-1 flex flex-wrap gap-2 items-center">
            {destinatarios.map(dest => (
              <div key={dest.user_id} className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full pl-2 pr-1 py-0.5 group/tag hover:bg-gray-200 transition-colors">
                <span className="text-xs font-semibold text-gray-700">{dest.name}</span>
                <button 
                  type="button" 
                  onClick={() => removeDestinatario(dest.user_id)}
                  className="rounded-full p-0.5 hover:bg-gray-300 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex-1 relative min-w-[120px]">
              <input
                id="destNome"
                value={destNomeInput}
                onChange={(e) => handleDestNomeChange(e.target.value)}
                onFocus={() => { if (destSuggestions.length > 0) setDestDropdownOpen(true); }}
                onBlur={() => {
                  if (destBlurTimeout.current) window.clearTimeout(destBlurTimeout.current);
                  destBlurTimeout.current = window.setTimeout(() => setDestDropdownOpen(false), 150);
                }}
                placeholder={destinatarios.length === 0 ? "Destinatários" : ""}
                autoComplete="off"
                className={cn(
                  "w-full text-sm text-gray-900 font-semibold bg-transparent border-none focus:ring-0 p-0 placeholder:text-gray-400 py-1.5",
                  errCls('destinatarios')
                )}
              />
              
              {destDropdownOpen && destNomeInput.trim().length >= 2 && (destSuggestions.length > 0 || (!destSearching && destSuggestions.length === 0)) && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-white shadow-xl max-h-60 overflow-y-auto">
                  {destSuggestions.length === 0 && !destSearching ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Nenhum usuário encontrado</div>
                  ) : (
                    destSuggestions.map((s) => (
                      <button
                        key={s.user_id}
                        type="button"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => handleSelectDestSuggestion(s)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-500">{s.email}{s.section ? ` • ${s.section}` : ''}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          {destSearching && <Loader2 className="h-4 w-4 animate-spin text-gray-600 mt-2" />}
          {fieldError('destinatarios')}
        </div>

        {/* Assunto / Evento (Nome do Evento) */}
        <div className="px-4 pt-3 pb-1 bg-white">
          <Label htmlFor="nomeEvento" className="text-xs font-bold text-gray-600 uppercase tracking-tight">
            Assunto / Evento
          </Label>
        </div>
        <div className="flex items-center px-4 py-2 border-b border-gray-100 bg-white">
          <input
            id="nomeEvento"
            value={nomeEvento}
            onChange={(e) => setNomeEvento(e.target.value.slice(0, 120))}
            placeholder="Assunto"
            className={cn(
              "flex-1 text-base text-black bg-white border-none focus:ring-0 p-0 placeholder:text-gray-500 font-bold",
              errCls('nomeEvento')
            )}
          />
          <span className="text-xs text-gray-400 ml-2 shrink-0">{nomeEvento.length}/120</span>
        </div>

        {/* Grid de Detalhes da Atividade */}
        <div className="bg-white px-4 py-4 border-b border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="dataSecao" className="text-xs font-bold text-gray-600 uppercase tracking-tight">
                Data
              </Label>
              <div className="relative group">
                <input
                  id="dataSecao"
                  type="date"
                  value={dataSecao}
                  onChange={(e) => setDataSecao(e.target.value)}
                  className={cn("h-9 text-sm font-semibold text-black bg-white border border-gray-300 rounded-md px-3 pr-9 focus:ring-2 focus:ring-blue-500 outline-none w-full appearance-none transition-all", errCls('dataSecao'))}
                />
                <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-auto cursor-pointer hover:text-blue-600 transition-colors" onClick={() => (document.getElementById('dataSecao') as any)?.showPicker()} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="horario" className="text-xs font-bold text-gray-600 uppercase tracking-tight">Horário</Label>
              <div className="relative group">
                <input
                  id="horario"
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className={cn("h-9 text-sm font-semibold text-black bg-white border border-gray-300 rounded-md px-3 pr-9 focus:ring-2 focus:ring-blue-500 outline-none w-full appearance-none transition-all", errCls('horario'))}
                />
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-auto cursor-pointer group-hover:text-blue-600 transition-colors" onClick={() => (document.getElementById('horario') as any)?.showPicker()} />
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="localAtividade" className="text-xs font-bold text-gray-600 uppercase tracking-tight">Local</Label>
              <div className="relative group">
                <Input
                  id="localAtividade"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Ex: Sede do Grupo"
                  className={cn("h-9 text-sm font-semibold text-black bg-white border-gray-300 placeholder:text-gray-400 pr-9 transition-all", errCls('local'))}
                />
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none group-hover:text-blue-600 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-600 uppercase tracking-tight">Ramo</Label>
                <div className="relative group">
                  <select
                    value={ramoEscoteiro}
                    onChange={(e) => setRamoEscoteiro(e.target.value)}
                    className={cn("h-9 w-full text-sm font-semibold text-black bg-white border border-gray-300 rounded-md px-3 pr-8 focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-all", errCls('ramoEscoteiro'))}
                  >
                    <option value="">Ramo...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.display_name}</option>
                    ))}
                  </select>
                  <Compass className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-600 uppercase tracking-tight">Tipo</Label>
                <div className="relative group">
                  <select
                    value={tipoAtividade}
                    onChange={(e) => setTipoAtividade(e.target.value)}
                    className="h-9 w-full text-sm font-semibold text-black bg-white border border-gray-300 rounded-md px-3 pr-8 focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-all"
                  >
                    {SCHEDULING_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <Tag className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Corpo da Mensagem */}
        <div className="px-4 py-3 min-h-[180px] flex flex-col bg-white">
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Escreva sua mensagem aqui..."
            className={cn(
              "flex-1 w-full text-sm text-gray-900 bg-transparent border-none focus:ring-0 p-0 resize-none placeholder:text-gray-400 leading-relaxed font-medium",
              errCls('observacoes')
            )}
          />
        </div>

        {/* Rodapé de Ações */}
        <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between bg-white gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              type="submit" 
              disabled={submitting} 
              className="bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-full px-8 py-2 h-10 text-sm font-semibold transition-all hover:shadow-lg active:scale-95 flex-1 sm:flex-none"
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
              className="text-gray-500 hover:bg-gray-100 rounded-full h-10 w-10 shrink-0"
              title="Descartar rascunho"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Salvo automaticamente no sistema</span>
          </div>
        </div>
      </div>
      
      {/* Exibição de erros flutuante ou discreta */}
      {Object.keys(errors).length > 0 && (
        <div className="px-4 py-1.5 bg-red-50 text-[10px] text-red-600 border-t border-red-100 font-medium">
          Verifique os campos obrigatórios marcados em vermelho.
        </div>
      )}
    </form>
  );
};

export default SchedulingRequestForm;
