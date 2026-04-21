import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/scoutUtils';
import { SCHEDULING_STATUS_LABELS, getSchedulingTypeLabel } from '@/lib/schedulingTypes';
import { logAudit } from '@/lib/auditLog';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('scheduling_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Erro ao carregar solicitações.');
    } else {
      setRequests(data || []);
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

  const handleApprove = async (req: SchedulingRequest) => {
    if (!user) return;
    setProcessing(true);
    try {
      // 1. Create the event in the calendar
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          name: `${getSchedulingTypeLabel(req.tipo)} — ${req.nome_responsavel}`,
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

      // 2. Update the scheduling request status
      const { error: updateError } = await supabase
        .from('scheduling_requests')
        .update({
          status: 'aprovado',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          event_id: newEvent.id,
        })
        .eq('id', req.id);

      if (updateError) throw updateError;

      await logAudit(user.id, 'scheduling_approve', undefined, {
        request_id: req.id,
        event_id: newEvent.id,
        responsavel: req.nome_responsavel,
      });

      // Notify requester via email (fire-and-forget)
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

      toast.success('Solicitação aprovada e evento criado no calendário!');
      setDetailOpen(false);
      fetchRequests();
    } catch (err: any) {
      toast.error(`Erro ao aprovar: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!user || !selectedRequest) return;
    if (!rejectionReason.trim()) {
      toast.error('Informe o motivo da rejeição.');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('scheduling_requests')
        .update({
          status: 'rejeitado',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      await logAudit(user.id, 'scheduling_reject', undefined, {
        request_id: selectedRequest.id,
        responsavel: selectedRequest.nome_responsavel,
        reason: rejectionReason.trim(),
      });

      // Notify requester via email (fire-and-forget)
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
            motivoRejeicao: rejectionReason.trim(),
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

  const openDetail = (req: SchedulingRequest) => {
    setSelectedRequest(req);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'confirmado_email', label: 'Aguardando aprovação', color: 'text-amber-600' },
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
            <SelectItem value="confirmado_email">Confirmado (e-mail)</SelectItem>
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
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(req => {
                    const statusInfo = SCHEDULING_STATUS_LABELS[req.status];
                    const branch = getBranch(req.branch_id);
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.nome_responsavel}</TableCell>
                        <TableCell>{formatDate(req.data)} {req.horario}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {branch && <span>{branch.icon}</span>}
                            {getSchedulingTypeLabel(req.tipo)}
                          </div>
                        </TableCell>
                        <TableCell>{req.local}</TableCell>
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
                  <div><strong>Responsável:</strong> {selectedRequest.nome_responsavel}</div>
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
                  <div><strong>Local:</strong> {selectedRequest.local}</div>
                </div>
                <div><strong>Tipo:</strong> {getSchedulingTypeLabel(selectedRequest.tipo)}</div>
                <div><strong>De E-mail:</strong> {selectedRequest.email}</div>
                {selectedRequest.destinatario_email && (
                  <div><strong>Para E-mail:</strong> {selectedRequest.destinatario_email}</div>
                )}
                {selectedRequest.descricao && (
                  <div><strong>Assunto:</strong> {selectedRequest.descricao}</div>
                )}
                {selectedRequest.branch_id && (
                  <div><strong>Ramo:</strong> {getBranch(selectedRequest.branch_id)?.icon} {getBranch(selectedRequest.branch_id)?.display_name}</div>
                )}
              </div>

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

              {selectedRequest.status === 'confirmado_email' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={processing}
                    className="flex-1 gap-2"
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Aprovar e criar evento
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
              Informe o motivo da rejeição. O solicitante será informado.
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
              onClick={handleReject}
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