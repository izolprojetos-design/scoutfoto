import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, MapPin, User, Clock, Pencil, Trash2, Loader2, Search, Filter, Mail,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
}

interface Branch {
  id: string;
  display_name: string;
  icon: string;
}

const tipoLabel = (v: string) => SCHEDULING_TYPES.find(t => t.value === v)?.label ?? v;

const AgendamentosManager = () => {
  const { user, roles } = useAuth();
  const isAdmin = roles?.includes('admin');
  const isVoluntario = roles?.includes('voluntario');

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | 'meus' | 'futuros' | 'passados'>('todos');

  const [editing, setEditing] = useState<Agendamento | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: ags }, { data: br }] = await Promise.all([
      supabase.from('agendamentos').select('*').order('data_secao', { ascending: false }),
      supabase.from('branches').select('id, display_name, icon').order('sort_order'),
    ]);
    setAgendamentos((ags as Agendamento[]) ?? []);
    setBranches(br ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const branchLabel = (id: string) => {
    const b = branches.find(br => br.id === id);
    return b ? `${b.icon} ${b.display_name}` : id;
  };

  const canEdit = (a: Agendamento) => isAdmin || a.user_id === user?.id;
  const canDelete = (a: Agendamento) => isAdmin || a.user_id === user?.id;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return agendamentos.filter(a => {
      if (filter === 'meus' && a.user_id !== user?.id) return false;
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
        (a.destinatario_cargo_2 ?? '').toLowerCase().includes(term)
      );
    });
  }, [agendamentos, search, filter, user?.id]);

  const handleDelete = async (id: string) => {
    setSaving(true);
    const { error } = await supabase.from('agendamentos').delete().eq('id', id);
    setSaving(false);
    setDeletingId(null);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Agendamento excluído', description: 'O registro foi removido com sucesso.' });
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
      })
      .eq('id', editing.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Agendamento atualizado', description: 'Alterações salvas com sucesso.' });
    setEditing(null);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando agendamentos...
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, destinatário, e-mail, local, seção..."
            className="pl-9 h-11"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['todos', 'meus', 'futuros', 'passados'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-input',
              )}
            >
              <Filter className="h-3.5 w-3.5 inline mr-1" />
              {f === 'todos' ? 'Todos' : f === 'meus' ? 'Meus' : f === 'futuros' ? 'Futuros' : 'Passados'}
            </button>
          ))}
        </div>
      </div>

      {/* Counter */}
      <div className="text-sm text-muted-foreground">
        {filtered.length} agendamento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">Nenhum agendamento encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(a => {
            const mine = a.user_id === user?.id;
            return (
              <Card key={a.id} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {a.nome_associado}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.secao} {a.dirigente && `· Dirigente: ${a.dirigente}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={mine ? 'default' : 'secondary'} className="text-[10px]">
                        {mine ? 'Meu' : 'Equipe'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {tipoLabel(a.tipo_atividade)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                    <span>{format(parseLocalDate(a.data_secao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                    <Clock className="h-4 w-4 text-primary shrink-0 ml-2" />
                    <span>{a.horario.slice(0, 5)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{a.local}</span>
                  </div>
                  {a.ramo_escoteiro && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground">Ramo:</span>
                      <span>{branchLabel(a.ramo_escoteiro)}</span>
                    </div>
                  )}
                  <div className="mt-2 rounded-md border border-border/60 bg-muted/40 p-2.5 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Destinatário
                    </p>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Nome</p>
                      {a.destinatario_nome ? (
                        <p className="text-sm font-medium uppercase break-words">{a.destinatario_nome}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">Não informado</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Seção</p>
                      <p className={`text-xs break-words ${a.destinatario_secao ? 'text-foreground/90' : 'italic text-muted-foreground'}`}>
                        {a.destinatario_secao || 'Não informada'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Cargos</p>
                      <p className={`text-xs break-words ${(a.destinatario_cargo_1 || a.destinatario_cargo_2) ? 'text-foreground/90' : 'italic text-muted-foreground'}`}>
                        {[a.destinatario_cargo_1, a.destinatario_cargo_2].filter(Boolean).join(' · ') || 'Não informados'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">E-mail</p>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {a.email_para ? (
                          <span className="break-all text-foreground/90">{a.email_para}</span>
                        ) : (
                          <span className="italic text-muted-foreground">Não informado</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {a.observacoes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t mt-2">
                      {a.observacoes}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    {canEdit(a) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(a)}
                        className="h-8 gap-1"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                    )}
                    {canDelete(a) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingId(a.id)}
                        className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar agendamento</DialogTitle>
            <DialogDescription>Atualize as informações do agendamento.</DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div className="md:col-span-2">
                <Label htmlFor="ed-nome">Nome do associado</Label>
                <Input
                  id="ed-nome"
                  value={editing.nome_associado}
                  onChange={(e) => setEditing({ ...editing, nome_associado: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="ed-dir">Dirigente</Label>
                <Input
                  id="ed-dir"
                  value={editing.dirigente}
                  onChange={(e) => setEditing({ ...editing, dirigente: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="ed-tipo">Tipo de atividade</Label>
                <select
                  id="ed-tipo"
                  value={editing.tipo_atividade}
                  onChange={(e) => setEditing({ ...editing, tipo_atividade: e.target.value })}
                  className="mt-1.5 flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SCHEDULING_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="ed-data">Data</Label>
                <Input
                  id="ed-data"
                  type="date"
                  value={editing.data_secao}
                  onChange={(e) => setEditing({ ...editing, data_secao: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="ed-hora">Horário</Label>
                <Input
                  id="ed-hora"
                  type="time"
                  value={editing.horario.slice(0, 5)}
                  onChange={(e) => setEditing({ ...editing, horario: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="ed-local">Local</Label>
                <Input
                  id="ed-local"
                  value={editing.local}
                  onChange={(e) => setEditing({ ...editing, local: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="ed-ramo">Ramo escoteiro</Label>
                <select
                  id="ed-ramo"
                  value={editing.ramo_escoteiro}
                  onChange={(e) => setEditing({ ...editing, ramo_escoteiro: e.target.value })}
                  className="mt-1.5 flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecione...</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.icon} {b.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 mt-2 rounded-md border border-border/60 bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Destinatário
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label htmlFor="ed-dest-nome">Nome do destinatário</Label>
                    <Input
                      id="ed-dest-nome"
                      value={editing.destinatario_nome ?? ''}
                      onChange={(e) => setEditing({ ...editing, destinatario_nome: e.target.value })}
                      className="mt-1.5 uppercase"
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ed-dest-secao">Seção</Label>
                    <Input
                      id="ed-dest-secao"
                      value={editing.destinatario_secao ?? ''}
                      onChange={(e) => setEditing({ ...editing, destinatario_secao: e.target.value })}
                      className="mt-1.5"
                      placeholder="Ex: Escoteiro"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ed-dest-cargo1">Cargo 1</Label>
                    <Input
                      id="ed-dest-cargo1"
                      value={editing.destinatario_cargo_1 ?? ''}
                      onChange={(e) => setEditing({ ...editing, destinatario_cargo_1: e.target.value })}
                      className="mt-1.5"
                      placeholder="Cargo principal"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="ed-emailpara">E-mail</Label>
                    <Input
                      id="ed-emailpara"
                      type="email"
                      value={editing.email_para}
                      onChange={(e) => setEditing({ ...editing, email_para: e.target.value })}
                      className="mt-1.5"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="ed-obs">Observações</Label>
                <Textarea
                  id="ed-obs"
                  value={editing.observacoes}
                  onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })}
                  rows={4}
                  className="mt-1.5"
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
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agendamento será permanentemente removido.
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
    </div>
  );
};

export default AgendamentosManager;
