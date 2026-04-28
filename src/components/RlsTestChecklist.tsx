import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Play, Trash2, CheckCircle2, XCircle, FlaskConical } from 'lucide-react';

type Persona = 'remetente' | 'destinatario' | 'admin' | 'terceiro';

interface RpcResult {
  is_sender: boolean;
  is_recipient: boolean;
  has_admin_role: boolean;
  can_view: boolean;
  reason: string;
  persona_user_id: string | null;
}

interface Scenario {
  persona: Persona;
  label: string;
  description: string;
  expected: 'visivel' | 'oculto';
  email: string;
  status: 'idle' | 'running' | 'pass' | 'fail';
  detail?: string;
  rpc?: RpcResult;
}

const DEFAULT_SCENARIOS = (currentEmail: string): Scenario[] => [
  {
    persona: 'remetente',
    label: 'Remetente (você)',
    description: 'Criador do agendamento — deve ver',
    expected: 'visivel',
    email: currentEmail,
    status: 'idle',
  },
  {
    persona: 'destinatario',
    label: 'Destinatário',
    description: 'E-mail do campo "Para" — deve ver',
    expected: 'visivel',
    email: '',
    status: 'idle',
  },
  {
    persona: 'admin',
    label: 'Administrador',
    description: 'Qualquer admin — deve ver',
    expected: 'visivel',
    email: '',
    status: 'idle',
  },
  {
    persona: 'terceiro',
    label: 'Terceiro (sem vínculo)',
    description: 'Usuário sem relação — NÃO deve ver',
    expected: 'oculto',
    email: '',
    status: 'idle',
  },
];

const RlsTestChecklist = () => {
  const { user, profile, isAdmin } = useAuth();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [testRecordId, setTestRecordId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (profile?.email) {
      setScenarios(DEFAULT_SCENARIOS(profile.email));
    }
  }, [profile?.email]);

  if (!isAdmin) return null;

  const updateScenario = (persona: Persona, patch: Partial<Scenario>) => {
    setScenarios(prev => prev.map(s => (s.persona === persona ? { ...s, ...patch } : s)));
  };

  const createTestRecord = async () => {
    if (!user || !profile) return;
    if (!recipientEmail.trim()) {
      toast.error('Informe o e-mail do destinatário do teste');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from('agendamentos')
      .insert({
        user_id: user.id,
        nome_associado: profile.name,
        email_de: profile.email,
        email_para: recipientEmail.trim().toLowerCase(),
        destinatario_nome: 'TESTE RLS',
        data_secao: new Date().toISOString().slice(0, 10),
        horario: '12:00',
        local: 'Teste de visibilidade RLS',
        tipo_atividade: 'reuniao',
        ramo_escoteiro: 'teste',
        secao: '',
        cargo_1: '',
        cargo_2: '',
        dirigente: profile.name,
        observacoes: '[REGISTRO DE TESTE RLS] Pode ser excluído.',
        status: 'confirmado',
      })
      .select('id')
      .single();

    setCreating(false);
    if (error) {
      toast.error('Erro ao criar registro: ' + error.message);
      return;
    }
    setTestRecordId(data.id);
    updateScenario('destinatario', { email: recipientEmail.trim().toLowerCase() });
    toast.success('Registro de teste criado. Execute a validação.');
  };

  const runValidation = async () => {
    if (!testRecordId) {
      toast.error('Crie primeiro um registro de teste');
      return;
    }
    setRunning(true);

    // Marca todos como running
    setScenarios(prev => prev.map(s => ({ ...s, status: 'running' as const, detail: undefined })));

    // Validação server-side: a função RPC reproduz a regra da policy no banco
    // (SECURITY DEFINER, restrita a admins) e retorna o veredito real.
    const results = await Promise.all(
      scenarios.map(async (s) => {
        if (!s.email.trim()) {
          return { persona: s.persona, ok: false, detail: 'E-mail não informado' };
        }

        const { data, error } = await supabase.rpc('admin_check_agendamento_visibility', {
          p_agendamento_id: testRecordId,
          p_email: s.email.trim(),
        });

        if (error) {
          return { persona: s.persona, ok: false, detail: 'Erro RPC: ' + error.message };
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          return { persona: s.persona, ok: false, detail: 'Sem retorno do servidor' };
        }

        const podeVer = !!row.can_view;
        const expectedVisible = s.expected === 'visivel';
        const ok = podeVer === expectedVisible;

        return {
          persona: s.persona,
          ok,
          detail: `${podeVer ? '✓ Visível' : '✗ Oculto'} — ${row.reason}`,
        };
      })
    );

    setScenarios(prev =>
      prev.map(s => {
        const r = results.find(x => x.persona === s.persona);
        return r
          ? { ...s, status: r.ok ? 'pass' : 'fail', detail: r.detail }
          : s;
      })
    );

    setRunning(false);
    const allOk = results.every(r => r.ok);
    if (allOk) toast.success('Todos os cenários passaram ✓');
    else toast.warning('Alguns cenários falharam — revise os detalhes');
  };

  const cleanup = async () => {
    if (!testRecordId) return;
    const { error } = await supabase.from('agendamentos').delete().eq('id', testRecordId);
    if (error) {
      toast.error('Erro ao remover: ' + error.message);
      return;
    }
    setTestRecordId(null);
    setScenarios(profile?.email ? DEFAULT_SCENARIOS(profile.email) : []);
    toast.success('Registro de teste removido');
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Checklist de Testes RLS — Agendamentos
        </CardTitle>
        <CardDescription>
          Cria um agendamento de teste e valida a visibilidade para Remetente, Destinatário, Administrador e Terceiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="rls-recipient">E-mail do destinatário do teste</Label>
            <Input
              id="rls-recipient"
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              placeholder="destinatario@exemplo.com"
              disabled={!!testRecordId}
            />
          </div>
          <Button onClick={createTestRecord} disabled={creating || !!testRecordId}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar registro de teste'}
          </Button>
          {testRecordId && (
            <Button variant="destructive" onClick={cleanup}>
              <Trash2 className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cenário</TableHead>
                <TableHead>E-mail simulado</TableHead>
                <TableHead>Esperado</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map(s => (
                <TableRow key={s.persona}>
                  <TableCell>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="email"
                      value={s.email}
                      onChange={e => updateScenario(s.persona, { email: e.target.value })}
                      placeholder={s.persona === 'admin' ? 'admin@exemplo.com' : s.persona === 'terceiro' ? 'outro@exemplo.com' : ''}
                      className="h-9"
                      disabled={s.persona === 'remetente'}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.expected === 'visivel' ? 'default' : 'secondary'}>
                      {s.expected === 'visivel' ? 'Visível' : 'Oculto'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.status === 'idle' && <span className="text-xs text-muted-foreground">—</span>}
                    {s.status === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {s.status === 'pass' && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">PASS — {s.detail}</span>
                      </div>
                    )}
                    {s.status === 'fail' && (
                      <div className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs">FAIL — {s.detail}</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button onClick={runValidation} disabled={running || !testRecordId}>
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Executar validação
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Validação executada no servidor via função
          <code className="mx-1 px-1 rounded bg-muted">admin_check_agendamento_visibility</code>
          (SECURITY DEFINER, restrita a admins), reproduzindo a regra real da policy
          <code className="mx-1 px-1 rounded bg-muted">Users can view own or recipient agendamentos</code>.
          Lembre-se de remover o registro ao final.
        </p>
      </CardContent>
    </Card>
  );
};

export default RlsTestChecklist;
