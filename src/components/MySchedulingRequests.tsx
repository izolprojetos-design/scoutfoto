import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Clock, MapPin, Trash2, Inbox, Pencil, Loader2, Save, Paperclip, CheckCircle2, XCircle, AlertTriangle, Eye, Mail } from 'lucide-react';
import ApprovalTimeline, { type ApprovalStep } from '@/components/ApprovalTimeline';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { parseLocalDate } from '@/lib/scoutUtils';
import { SCHEDULING_STATUS_LABELS, SCHEDULING_TYPES, getSchedulingTypeLabel } from '@/lib/schedulingTypes';
import { toTitleCase } from '@/lib/formatting';
import SchedulingAttachments from '@/components/SchedulingAttachments';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
}

interface Request {
  id: string;
  nome_responsavel: string;
  email: string;
  destinatario_email: string;
  destinatario_nome?: string | null;
  destinatario_secao?: string | null;
  destinatario_cargo_1?: string | null;
  destinatario_cargo_2?: string | null;
  data: string;
  horario: string;
  local: string;
  tipo: string;
  descricao: string;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  branch_id: string | null;
}

interface Branch { id: string; display_name: string; icon: string }

interface Props { refreshKey?: number }

const EDITABLE_STATUSES = ['pendente', 'confirmado_email'];

