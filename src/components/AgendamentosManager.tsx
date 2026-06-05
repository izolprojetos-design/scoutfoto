import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, MapPin, User, Clock, Pencil, Trash2, Loader2, Search, Filter, Mail, ShieldCheck,
  CheckCircle2, XCircle, Clock3, Inbox, Send, Archive, ArchiveRestore, Folder, Trash, Undo2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SCHEDULING_TYPES } from '@/lib/schedulingTypes';
import { parseLocalDate } from '@/lib/scoutUtils';
import { cn } from '@/lib/utils';

interface Agendamento {
  id: string;
  user_id: string;
  nome_associado: string;
  secao: string;
  dirigente: string;
  cargo_1: string;
  cargo_2: string;
  email_de: string;
  email_para: string;
  destinatario_nome: string;
  destinatario_secao: string;
  destinatario_cargo_1: string;
  destinatario_cargo_2: string;
  data_secao: string;
  horario: string;
  local: string;
  ramo_escoteiro: string;
  tipo_atividade: string;
  observacoes: string;
  status: string;
  created_at: string;
  recipient_response?: 'pendente' | 'confirmado' | 'recusado' | null;
  recipient_response_reason?: string | null;
  recipient_response_at?: string | null;
  recipient_response_by?: string | null;
}

interface Branch {
  id: string;
  display_name: string;
  icon: string;
}

const tipoLabel = (v: string) => SCHEDULING_TYPES.find(t => t.value === v)?.label ?? v;
import { toTitleCase } from '@/lib/formatting';


