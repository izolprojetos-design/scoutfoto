import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Clock, MapPin, Trash2, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { parseLocalDate } from '@/lib/scoutUtils';
import { SCHEDULING_STATUS_LABELS, getSchedulingTypeLabel } from '@/lib/schedulingTypes';

interface Request {
  id: string;
  nome_responsavel: string;
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

const MySchedulingRequests = ({ refreshKey }: Props) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: reqs }, { data: br }] = await Promise.all([
      supabase.from('scheduling_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('branches').select('id, display_name, icon'),
    ]);
    setRequests(reqs ?? []);
    setBranches(br ?? []);
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

  const getBranch = (id: string | null) => branches.find(b => b.id === id);

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
    <div className="space-y-3">
      {requests.map((r, i) => {
        const status = SCHEDULING_STATUS_LABELS[r.status] ?? { label: r.status, variant: 'secondary' as const };
        const branch = getBranch(r.branch_id);
        return (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
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
                    <span>{r.local}</span>
                  </div>
                </div>

                {branch && (
                  <Badge variant="outline" className="mt-3 font-normal">
                    {branch.icon} {branch.display_name}
                  </Badge>
                )}

                {r.descricao && (
                  <p className="mt-3 text-sm text-foreground/80 border-l-2 border-muted pl-3">{r.descricao}</p>
                )}

                {r.rejection_reason && (
                  <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <strong>Motivo da rejeição:</strong> {r.rejection_reason}
                  </div>
                )}

                {r.status === 'pendente' && (
                  <div className="mt-4 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Excluir
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};

export default MySchedulingRequests;