const MySchedulingRequests = ({ refreshKey }: Props) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachmentsByReq, setAttachmentsByReq] = useState<Record<string, Attachment[]>>({});
  const [approvalsByReq, setApprovalsByReq] = useState<Record<string, ApprovalStep[]>>({});

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editReq, setEditReq] = useState<Request | null>(null);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState('');
  const [editHorario, setEditHorario] = useState('');
  const [editLocal, setEditLocal] = useState('');
  const [editBranchId, setEditBranchId] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Attachments panel
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachReq, setAttachReq] = useState<Request | null>(null);

  // Confirm / Reject state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReq, setRejectReq] = useState<Request | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // View rejection details
  const [viewRejectOpen, setViewRejectOpen] = useState(false);
  const [viewRejectReq, setViewRejectReq] = useState<Request | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: reqs }, { data: br }] = await Promise.all([
      supabase.from('scheduling_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('branches').select('id, display_name, icon'),
    ]);
    setRequests(reqs ?? []);
    setBranches(br ?? []);

    // Load attachments for all requests
    if (reqs?.length) {
      const ids = reqs.map(r => r.id);
      const { data: atts } = await supabase
        .from('agendamento_anexos')
        .select('id, agendamento_id, file_name, file_path, file_size, content_type')
        .in('agendamento_id', ids)
        .order('file_name');
      const grouped: Record<string, Attachment[]> = {};
      for (const a of atts ?? []) {
        const key = (a as any).agendamento_id as string;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(a);
      }
      setAttachmentsByReq(grouped);
    }

    // Load approval steps
    if (reqs?.length) {
      const ids = reqs.map(r => r.id);
      const { data: approvals } = await supabase
        .from('aprovacoes')
        .select('*')
        .in('agendamento_id', ids)
        .order('nivel');

      const approverIds = [...new Set((approvals ?? []).filter(a => a.aprovado_por).map(a => a.aprovado_por!))];
      let profileMap: Record<string, string> = {};
      if (approverIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, name').in('user_id', approverIds);
        profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.name]));
      }

      const groupedApprovals: Record<string, ApprovalStep[]> = {};
      for (const a of approvals ?? []) {
        if (!groupedApprovals[a.agendamento_id]) groupedApprovals[a.agendamento_id] = [];
        groupedApprovals[a.agendamento_id].push({
          ...a,
          status: a.status as 'pendente' | 'aprovado' | 'rejeitado',
          aprovador_nome: a.aprovado_por ? profileMap[a.aprovado_por] ?? '' : undefined,
        });
      }
      setApprovalsByReq(groupedApprovals);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [user, refreshKey]);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta solicitação?')) return;
    const { error } = await supabase.from('scheduling_requests').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Solicitação excluída' });
    load();
  };

  const openEdit = (r: Request) => {
    setEditReq(r);
    setEditData(r.data);
    setEditHorario(r.horario);
    setEditLocal(r.local);
    setEditBranchId(r.branch_id ?? '');
    setEditTipo(r.tipo);
    setEditDescricao(r.descricao);
    setEditErrors({});
    setEditOpen(true);
  };

  const validateEdit = () => {
    const e: Record<string, string> = {};
    if (!editData) e.data = 'Selecione a data';
    else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [y, m, d] = editData.split('-').map(Number);
      const sel = new Date(y, m - 1, d);
      if (sel < today) e.data = 'Data deve ser hoje ou futura';
    }
    if (!/^\d{2}:\d{2}$/.test(editHorario)) e.horario = 'Formato HH:MM';
    if (editLocal.trim().length < 2) e.local = 'Informe o local';
    if (!editBranchId) e.branchId = 'Selecione um ramo';
    if (editDescricao.trim().length < 5) e.descricao = 'Mínimo 5 caracteres';
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveEdit = async () => {
    if (!editReq || !validateEdit()) return;
    setSaving(true);
    const { error } = await supabase
      .from('scheduling_requests')
      .update({
        data: editData,
        horario: editHorario,
        local: editLocal.trim(),
        branch_id: editBranchId || null,
        tipo: editTipo,
        descricao: editDescricao.trim(),
      })
      .eq('id', editReq.id);

    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Solicitação atualizada!' });
    setEditOpen(false);
    load();
  };

  const getBranch = (id: string | null) => branches.find(b => b.id === id);

  const openAttachments = (r: Request) => {
    setAttachReq(r);
    setAttachOpen(true);
  };

  const handleConfirm = async (r: Request) => {
    setConfirmingId(r.id);
    const { error } = await supabase
      .from('scheduling_requests')
      .update({ status: 'confirmado_email' })
      .eq('id', r.id);
    setConfirmingId(null);
    if (error) {
      toast({ title: 'Erro ao confirmar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Solicitação confirmada', description: 'Sua solicitação seguirá para aprovação da coordenação.' });
    load();
  };

  const openReject = (r: Request) => {
    setRejectReq(r);
    setRejectReason('');
    setRejectError('');
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!rejectReq) return;
    const reason = rejectReason.trim();
    if (reason.length < 5) {
      setRejectError('Informe uma justificativa com pelo menos 5 caracteres.');
      return;
    }
    setRejecting(true);
    const { error } = await supabase
      .from('scheduling_requests')
      .update({ status: 'rejeitado', rejection_reason: reason })
      .eq('id', rejectReq.id);
    setRejecting(false);
    if (error) {
      toast({ title: 'Erro ao recusar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Solicitação recusada', description: 'Sua justificativa foi registrada.' });
    setRejectOpen(false);
    setRejectReq(null);
    load();
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>;

  if (requests.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Você ainda não tem solicitações de agendamento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {requests.map((r) => {
          const status = SCHEDULING_STATUS_LABELS[r.status] ?? { label: r.status, variant: 'secondary' as const };
          const branch = getBranch(r.branch_id);
          const canEdit = EDITABLE_STATUSES.includes(r.status);
          const attCount = attachmentsByReq[r.id]?.length ?? 0;
          return (
            <div key={r.id}>
              <Card className="border shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-semibold text-base">{getSchedulingTypeLabel(r.tipo)}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Enviada em {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span>{format(parseLocalDate(r.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>{r.horario}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>{toTitleCase(r.local) || <em className="text-muted-foreground">Não informado</em>}</span>
                    </div>
                  </div>

                  {branch && (
                    <Badge variant="outline" className="mt-3 font-normal">
                      {branch.icon} {branch.display_name}
                    </Badge>
                  )}

                  {/* Destinatário */}
                  <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Destinatário
                    </p>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Nome</p>
                      {r.destinatario_nome ? (
                        <p className="text-sm font-medium break-words">{toTitleCase(r.destinatario_nome)}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">Não informado</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Seção</p>
                      <p className={`text-xs break-words ${r.destinatario_secao ? 'text-foreground/90' : 'italic text-muted-foreground'}`}>
                        {r.destinatario_secao ? toTitleCase(r.destinatario_secao) : 'Não informada'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Cargo 1</p>
                      <p className={`text-xs break-words ${r.destinatario_cargo_1 ? 'text-foreground/90' : 'italic text-muted-foreground'}`}>
                        {r.destinatario_cargo_1 || 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">E-mail</p>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {r.destinatario_email ? (
                          <span className="break-all text-foreground/90">{r.destinatario_email}</span>
                        ) : (
                          <span className="italic text-muted-foreground">Não informado</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {r.descricao && (
                    <p className="mt-3 text-sm text-foreground/80 border-l-2 border-muted pl-3"><strong>Observações:</strong> {r.descricao}</p>
                  )}

                  {r.status === 'rejeitado' && (
                    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                      <div className="flex items-start gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">Solicitação rejeitada</p>
                          {r.rejection_reason ? (
                            <p className="mt-1 line-clamp-2 text-destructive/90">{r.rejection_reason}</p>
                          ) : (
                            <p className="mt-1 italic text-destructive/80">Sem justificativa registrada.</p>
                          )}
                        </div>
                      </div>
                      {r.rejection_reason && r.rejection_reason.length > 80 && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-destructive hover:bg-destructive/15 hover:text-destructive"
                            onClick={() => { setViewRejectReq(r); setViewRejectOpen(true); }}
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver justificativa completa
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Approval Timeline */}
                  {(approvalsByReq[r.id]?.length ?? 0) > 0 && (
                    <div className="mt-3 rounded-lg border p-3">
                      <p className="text-xs font-semibold mb-2 text-muted-foreground">Fluxo de Aprovação</p>
                      <ApprovalTimeline steps={approvalsByReq[r.id]} />
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openAttachments(r)} className="gap-1">
                      <Paperclip className="h-4 w-4" />
                      Anexos{attCount > 0 && ` (${attCount})`}
                    </Button>
                    {r.status === 'pendente' && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleConfirm(r)}
                          disabled={confirmingId === r.id}
                          className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {confirmingId === r.id
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirmando...</>
                            : <><CheckCircle2 className="h-4 w-4" /> Confirmar</>}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openReject(r)}
                          className="gap-1 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <XCircle className="h-4 w-4" /> Não
                        </Button>
                      </>
                    )}
                    {canEdit && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="gap-1">
                          <Pencil className="h-4 w-4" /> Editar
                        </Button>
                        {r.status === 'pendente' && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4 mr-1" /> Excluir
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Solicitação</DialogTitle>
            <DialogDescription>Altere os dados abaixo. Campos marcados com * são obrigatórios.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-data">Data *</Label>
                <Input id="edit-data" type="date" value={editData} onChange={e => setEditData(e.target.value)} />
                {editErrors.data && <p className="text-sm text-destructive">{editErrors.data}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-horario">Horário *</Label>
                <Input id="edit-horario" type="time" value={editHorario} onChange={e => setEditHorario(e.target.value)} />
                {editErrors.horario && <p className="text-sm text-destructive">{editErrors.horario}</p>}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-local">Local *</Label>
                <Input id="edit-local" value={editLocal} onChange={e => setEditLocal(e.target.value)} placeholder="Ex: Sede do grupo, Parque Anauá..." />
                {editErrors.local && <p className="text-sm text-destructive">{editErrors.local}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-branch">Ramo escoteiro *</Label>
                <select
                  id="edit-branch"
                  value={editBranchId}
                  onChange={e => setEditBranchId(e.target.value)}
                  className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Selecione o ramo</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.icon} {b.display_name}</option>
                  ))}
                </select>
                {editErrors.branchId && <p className="text-sm text-destructive">{editErrors.branchId}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tipo">Tipo de atividade *</Label>
                <select
                  id="edit-tipo"
                  value={editTipo}
                  onChange={e => setEditTipo(e.target.value)}
                  className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {SCHEDULING_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-descricao">Observações *</Label>
              <Textarea id="edit-descricao" rows={4} value={editDescricao} onChange={e => setEditDescricao(e.target.value)} placeholder="Detalhe a atividade..." />
              {editErrors.descricao && <p className="text-sm text-destructive">{editErrors.descricao}</p>}
            </div>

            {/* Attachments in edit mode */}
            {editReq && (
              <SchedulingAttachments
                requestId={editReq.id}
                editable={EDITABLE_STATUSES.includes(editReq.status)}
                attachments={attachmentsByReq[editReq.id] ?? []}
                onAttachmentsChange={(newAtts) => {
                  setAttachmentsByReq(prev => ({ ...prev, [editReq.id]: newAtts }));
                }}
              />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={saving} className="gap-2">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : <><Save className="h-4 w-4" /> Salvar alterações</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attachments Dialog */}
      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anexos da Solicitação</DialogTitle>
            <DialogDescription>
              {attachReq && EDITABLE_STATUSES.includes(attachReq.status)
                ? 'Adicione ou remova arquivos antes da aprovação.'
                : 'Visualize os arquivos anexados.'}
            </DialogDescription>
          </DialogHeader>
          {attachReq && (
            <SchedulingAttachments
              requestId={attachReq.id}
              editable={EDITABLE_STATUSES.includes(attachReq.status)}
              attachments={attachmentsByReq[attachReq.id] ?? []}
              onAttachmentsChange={(newAtts) => {
                setAttachmentsByReq(prev => ({ ...prev, [attachReq.id]: newAtts }));
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={(open) => { if (!rejecting) setRejectOpen(open); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recusar solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da recusa. Esta justificativa ficará registrada no histórico da solicitação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label htmlFor="reject-reason">Justificativa *</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => { setRejectReason(e.target.value); if (rejectError) setRejectError(''); }}
              placeholder="Ex: conflito de agenda, mudança de planos, atividade cancelada..."
              autoFocus
            />
            {rejectError && <p className="text-sm text-destructive">{rejectError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={rejecting}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejecting}
                className="gap-2"
              >
                {rejecting ? <><Loader2 className="h-4 w-4 animate-spin" /> Recusando...</> : <><XCircle className="h-4 w-4" /> Confirmar recusa</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Rejection Details Dialog */}
      <Dialog open={viewRejectOpen} onOpenChange={setViewRejectOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Justificativa da rejeição
            </DialogTitle>
            <DialogDescription>
              {viewRejectReq && (
                <>
                  {getSchedulingTypeLabel(viewRejectReq.tipo)} —{' '}
                  {format(parseLocalDate(viewRejectReq.data), "dd/MM/yyyy", { locale: ptBR })} às {viewRejectReq.horario}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground whitespace-pre-wrap break-words">
              {viewRejectReq?.rejection_reason || 'Sem justificativa registrada.'}
            </div>
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setViewRejectOpen(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MySchedulingRequests;