const AgendamentosManager = () => {
  const { user, roles } = useAuth();
  const isAdmin = roles?.includes('admin');
  const isVoluntario = roles?.includes('voluntario');

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const k = `agd:read:${user?.id ?? 'anon'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(k) : null;
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState<'inbox' | 'sent' | 'archived' | 'trash'>('inbox');
  const [filter, setFilter] = useState<'todos' | 'pendentes' | 'confirmados' | 'recusados' | 'futuros' | 'passados'>('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // RLS quick test
  const [rlsTestId, setRlsTestId] = useState<string | null>(null);
  const [rlsTestRecord, setRlsTestRecord] = useState<Agendamento | null>(null);
  const [rlsEmail, setRlsEmail] = useState('');
  const [rlsLoading, setRlsLoading] = useState(false);
  const [rlsResult, setRlsResult] = useState<{
    can_view: boolean;
    is_sender: boolean;
    is_recipient: boolean;
    has_admin_role: boolean;
    reason: string;
  } | null>(null);

  const runRlsTest = async () => {
    if (!rlsTestId || !rlsEmail.trim()) return;
    setRlsLoading(true);
    setRlsResult(null);
    try {
      const { data, error } = await (supabase as any).rpc('admin_check_agendamento_visibility', {
        p_agendamento_id: rlsTestId,
        p_email: rlsEmail.trim(),
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Sem retorno do servidor');
      setRlsResult({
        can_view: !!row.can_view,
        is_sender: !!row.is_sender,
        is_recipient: !!row.is_recipient,
        has_admin_role: !!row.has_admin_role,
        reason: row.reason ?? '',
      });
    } catch (err: any) {
      toast({ title: 'Erro no teste', description: err?.message ?? 'Falha ao executar', variant: 'destructive' });
    } finally {
      setRlsLoading(false);
    }
  };

  const focusRow = (idx: number, list: Agendamento[]) => {
    if (!list.length) return;
    const next = (idx + list.length) % list.length;
    setFocusedIndex(next);
    requestAnimationFrame(() => rowRefs.current[next]?.focus());
  };

  const handleRowKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number, list: Agendamento[]) => {
    const a = list[index];
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusRow(index + 1, list);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusRow(index - 1, list);
        break;
      case 'Home':
        e.preventDefault();
        focusRow(0, list);
        break;
      case 'End':
        e.preventDefault();
        focusRow(list.length - 1, list);
        break;
      case 'ArrowRight':
        e.preventDefault();
        setExpandedId(a.id);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (expandedId === a.id) setExpandedId(null);
        break;
      case 'Escape':
        if (expandedId) {
          e.preventDefault();
          setExpandedId(null);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        setExpandedId(expandedId === a.id ? null : a.id);
        break;
    }
  };

  const [editing, setEditing] = useState<Agendamento | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lockRecipient, setLockRecipient] = useState(false);
  const [autoFillingRecipient, setAutoFillingRecipient] = useState(false);

  // Auto-preencher Nome e Seção do destinatário a partir do e-mail (debounced)
  useEffect(() => {
    if (!editing) return;
    if (lockRecipient) return;
    const email = (editing.email_para ?? '').trim().toLowerCase();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValid) return;

    let cancelled = false;
    setAutoFillingRecipient(true);
    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, section')
        .ilike('email', email)
        .maybeSingle();
      if (cancelled) return;
      setAutoFillingRecipient(false);
      if (error || !data) return;
      setEditing((prev) => {
        if (!prev) return prev;
        if ((prev.email_para ?? '').trim().toLowerCase() !== email) return prev;
        const nextName = (data.name ?? '').toUpperCase();
        const nextSection = data.section ?? '';
        const nameChanged = nextName && nextName !== (prev.destinatario_nome ?? '');
        const sectionChanged = nextSection && nextSection !== (prev.destinatario_secao ?? '');
        if (!nameChanged && !sectionChanged) return prev;
        return {
          ...prev,
          destinatario_nome: nextName || prev.destinatario_nome,
          destinatario_secao: nextSection || prev.destinatario_secao,
        };
      });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(handle);
      setAutoFillingRecipient(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.email_para, editing?.id, lockRecipient]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: ags }, { data: br }, archives] = await Promise.all([
      supabase.from('agendamentos').select('*').order('data_secao', { ascending: false }),
      supabase.from('branches').select('id, display_name, icon').order('sort_order'),
      user?.id
        ? (supabase as any).from('agendamento_archives').select('agendamento_id, kind').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ]);
    setAgendamentos((ags as Agendamento[]) ?? []);
    setBranches(br ?? []);
    const rows = ((archives as any)?.data ?? []) as Array<{ agendamento_id: string; kind?: string }>;
    setArchivedIds(new Set(rows.filter(r => (r.kind ?? 'archived') === 'archived').map(r => r.agendamento_id)));
    setTrashedIds(new Set(rows.filter(r => r.kind === 'trashed').map(r => r.agendamento_id)));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Realtime: refletir respostas — restrito a registros que o usuário acessa
  // (RLS já filtra; aqui também aplicamos filtros server-side por segurança/eficiência).
  useEffect(() => {
    if (!user?.id) return;
    const email = (user.email || '').toLowerCase();
    const apply = (payload: any) => {
      const updated = payload.new as Agendamento;
      if (!updated) return;
      const mine = updated.user_id === user.id;
      const toMe = !!email && (updated.email_para || '').toLowerCase() === email;
      if (!mine && !toMe) return; // defensivo
      setAgendamentos(prev => {
        const exists = prev.some(a => a.id === updated.id);
        return exists
          ? prev.map(a => a.id === updated.id ? { ...a, ...updated } : a)
          : prev;
      });
    };
    const channel = supabase
      .channel(`agendamentos-rt-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agendamentos', filter: `user_id=eq.${user.id}` }, apply)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agendamentos', filter: `email_para=eq.${email}` }, apply)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, user?.email]);

  // Resposta do destinatário (Confirmar/Recusar)
  const userEmail = (user?.email || '').toLowerCase();
  const isRecipientOf = (a: Agendamento) =>
    !!userEmail && (a.email_para || '').toLowerCase() === userEmail;

  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Agendamento | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [conflictId, setConflictId] = useState<string | null>(null);

  const refreshAgendamento = async (id: string): Promise<Agendamento | null> => {
    const { data: fresh } = await supabase.from('agendamentos').select('*').eq('id', id).maybeSingle();
    if (fresh) {
      setAgendamentos(prev => prev.map(x => x.id === id ? { ...x, ...(fresh as Agendamento) } : x));
      return fresh as Agendamento;
    }
    return null;
  };

  const sendResponse = async (a: Agendamento, response: 'confirmado' | 'recusado', reason?: string) => {
    // Guarda no cliente: bloqueia tentativa quando já houve resposta
    const current = a.recipient_response ?? 'pendente';
    if (current !== 'pendente') {
      setConflictId(a.id);
      toast({
        title: 'Mensagem já respondida',
        description: `Esta mensagem já foi ${current} e não pode ser respondida novamente.`,
        variant: 'destructive',
      });
      await refreshAgendamento(a.id);
      return;
    }
    setRespondingId(a.id);
    try {
      // Recarrega o status atual do servidor antes de aplicar para evitar corridas.
      const fresh = await refreshAgendamento(a.id);
      const freshStatus = fresh?.recipient_response ?? 'pendente';
      if (freshStatus !== 'pendente') {
        setConflictId(a.id);
        toast({
          title: 'Mensagem já respondida',
          description: `Esta mensagem já foi ${freshStatus} por outro acesso. A lista foi sincronizada.`,
          variant: 'destructive',
        });
        setRejectTarget(null);
        setRejectReason('');
        return;
      }

      const { data, error } = await (supabase as any).rpc('respond_agendamento', {
        p_agendamento_id: a.id,
        p_response: response,
        p_reason: reason ?? null,
      });
      if (error) {
        // Mensagem amigável para conflito de re-resposta vindo do banco
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('já foi') || msg.includes('conflito') || error.code === '22023' || error.code === '40001') {
          setConflictId(a.id);
          toast({
          title: 'Mensagem já respondida',
          description: 'Outro acesso atualizou esta mensagem. A lista será sincronizada.',
            variant: 'destructive',
          });
          await refreshAgendamento(a.id);
          setRejectTarget(null);
          setRejectReason('');
          return;
        }
        throw error;
      }
      const updated = (Array.isArray(data) ? data[0] : data) as Agendamento;
      if (updated) {
        setAgendamentos(prev => prev.map(x => x.id === a.id ? { ...x, ...updated } : x));
      }
      toast({
        title: response === 'confirmado' ? 'Mensagem confirmada' : 'Mensagem recusada',
        description: response === 'confirmado'
          ? 'O solicitante foi notificado.'
          : 'O solicitante foi notificado com seu motivo.',
      });
      setRejectTarget(null);
      setRejectReason('');
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message ?? 'Falha ao registrar resposta', variant: 'destructive' });
    } finally {
      setRespondingId(null);
    }
  };

  const branchLabel = (id: string) => {
    const b = branches.find(br => br.id === id);
    return b ? `${b.icon} ${b.display_name}` : id;
  };

  const canEdit = (a: Agendamento) => isAdmin || a.user_id === user?.id;
  const canDelete = (a: Agendamento) => isAdmin || a.user_id === user?.id;

  // Pasta-base: separa Inbox (sou destinatário) / Sent (sou remetente) / Archived
  const inFolder = (a: Agendamento) => {
    const isArchived = archivedIds.has(a.id);
    const isTrashed = trashedIds.has(a.id);
    if (folder === 'trash') return isTrashed;
    if (isTrashed) return false;
    if (folder === 'archived') return isArchived;
    if (isArchived) return false;
    if (folder === 'inbox') return isRecipientOf(a);
    if (folder === 'sent') return a.user_id === user?.id;
    return true;
  };

  const folderBase = useMemo(
    () => agendamentos.filter(inFolder),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agendamentos, archivedIds, trashedIds, folder, user?.id, userEmail],
  );

  // Contagens por pasta para a UI lateral
  const folderCounts = useMemo(() => {
    let inbox = 0, sent = 0, archived = 0, trash = 0, inboxUnread = 0;
    for (const a of agendamentos) {
      if (trashedIds.has(a.id)) { trash++; continue; }
      const isArchived = archivedIds.has(a.id);
      if (isArchived) { archived++; continue; }
      if (isRecipientOf(a)) {
        inbox++;
        if (!readIds.has(a.id) && (a.recipient_response ?? 'pendente') === 'pendente') inboxUnread++;
      }
      if (a.user_id === user?.id) sent++;
    }
    return { inbox, sent, archived, trash, inboxUnread };
  }, [agendamentos, archivedIds, trashedIds, readIds, user?.id, userEmail]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return folderBase.filter(a => {
      const r = a.recipient_response ?? 'pendente';
      if (filter === 'pendentes' && r !== 'pendente') return false;
      if (filter === 'confirmados' && r !== 'confirmado') return false;
      if (filter === 'recusados' && r !== 'recusado') return false;
      if (filter === 'futuros' && parseLocalDate(a.data_secao) < today) return false;
      if (filter === 'passados' && parseLocalDate(a.data_secao) >= today) return false;
      if (!term) return true;
      return (
        a.nome_associado.toLowerCase().includes(term) ||
        a.local.toLowerCase().includes(term) ||
        a.dirigente.toLowerCase().includes(term) ||
        a.secao.toLowerCase().includes(term) ||
        tipoLabel(a.tipo_atividade).toLowerCase().includes(term) ||
        (a.destinatario_nome ?? '').toLowerCase().includes(term) ||
        (a.email_para ?? '').toLowerCase().includes(term) ||
        (a.destinatario_secao ?? '').toLowerCase().includes(term) ||
        (a.destinatario_cargo_1 ?? '').toLowerCase().includes(term) ||
        (a.destinatario_cargo_2 ?? '').toLowerCase().includes(term) ||
        (a.observacoes ?? '').toLowerCase().includes(term)
      );
    });
  }, [folderBase, search, filter]);

  // Pagination derived state
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Reset to page 1 when filters/search/folder change
  useEffect(() => { setPage(1); }, [folder, filter, search, pageSize]);

  // Marca como "lido" ao expandir um item da Caixa de Entrada
  const persistRead = (next: Set<string>) => {
    setReadIds(next);
    try {
      const k = `agd:read:${user?.id ?? 'anon'}`;
      window.localStorage.setItem(k, JSON.stringify(Array.from(next)));
    } catch { /* noop */ }
  };
  useEffect(() => {
    if (!expandedId) return;
    if (readIds.has(expandedId)) return;
    const a = agendamentos.find(x => x.id === expandedId);
    if (!a || !isRecipientOf(a)) return;
    const next = new Set(readIds); next.add(expandedId); persistRead(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  const archiveAgendamento = async (a: Agendamento) => {
    if (!user?.id) return;
    const r = a.recipient_response ?? 'pendente';
    if (r === 'pendente') {
      toast({
        title: 'Ainda pendente',
        description: 'Só é possível arquivar após o destinatário confirmar ou recusar.',
        variant: 'destructive',
      });
      return;
    }
    setArchivingId(a.id);
    try {
      const { error } = await (supabase as any)
        .from('agendamento_archives')
        .insert({ user_id: user.id, agendamento_id: a.id, kind: 'archived' });
      if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
      setArchivedIds(prev => { const n = new Set(prev); n.add(a.id); return n; });
      toast({ title: 'Arquivado', description: 'Movido para a pasta Arquivado.' });
    } catch (err: any) {
      toast({ title: 'Erro ao arquivar', description: err?.message ?? 'Falha', variant: 'destructive' });
    } finally {
      setArchivingId(null);
    }
  };

  const unarchiveAgendamento = async (a: Agendamento) => {
    if (!user?.id) return;
    setArchivingId(a.id);
    try {
      const { error } = await (supabase as any)
        .from('agendamento_archives')
        .delete()
        .eq('user_id', user.id)
        .eq('agendamento_id', a.id)
        .eq('kind', 'archived');
      if (error) throw error;
      setArchivedIds(prev => { const n = new Set(prev); n.delete(a.id); return n; });
      toast({ title: 'Restaurado', description: 'Removido do Arquivado.' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message ?? 'Falha', variant: 'destructive' });
    } finally {
      setArchivingId(null);
    }
  };

  const trashAgendamento = async (a: Agendamento) => {
    if (!user?.id) return;
    setArchivingId(a.id);
    try {
      // Remove do arquivado (se houver) e marca como trashed
      await (supabase as any)
        .from('agendamento_archives')
        .delete()
        .eq('user_id', user.id)
        .eq('agendamento_id', a.id)
        .eq('kind', 'archived');
      const { error } = await (supabase as any)
        .from('agendamento_archives')
        .insert({ user_id: user.id, agendamento_id: a.id, kind: 'trashed' });
      if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
      setArchivedIds(prev => { const n = new Set(prev); n.delete(a.id); return n; });
      setTrashedIds(prev => { const n = new Set(prev); n.add(a.id); return n; });
      toast({ title: 'Movido para a Lixeira' });
    } catch (err: any) {
      toast({ title: 'Erro ao mover', description: err?.message ?? 'Falha', variant: 'destructive' });
    } finally {
      setArchivingId(null);
    }
  };

  const untrashAgendamento = async (a: Agendamento) => {
    if (!user?.id) return;
    setArchivingId(a.id);
    try {
      const { error } = await (supabase as any)
        .from('agendamento_archives')
        .delete()
        .eq('user_id', user.id)
        .eq('agendamento_id', a.id)
        .eq('kind', 'trashed');
      if (error) throw error;
      setTrashedIds(prev => { const n = new Set(prev); n.delete(a.id); return n; });
      toast({ title: 'Restaurado', description: 'Removido da Lixeira.' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message ?? 'Falha', variant: 'destructive' });
    } finally {
      setArchivingId(null);
    }
  };

  // Mantém foco e linha expandida consistentes ao mudar filtros/pesquisa.
  // Se o item focado/expandido continuar na lista, preserva sua posição.
  // Se sumir, foca o vizinho mais próximo do índice anterior, sem rolar para o topo.
  const prevFocusedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (filtered.length === 0) {
      setFocusedIndex(-1);
      prevFocusedIdRef.current = null;
      return;
    }

    // Reconciliar expandedId: limpa apenas se o item saiu do conjunto filtrado.
    if (expandedId && !filtered.some(a => a.id === expandedId)) {
      setExpandedId(null);
    }

    // Reconciliar focusedIndex usando o id anteriormente focado.
    const prevId = prevFocusedIdRef.current;
    let nextIndex = -1;
    if (prevId) {
      nextIndex = filtered.findIndex(a => a.id === prevId);
    }
    if (nextIndex === -1 && focusedIndex >= 0) {
      // item sumiu — clamp ao mesmo índice (vizinho mais próximo).
      nextIndex = Math.min(focusedIndex, filtered.length - 1);
    }

    if (nextIndex !== -1 && nextIndex !== focusedIndex) {
      setFocusedIndex(nextIndex);
    }

    // Reaplica o foco somente se o usuário já estava navegando pela lista
    // (evita roubar foco do campo de busca enquanto digita).
    const active = document.activeElement as HTMLElement | null;
    const isRowFocused = active?.getAttribute('role') === 'option';
    if (isRowFocused && nextIndex !== -1) {
      requestAnimationFrame(() => {
        rowRefs.current[nextIndex]?.focus({ preventScroll: true });
      });
    }

    prevFocusedIdRef.current = nextIndex !== -1 ? filtered[nextIndex].id : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  // Atualiza o id focado sempre que o índice muda por interação do teclado.
  useEffect(() => {
    if (focusedIndex >= 0 && filtered[focusedIndex]) {
      prevFocusedIdRef.current = filtered[focusedIndex].id;
    }
  }, [focusedIndex, filtered]);

  const handleDelete = async (id: string) => {
    setSaving(true);
    const { error } = await supabase.from('agendamentos').delete().eq('id', id);
    setSaving(false);
    setDeletingId(null);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Mensagem excluída', description: 'O registro foi removido com sucesso.' });
    fetchData();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('agendamentos')
      .update({
        nome_associado: editing.nome_associado.trim(),
        dirigente: editing.dirigente.trim(),
        local: editing.local.trim(),
        data_secao: editing.data_secao,
        horario: editing.horario,
        tipo_atividade: editing.tipo_atividade,
        ramo_escoteiro: editing.ramo_escoteiro,
        observacoes: editing.observacoes.trim(),
        email_para: editing.email_para.trim(),
        destinatario_nome: (editing.destinatario_nome ?? '').trim().toUpperCase(),
        destinatario_secao: (editing.destinatario_secao ?? '').trim(),
        destinatario_cargo_1: (editing.destinatario_cargo_1 ?? '').trim(),
        destinatario_cargo_2: (editing.destinatario_cargo_2 ?? '').trim(),
      })
      .eq('id', editing.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Mensagem atualizada', description: 'Alterações salvas com sucesso.' });
    setEditing(null);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando mensagens...
      </div>
    );
  }

  const FOLDERS: Array<{ key: typeof folder; label: string; icon: typeof Inbox; count: number; badge?: number }> = [
    { key: 'inbox', label: 'Caixa de Entrada', icon: Inbox, count: folderCounts.inbox, badge: folderCounts.inboxUnread },
    { key: 'sent', label: 'Caixa de Saída', icon: Send, count: folderCounts.sent },
    { key: 'archived', label: 'Arquivado', icon: Archive, count: folderCounts.archived },
    { key: 'trash', label: 'Lixeira', icon: Trash, count: folderCounts.trash },
  ];

  const FILTERS: Array<{ key: typeof filter; label: string }> = [
    { key: 'todos', label: 'Todos' },
    { key: 'pendentes', label: 'Pendentes' },
    { key: 'confirmados', label: 'Confirmados' },
    { key: 'recusados', label: 'Recusados' },
    { key: 'futuros', label: 'Futuros' },
    { key: 'passados', label: 'Passados' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5 max-w-6xl mx-auto">
      {/* Sidebar tipo e-mail */}
      <aside className="md:sticky md:top-4 self-start space-y-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground px-2 mb-1 flex items-center gap-1.5">
          <Folder className="h-3.5 w-3.5" /> Pastas
        </div>
        {FOLDERS.map(f => {
          const Icon = f.icon;
          const active = folder === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => { setFolder(f.key); setExpandedId(null); }}
              data-testid={`folder-${f.key}`}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm transition-colors',
                active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground/80',
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{f.label}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                {f.badge ? (
                  <span className="rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
                    {f.badge}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">{f.count}</span>
              </span>
            </button>
          );
        })}
      </aside>

      <div className="space-y-4">
      {/* Toolbar — search + filter integrados */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 w-full sm:rounded-md sm:border sm:border-input sm:bg-background sm:shadow-sm sm:focus-within:ring-1 sm:focus-within:ring-ring sm:overflow-hidden">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, destinatário, e-mail, local, assunto..."
            className="pl-9 h-12 text-base w-full sm:border-0 sm:shadow-none sm:rounded-none sm:focus-visible:ring-0 sm:focus-visible:ring-offset-0"
          />
        </div>
        <div className="hidden sm:block w-px bg-border self-stretch" aria-hidden />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger
            className="h-12 w-full sm:w-[180px] shrink-0 sm:border-0 sm:shadow-none sm:rounded-none sm:focus:ring-0 sm:focus:ring-offset-0 bg-muted/40 sm:bg-transparent"
          >
            <span className="flex items-center gap-2 truncate">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filtrar" />
            </span>
          </SelectTrigger>
          <SelectContent align="end">
            {FILTERS.map(f => (
              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Counter */}
      <div className="text-sm text-muted-foreground">
        {filtered.length} mensagen{filtered.length !== 1 ? 's' : 'm'} encontrada{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">Nenhuma mensagem encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border divide-y bg-card" role="listbox" aria-label="Lista de mensagens">
          {paginated.map((a, index) => {
            const mine = a.user_id === user?.id;
            const isOpen = expandedId === a.id;
            const isFocused = focusedIndex === index || (focusedIndex === -1 && index === 0);
            const dateLabel = format(parseLocalDate(a.data_secao), "dd/MM", { locale: ptBR });
            const subject = a.local?.trim() || a.observacoes?.trim() || tipoLabel(a.tipo_atividade);
            return (
              <div key={a.id} className={cn('transition-colors', isOpen && 'bg-muted/40')}>
                {/* Linha colapsada (estilo e-mail) */}
                <button
                  type="button"
                  ref={el => { rowRefs.current[index] = el; }}
                  role="option"
                  aria-expanded={isOpen}
                  aria-selected={isOpen}
                  tabIndex={isFocused ? 0 : -1}
                  onFocus={() => setFocusedIndex(index)}
                  onKeyDown={e => handleRowKeyDown(e, index, paginated)}
                  onClick={() => setExpandedId(isOpen ? null : a.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <Badge variant={mine ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {mine ? 'Meu' : 'Equipe'}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 w-24">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{dateLabel}</span>
                    <Clock className="h-3.5 w-3.5 ml-1" />
                    <span>{a.horario.slice(0, 5)}</span>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{subject}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 max-w-[40%]">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {a.destinatario_nome ? toTitleCase(a.destinatario_nome) : (a.email_para || 'Sem destinatário')}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 hidden md:inline-flex">
                    {tipoLabel(a.tipo_atividade)}
                  </Badge>
                  {(() => {
                    const r = a.recipient_response ?? 'pendente';
                    const cfg = r === 'confirmado'
                      ? { icon: CheckCircle2, label: 'Confirmado', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' }
                      : r === 'recusado'
                      ? { icon: XCircle, label: 'Recusado', cls: 'border-destructive/40 bg-destructive/10 text-destructive' }
                      : { icon: Clock3, label: 'Aguardando', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400' };
                    const Icon = cfg.icon;
                    return (
                      <Badge variant="outline" className={cn('text-[10px] shrink-0 gap-1', cfg.cls)}>
                        <Icon className="h-3 w-3" /> {cfg.label}
                      </Badge>
                    );
                  })()}
                </button>

                {/* Painel expandido */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t bg-background/50">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm pt-2">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span>{format(parseLocalDate(a.data_secao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>{a.horario.slice(0, 5)}</span>
                      </div>
                      <div className="flex items-start gap-2 min-w-0">
                        <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="break-words">
                          {toTitleCase(a.local) || <em className="text-muted-foreground">Local não informado</em>}
                        </span>
                      </div>
                      {a.ramo_escoteiro && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Ramo:</span>
                          <span className="text-foreground">{branchLabel(a.ramo_escoteiro)}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Solicitante</p>
                      <p className="text-sm font-medium break-words">{toTitleCase(a.nome_associado)}</p>
                      {a.secao && <p className="text-xs text-muted-foreground">{toTitleCase(a.secao)}</p>}
                    </div>

                    {(() => {
                      const nome = (a.destinatario_nome || '').trim();
                      const secao = (a.destinatario_secao || '').trim();
                      return (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Destinatário</p>
                          {nome ? (
                            <p className="text-sm font-medium break-words">{toTitleCase(nome)}</p>
                          ) : (
                            <p className="text-sm italic text-muted-foreground">Não informado</p>
                          )}
                          {secao && <p className="text-xs text-muted-foreground break-words">{toTitleCase(secao)}</p>}
                        </div>
                      );
                    })()}

                    {a.observacoes && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Observações</p>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{a.observacoes}</p>
                      </div>
                    )}

                    {/* Resposta do destinatário */}
                    {(() => {
                      const r = a.recipient_response ?? 'pendente';
                      const isRecipient = isRecipientOf(a);
                      const isMine = a.user_id === user?.id;
                      if (r === 'confirmado') {
                        return (
                          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Destinatário confirmou{a.recipient_response_at ? ` em ${format(new Date(a.recipient_response_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}` : ''}.</span>
                          </div>
                        );
                      }
                      if (r === 'recusado') {
                        return (
                          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                            <div className="flex items-center gap-2 text-destructive font-medium">
                              <XCircle className="h-4 w-4" />
                              <span>Destinatário recusou{a.recipient_response_at ? ` em ${format(new Date(a.recipient_response_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}` : ''}.</span>
                            </div>
                            {a.recipient_response_reason && (
                              <p className="mt-1 text-foreground/90 whitespace-pre-wrap break-words">
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">Motivo: </span>
                                {a.recipient_response_reason}
                              </p>
                            )}
                          </div>
                        );
                      }
                      // pendente
                      if (isRecipient) {
                        const isConflict = conflictId === a.id;
                        const disabled = respondingId === a.id || isConflict;
                        return (
                          <div className="space-y-2">
                            {isConflict && (
                              <div
                                role="alert"
                                aria-live="assertive"
                                data-testid={`conflict-banner-${a.id}`}
                                className="rounded-md border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive font-medium flex items-start gap-2"
                              >
                                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <div>
                                  <div>Não é possível responder novamente</div>
                                  <div className="text-xs font-normal text-destructive/90 mt-0.5">
                                    Este agendamento já foi respondido. A lista foi sincronizada — atualize a página se necessário.
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="rounded-md border bg-muted/30 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm flex items-center gap-2">
                                <Clock3 className="h-4 w-4 text-amber-600" />
                                <span>Você é o destinatário. Deseja confirmar?</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  data-testid={`confirm-btn-${a.id}`}
                                  onClick={(e) => { e.stopPropagation(); sendResponse(a, 'confirmado'); }}
                                  disabled={disabled}
                                  className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  {respondingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                  Confirmar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-testid={`reject-btn-${a.id}`}
                                  onClick={(e) => { e.stopPropagation(); setRejectTarget(a); setRejectReason(''); }}
                                  disabled={disabled}
                                  className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Recusar
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (isMine) {
                        return (
                          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                            <Clock3 className="h-4 w-4" />
                            <span>Aguardando resposta do destinatário.</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      {trashedIds.has(a.id) ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); untrashAgendamento(a); }}
                            disabled={archivingId === a.id}
                            className="h-8 gap-1"
                            data-testid={`untrash-btn-${a.id}`}
                          >
                            {archivingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                            Restaurar da Lixeira
                          </Button>
                          {canDelete(a) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setDeletingId(a.id); }}
                              className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                              data-testid={`permanent-delete-btn-${a.id}`}
                              title="Excluir definitivamente do banco"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir definitivamente
                            </Button>
                          )}
                        </>
                      ) : archivedIds.has(a.id) ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); unarchiveAgendamento(a); }}
                            disabled={archivingId === a.id}
                            className="h-8 gap-1"
                            data-testid={`unarchive-btn-${a.id}`}
                          >
                            {archivingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                            Restaurar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); trashAgendamento(a); }}
                            disabled={archivingId === a.id}
                            className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                            data-testid={`trash-btn-${a.id}`}
                            title="Mover para a Lixeira"
                          >
                            <Trash className="h-3.5 w-3.5" />
                            Lixeira
                          </Button>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const r = a.recipient_response ?? 'pendente';
                            const isPending = r === 'pendente';
                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); archiveAgendamento(a); }}
                                disabled={archivingId === a.id || isPending}
                                className="h-8 gap-1"
                                data-testid={`archive-btn-${a.id}`}
                                title={isPending ? 'Disponível após confirmação ou recusa' : 'Mover para Arquivado'}
                              >
                                {archivingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                                Arquivar
                              </Button>
                            );
                          })()}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); trashAgendamento(a); }}
                            disabled={archivingId === a.id}
                            className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                            data-testid={`trash-btn-${a.id}`}
                            title="Mover para a Lixeira"
                          >
                            <Trash className="h-3.5 w-3.5" />
                            Lixeira
                          </Button>
                        </>
                      )}
                      {canEdit(a) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setLockRecipient(false); setEditing(a); }}
                          className="h-8 gap-1"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                      )}
                      {canDelete(a) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setDeletingId(a.id); }}
                          className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="text-xs text-muted-foreground">
            Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-9 w-[110px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} / página</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Página anterior"
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground px-2 tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Próxima página"
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setLockRecipient(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar mensagem</DialogTitle>
            <DialogDescription>Atualize as informações da mensagem.</DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1">
              <div className="sm:col-span-2">
                <Label htmlFor="ed-nome" className="text-xs font-semibold text-muted-foreground uppercase">Nome do associado</Label>
                <Input
                  id="ed-nome"
                  value={editing.nome_associado}
                  onChange={(e) => setEditing({ ...editing, nome_associado: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="ed-dir" className="text-xs font-semibold text-muted-foreground uppercase">Dirigente</Label>
                <Input
                  id="ed-dir"
                  value={editing.dirigente}
                  onChange={(e) => setEditing({ ...editing, dirigente: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="ed-tipo" className="text-xs font-semibold text-muted-foreground uppercase">Tipo de atividade</Label>
                <select
                  id="ed-tipo"
                  value={editing.tipo_atividade}
                  onChange={(e) => setEditing({ ...editing, tipo_atividade: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SCHEDULING_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="ed-data" className="text-xs font-semibold text-muted-foreground uppercase">Data</Label>
                <div className="relative group mt-1">
                  <Input
                    id="ed-data"
                    type="date"
                    value={editing.data_secao}
                    onChange={(e) => setEditing({ ...editing, data_secao: e.target.value })}
                    className="h-9 text-sm pr-9 cursor-pointer"
                  />
                  <CalendarDays 
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-auto cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => (document.getElementById('ed-data') as any)?.showPicker()}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ed-hora" className="text-xs font-semibold text-muted-foreground uppercase">Horário</Label>
                <div className="relative group mt-1">
                  <Input
                    id="ed-hora"
                    type="time"
                    value={editing.horario.slice(0, 5)}
                    onChange={(e) => setEditing({ ...editing, horario: e.target.value })}
                    className="h-9 text-sm pr-9 cursor-pointer"
                  />
                  <Clock 
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-auto cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => (document.getElementById('ed-hora') as any)?.showPicker()}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="ed-local" className="text-xs font-semibold text-muted-foreground uppercase">Local</Label>
                <Input
                  id="ed-local"
                  value={editing.local}
                  onChange={(e) => setEditing({ ...editing, local: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="ed-ramo" className="text-xs font-semibold text-muted-foreground uppercase">Ramo escoteiro</Label>
                <select
                  id="ed-ramo"
                  value={editing.ramo_escoteiro}
                  onChange={(e) => setEditing({ ...editing, ramo_escoteiro: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecione...</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.icon} {b.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 mt-1 rounded-md border border-border/40 bg-muted/20 p-2.5 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                    Destinatário
                  </p>
                  <label
                    htmlFor="ed-lock-recipient"
                    className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1 text-[10px] font-bold cursor-pointer select-none uppercase"
                  >
                    <input
                      id="ed-lock-recipient"
                      type="checkbox"
                      checked={lockRecipient}
                      onChange={(e) => setLockRecipient(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-input accent-primary"
                    />
                    Bloquear campos
                  </label>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="ed-dest-nome" className="text-[10px] font-bold text-muted-foreground uppercase">Nome</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px] uppercase font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        disabled={lockRecipient || !editing.email_para?.trim()}
                        onClick={async () => {
                          const email = editing.email_para?.trim().toLowerCase();
                          if (!email) {
                            toast({ title: 'Informe o e-mail', description: 'Preencha o e-mail do destinatário primeiro.', variant: 'destructive' });
                            return;
                          }
                          const { data, error } = await supabase
                            .from('profiles')
                            .select('name, section')
                            .ilike('email', email)
                            .maybeSingle();
                          if (error || !data) {
                            toast({ title: 'Não encontrado', description: 'Nenhum cadastro com este e-mail.', variant: 'destructive' });
                            return;
                          }
                          setEditing((prev: any) => ({
                            ...prev,
                            destinatario_nome: (data.name ?? '').toUpperCase(),
                            destinatario_secao: prev.destinatario_secao || (data.section ?? ''),
                          }));
                          toast({ title: 'Carregado', description: 'Nome carregado conforme cadastro.' });
                        }}
                      >
                        Sincronizar
                      </Button>
                    </div>
                    <Input
                      id="ed-dest-nome"
                      value={editing.destinatario_nome ?? ''}
                      onChange={(e) => setEditing({ ...editing, destinatario_nome: e.target.value })}
                      readOnly={lockRecipient}
                      className={cn('mt-0.5 h-8 text-sm uppercase font-semibold', lockRecipient && 'bg-muted/60')}
                      placeholder="Não informado"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ed-dest-secao" className="text-[10px] font-bold text-muted-foreground uppercase">Seção</Label>
                    <Input
                      id="ed-dest-secao"
                      value={editing.destinatario_secao ?? ''}
                      onChange={(e) => setEditing({ ...editing, destinatario_secao: e.target.value })}
                      readOnly={lockRecipient}
                      className={cn('mt-0.5 h-8 text-sm font-semibold', lockRecipient && 'bg-muted/60')}
                      placeholder="Não informada"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ed-dest-cargo1" className="text-[10px] font-bold text-muted-foreground uppercase">Cargo 1</Label>
                    <Input
                      id="ed-dest-cargo1"
                      value={editing.destinatario_cargo_1 ?? ''}
                      onChange={(e) => setEditing({ ...editing, destinatario_cargo_1: e.target.value })}
                      readOnly={lockRecipient}
                      className={cn('mt-0.5 h-8 text-sm font-semibold', lockRecipient && 'bg-muted/60')}
                      placeholder="Não informado"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="ed-emailpara" className="text-[10px] font-bold text-muted-foreground uppercase">E-mail</Label>
                      {autoFillingRecipient && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" /> buscando…
                        </span>
                      )}
                    </div>
                    <Input
                      id="ed-emailpara"
                      type="email"
                      value={editing.email_para}
                      onChange={(e) => setEditing({ ...editing, email_para: e.target.value })}
                      readOnly={lockRecipient}
                      className={cn('mt-0.5 h-8 text-sm font-semibold', lockRecipient && 'bg-muted/60')}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="ed-obs" className="text-xs font-semibold text-muted-foreground uppercase">Observações</Label>
                <Textarea
                  id="ed-obs"
                  value={editing.observacoes}
                  onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })}
                  rows={3}
                  className="mt-1 text-sm font-medium"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A mensagem será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Excluindo...</> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recusa do destinatário com motivo */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(''); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" /> Recusar mensagem
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da recusa. O solicitante será notificado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motivo</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex.: conflito de horário, indisponibilidade, etc."
              rows={4}
              className="text-base"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(''); }} disabled={!!respondingId}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || !!respondingId}
              onClick={() => rejectTarget && sendResponse(rejectTarget, 'recusado', rejectReason.trim())}
            >
              {respondingId ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</> : 'Confirmar recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teste rápido de RLS (admin) */}
      <Dialog open={!!rlsTestId} onOpenChange={(open) => { if (!open) { setRlsTestId(null); setRlsTestRecord(null); setRlsResult(null); setRlsEmail(''); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Testar RLS
            </DialogTitle>
            <DialogDescription>
              Simula se o usuário com este e-mail conseguiria visualizar esta mensagem.
            </DialogDescription>
          </DialogHeader>

          {rlsTestRecord && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Mensagem testada</span>
                <code className="font-mono text-[11px] text-foreground/80 break-all">
                  #{rlsTestRecord.id.slice(0, 8)}
                </code>
              </div>
              <div className="text-foreground/90">
                {format(parseLocalDate(rlsTestRecord.data_secao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {rlsTestRecord.horario && <> • {rlsTestRecord.horario.slice(0, 5)}</>}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rls-email">E-mail do usuário a simular</Label>
              <Input
                id="rls-email"
                type="email"
                value={rlsEmail}
                onChange={(e) => setRlsEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                className="h-12 text-base"
              />
            </div>

            <Button
              onClick={runRlsTest}
              disabled={rlsLoading || !rlsEmail.trim()}
              className="w-full"
            >
              {rlsLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Testando...</> : 'Executar teste'}
            </Button>

            {rlsResult && (
              <div className="rounded-md border p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Resultado</span>
                  <Badge variant={rlsResult.can_view ? 'default' : 'secondary'}>
                    {rlsResult.can_view ? 'Visível' : 'Oculto'}
                  </Badge>
                </div>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>Remetente: <span className="text-foreground">{rlsResult.is_sender ? 'Sim' : 'Não'}</span></li>
                  <li>Destinatário: <span className="text-foreground">{rlsResult.is_recipient ? 'Sim' : 'Não'}</span></li>
                  <li>Admin: <span className="text-foreground">{rlsResult.has_admin_role ? 'Sim' : 'Não'}</span></li>
                </ul>
                <p className="text-xs pt-1 border-t">{rlsResult.reason}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setRlsTestId(null); setRlsTestRecord(null); setRlsResult(null); setRlsEmail(''); }}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default AgendamentosManager;
