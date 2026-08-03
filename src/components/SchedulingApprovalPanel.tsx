import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/scoutUtils';
import { SCHEDULING_STATUS_LABELS, getSchedulingTypeLabel, APPROVAL_LEVELS } from '@/lib/schedulingTypes';
import { logAudit } from '@/lib/auditLog';
import { toTitleCase } from '@/lib/formatting';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Loader2, CheckCircle2, XCircle, Eye, Calendar, MapPin, Clock, User,
  Search, Filter, CalendarPlus, Paperclip,
} from 'lucide-react';
import SchedulingAttachments from '@/components/SchedulingAttachments';
import ApprovalTimeline, { type ApprovalStep } from '@/components/ApprovalTimeline';

interface SchedulingRequest {
  id: string;
  user_id: string;
  nome_responsavel: string;
  email: string;
  destinatario_email: string;
  data: string;
  horario: string;
  local: string;
  tipo: string;
  descricao: string;
  status: string;
  branch_id: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  event_id: string | null;
}

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

const SchedulingApprovalPanel = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SchedulingRequest[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('confirmado_email');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<SchedulingRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [detailAttachments, setDetailAttachments] = useState<{ id: string; file_name: string; file_path: string; file_size: number; content_type: string }[]>([]);
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStep[]>([]);
  const [allApprovals, setAllApprovals] = useState<Record<string, ApprovalStep[]>>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('scheduling_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      if (statusFilter === 'confirmado_email') {
        // Show both confirmado_email and em_aprovacao
        query = query.in('status', ['confirmado_email', 'em_aprovacao']);
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Erro ao carregar solicitações.');
    } else {
      setRequests(data || []);
      // Fetch all approval steps for these requests
      if (data && data.length > 0) {
        const ids = data.map(r => r.id);
        const { data: approvals } = await supabase
          .from('aprovacoes')
          .select('*')
          .in('agendamento_id', ids);

        // Fetch approver names
        const approverIds = [...new Set((approvals ?? []).filter(a => a.aprovado_por).map(a => a.aprovado_por!))];
        let profileMap: Record<string, string> = {};
        if (approverIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', approverIds);
          profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.name]));
        }

        const grouped: Record<string, ApprovalStep[]> = {};
        for (const a of approvals ?? []) {
          if (!grouped[a.agendamento_id]) grouped[a.agendamento_id] = [];
          grouped[a.agendamento_id].push({
            ...a,
            status: a.status as 'pendente' | 'aprovado' | 'rejeitado',
            aprovador_nome: a.aprovado_por ? profileMap[a.aprovado_por] ?? '' : undefined,
          });
        }
        setAllApprovals(grouped);
      }
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    supabase.from('branches').select('*').then(({ data }) => setBranches(data || []));
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const getBranch = (bId: string | null) => bId ? branches.find(b => b.id === bId) : null;

  const formatDate = (d: string) => {
    try {
      return format(parseLocalDate(d), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return d;
    }
  };

  /** Initialize approval steps for a request (creates level 1 & 2 as pending) */
  const initApprovalSteps = async (requestId: string) => {
    const steps = APPROVAL_LEVELS.map(l => ({
      agendamento_id: requestId,
      nivel: l.nivel,
      status: 'pendente' as const,
    }));

    const { error } = await supabase.from('aprovacoes').insert(steps);
    if (error) throw error;

    // Update request status to em_aprovacao
    await supabase
      .from('scheduling_requests')
      .update({ status: 'em_aprovacao' })
      .eq('id', requestId);
  };

  /** Get the current pending level for a request */
  const getCurrentPendingLevel = (requestId: string): ApprovalStep | null => {
    const steps = allApprovals[requestId] ?? [];
    const sorted = [...steps].sort((a, b) => a.nivel - b.nivel);
    return sorted.find(s => s.status === 'pendente') ?? null;
  };

  const isRejected = (requestId: string): boolean => {
    const steps = allApprovals[requestId] ?? [];
    return steps.some(s => s.status === 'rejeitado');
  };

  const allApproved = (requestId: string): boolean => {
    const steps = allApprovals[requestId] ?? [];
    return steps.length === APPROVAL_LEVELS.length && steps.every(s => s.status === 'aprovado');
  };

  const handleStartApproval = async (req: SchedulingRequest) => {
    if (!user) return;
    setProcessing(true);
    try {
      await initApprovalSteps(req.id);
      toast.success('Fluxo de aprovação iniciado!');
      fetchRequests();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveLevel = async (req: SchedulingRequest) => {
    if (!user) return;
    const pendingStep = getCurrentPendingLevel(req.id);
    if (!pendingStep) return;

    setProcessing(true);
    try {
      // Approve current level
      const { error } = await supabase
        .from('aprovacoes')
        .update({
          status: 'aprovado',
          aprovado_por: user.id,
        })
        .eq('id', pendingStep.id);

      if (error) throw error;

      await logAudit(user.id, 'scheduling_approve', undefined, {
        request_id: req.id,
        nivel: pendingStep.nivel,
        nivel_label: APPROVAL_LEVELS.find(l => l.nivel === pendingStep.nivel)?.label,
      });

      // Check if this was the last level
      const nextLevel = APPROVAL_LEVELS.find(l => l.nivel > pendingStep.nivel);
      if (!nextLevel) {
        // All levels approved — create the event
        const assunto = (req.descricao || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        const eventName = assunto
          ? `${getSchedulingTypeLabel(req.tipo)} — ${assunto} — ${req.nome_responsavel}`
          : `${getSchedulingTypeLabel(req.tipo)} — ${req.nome_responsavel}`;
        const { data: newEvent, error: eventError } = await supabase
          .from('events')
          .insert({
            name: eventName,
            description: req.descricao || '',
            event_date: req.data,
            location: req.local,
            branch_id: req.branch_id,
            created_by: user.id,
            source: 'scheduling',
          })
          .select('id')
          .single();

        if (eventError) throw eventError;

        await supabase
          .from('scheduling_requests')
          .update({
            status: 'aprovado',
            approved_at: new Date().toISOString(),
            approved_by: user.id,
            event_id: newEvent.id,
          })
          .eq('id', req.id);

        // Notify requester
        const branch = getBranch(req.branch_id);
        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'scheduling-approved',
            recipientEmail: req.email,
            idempotencyKey: `scheduling-approved-${req.id}`,
            templateData: {
              nomeResponsavel: req.nome_responsavel,
              data: formatDate(req.data),
              horario: req.horario,
              local: req.local,
              tipo: getSchedulingTypeLabel(req.tipo),
              ramo: branch ? `${branch.icon} ${branch.display_name}` : '',
              assunto: req.descricao,
            },
          },
        }).catch(err => console.error('Failed to send approval email', err));

        toast.success('Todos os níveis aprovados! Evento criado no calendário.');
      } else {
        toast.success(`Nível ${pendingStep.nivel} aprovado. Aguardando nível ${nextLevel.nivel}.`);
      }

      setDetailOpen(false);
      fetchRequests();
    } catch (err: any) {
      toast.error(`Erro ao aprovar: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectLevel = async () => {
    if (!user || !selectedRequest) return;
    if (!rejectionReason.trim()) {
      toast.error('Informe o motivo da rejeição.');
      return;
    }

    const pendingStep = getCurrentPendingLevel(selectedRequest.id);
    if (!pendingStep) return;

    setProcessing(true);
    try {
      // Reject current level
      const { error } = await supabase
        .from('aprovacoes')
        .update({
          status: 'rejeitado',
          aprovado_por: user.id,
          motivo_rejeicao: rejectionReason.trim(),
        })
        .eq('id', pendingStep.id);

      if (error) throw error;

      // Update the scheduling request to rejected
      await supabase
        .from('scheduling_requests')
        .update({
          status: 'rejeitado',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          rejection_reason: `[Nível ${pendingStep.nivel}] ${rejectionReason.trim()}`,
        })
        .eq('id', selectedRequest.id);

      await logAudit(user.id, 'scheduling_reject', undefined, {
        request_id: selectedRequest.id,
        nivel: pendingStep.nivel,
        reason: rejectionReason.trim(),
      });

      // Notify requester
      const branch = getBranch(selectedRequest.branch_id);
      supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'scheduling-rejected',
          recipientEmail: selectedRequest.email,
          idempotencyKey: `scheduling-rejected-${selectedRequest.id}`,
          templateData: {
            nomeResponsavel: selectedRequest.nome_responsavel,
            data: formatDate(selectedRequest.data),
            horario: selectedRequest.horario,
            local: selectedRequest.local,
            tipo: getSchedulingTypeLabel(selectedRequest.tipo),
            ramo: branch ? `${branch.icon} ${branch.display_name}` : '',
            assunto: selectedRequest.descricao,
            motivoRejeicao: `Rejeitado no nível ${pendingStep.nivel} (${APPROVAL_LEVELS.find(l => l.nivel === pendingStep.nivel)?.label}): ${rejectionReason.trim()}`,
          },
        },
      }).catch(err => console.error('Failed to send rejection email', err));

      toast.success('Solicitação rejeitada.');
      setRejectOpen(false);
      setDetailOpen(false);
      setRejectionReason('');
      fetchRequests();
    } catch (err: any) {
      toast.error(`Erro ao rejeitar: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const filtered = requests.filter(r =>
    r.nome_responsavel.toLowerCase().includes(search.toLowerCase()) ||
    r.local.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const openDetail = async (req: SchedulingRequest) => {
    setSelectedRequest(req);
    setDetailOpen(true);

    const [{ data: atts }, { data: steps }] = await Promise.all([
      supabase.from('agendamento_anexos')
        .select('id, file_name, file_path, file_size, content_type')
        .eq('agendamento_id', req.id)
        .order('file_name'),
      supabase.from('aprovacoes').select('*').eq('agendamento_id', req.id).order('nivel'),
    ]);
    setDetailAttachments(atts ?? []);

    // Fetch names for steps
    const approverIds = [...new Set((steps ?? []).filter(s => s.aprovado_por).map(s => s.aprovado_por!))];
    let profileMap: Record<string, string> = {};
    if (approverIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, name').in('user_id', approverIds);
      profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.name]));
    }

    setApprovalSteps(
      (steps ?? []).map(s => ({
        ...s,
        status: s.status as 'pendente' | 'aprovado' | 'rejeitado',
        aprovador_nome: s.aprovado_por ? profileMap[s.aprovado_por] ?? '' : undefined,
      }))
    );
  };

  const pendingStep = selectedRequest ? getCurrentPendingLevel(selectedRequest.id) : null;
  const hasApprovalSteps = selectedRequest ? (allApprovals[selectedRequest.id]?.length ?? 0) > 0 : false;
  const canStartApproval = selectedRequest?.status === 'confirmado_email' && !hasApprovalSteps;
  const canApproveReject = selectedRequest?.status === 'em_aprovacao' && pendingStep && !isRejected(selectedRequest.id);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'confirmado_email', label: 'Aguardando Confirmação', color: 'text-amber-600' },
          { key: 'em_aprovacao', label: 'Em aprovação', color: 'text-blue-600' },
          { key: 'aprovado', label: 'Aprovados', color: 'text-primary' },
          { key: 'rejeitado', label: 'Rejeitados', color: 'text-destructive' },
          { key: 'pendente', label: 'Aguardando e-mail', color: 'text-muted-foreground' },
        ].map(({ key, label, color }) => (
          <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(key)}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{statusCounts[key] || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por responsável, local ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="confirmado_email">Aguardando Confirmação</SelectItem>
            <SelectItem value="em_aprovacao">Em aprovação</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Nenhuma solicitação encontrada.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Aprovação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(req => {
                    const statusInfo = SCHEDULING_STATUS_LABELS[req.status];
                    const branch = getBranch(req.branch_id);
                    const steps = allApprovals[req.id] ?? [];
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{toTitleCase(req.nome_responsavel)}</TableCell>
                        <TableCell>{formatDate(req.data)} {req.horario}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {branch && <span>{branch.icon}</span>}
                            {getSchedulingTypeLabel(req.tipo)}
                          </div>
                        </TableCell>
                        <TableCell>{toTitleCase(req.local) || <span className="italic text-muted-foreground">Não informado</span>}</TableCell>
                        <TableCell>
                          {steps.length > 0 ? (
                            <ApprovalTimeline steps={steps} compact />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo?.variant || 'secondary'}>
                            {statusInfo?.label || req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(req)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div><strong>Responsável:</strong> {toTitleCase(selectedRequest.nome_responsavel)}</div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div><strong>Data:</strong> {formatDate(selectedRequest.data)}</div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div><strong>Horário:</strong> {selectedRequest.horario}</div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div><strong>Local:</strong> {toTitleCase(selectedRequest.local) || <span className="italic text-muted-foreground">Não informado</span>}</div>
                </div>
                <div><strong>Tipo:</strong> {getSchedulingTypeLabel(selectedRequest.tipo)}</div>
                <div><strong>De E-mail:</strong> {selectedRequest.email}</div>
                {selectedRequest.destinatario_email && (
                  <div><strong>Para E-mail:</strong> {selectedRequest.destinatario_email}</div>
                )}
                {selectedRequest.descricao && (
                  <div><strong>Observações:</strong> {selectedRequest.descricao}</div>
                )}
                {selectedRequest.branch_id && (
                  <div><strong>Ramo:</strong> {getBranch(selectedRequest.branch_id)?.icon} {getBranch(selectedRequest.branch_id)?.display_name}</div>
                )}
              </div>

              {/* Approval Timeline */}
              {approvalSteps.length > 0 && (
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <CalendarPlus className="h-4 w-4" />
                    Fluxo de Aprovação
                  </h4>
                  <ApprovalTimeline steps={approvalSteps} />
                </div>
              )}

              {/* Attachments */}
              {detailAttachments.length > 0 && (
                <SchedulingAttachments
                  requestId={selectedRequest.id}
                  editable={false}
                  attachments={detailAttachments}
                  onAttachmentsChange={() => {}}
                />
              )}
              {detailAttachments.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> Nenhum anexo
                </p>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant={SCHEDULING_STATUS_LABELS[selectedRequest.status]?.variant || 'secondary'}>
                  {SCHEDULING_STATUS_LABELS[selectedRequest.status]?.label || selectedRequest.status}
                </Badge>
              </div>

              {selectedRequest.rejection_reason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <strong>Motivo da rejeição:</strong> {selectedRequest.rejection_reason}
                </div>
              )}

              {selectedRequest.event_id && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex items-center gap-2">
                  <CalendarPlus className="h-4 w-4 text-primary" />
                  Evento criado no calendário.
                </div>
              )}

              {/* Start approval flow */}
              {canStartApproval && (
                <div className="pt-2">
                  <Button
                    onClick={() => handleStartApproval(selectedRequest)}
                    disabled={processing}
                    className="w-full gap-2"
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                    Iniciar fluxo de aprovação
                  </Button>
                </div>
              )}

              {/* Approve / Reject current level */}
              {canApproveReject && pendingStep && (
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleApproveLevel(selectedRequest)}
                    disabled={processing}
                    className="flex-1 gap-2"
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Aprovar Nível {pendingStep.nivel} ({APPROVAL_LEVELS.find(l => l.nivel === pendingStep.nivel)?.label})
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setRejectionReason('');
                      setRejectOpen(true);
                    }}
                    disabled={processing}
                    className="flex-1 gap-2"
                  >
                    <XCircle className="h-4 w-4" /> Rejeitar
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Criado em {format(new Date(selectedRequest.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject confirmation */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da rejeição. O solicitante será informado e o fluxo será encerrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="rejection-reason">Motivo</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Ex: Data indisponível, conflito de horário..."
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectLevel}
              disabled={processing || !rejectionReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar rejeição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SchedulingApprovalPanel;
