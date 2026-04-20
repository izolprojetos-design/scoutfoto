import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, Clock, Calendar, MapPin, User } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Status = 'loading' | 'valid' | 'invalid' | 'expired' | 'already' | 'confirming' | 'confirmed' | 'error';

interface RequestSummary {
  nome_responsavel: string;
  data: string;
  horario: string;
  local: string;
  tipo: string;
  descricao: string;
}

const ConfirmScheduling = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [request, setRequest] = useState<RequestSummary | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setErrorMsg('Link inválido — token ausente.');
      return;
    }

    (async () => {
      const { data, error } = await supabase.functions.invoke('confirm-scheduling', {
        method: 'GET',
        body: undefined,
        // pass token via query param
      } as any);

      // The supabase-js invoke uses POST by default; do a manual fetch for GET
      try {
        const url = `https://idrhcwxrifmmvdaitjiz.supabase.co/functions/v1/confirm-scheduling?token=${encodeURIComponent(token)}`;
        const resp = await fetch(url, { method: 'GET' });
        const json = await resp.json();
        if (resp.ok && json.valid) {
          setRequest(json.request);
          if (json.status === 'pendente_analise' || json.status === 'confirmado') {
            setStatus('already');
          } else {
            setStatus('valid');
          }
        } else if (json.error === 'expired') {
          setStatus('expired');
          setErrorMsg(json.message);
        } else {
          setStatus('invalid');
          setErrorMsg(json.message || 'Solicitação não encontrada.');
        }
      } catch (e: any) {
        setStatus('error');
        setErrorMsg('Falha ao validar o link. Tente novamente mais tarde.');
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setStatus('confirming');
    try {
      const url = `https://idrhcwxrifmmvdaitjiz.supabase.co/functions/v1/confirm-scheduling`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await resp.json();
      if (resp.ok && json.success) {
        setStatus('confirmed');
      } else {
        setStatus('error');
        setErrorMsg(json.message || 'Falha ao confirmar.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Erro de conexão.');
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Confirmação de Agendamento</CardTitle>
          <CardDescription>ScoutFoto — Grupo Escoteiro Monte Caburaí 12/RR</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {status === 'loading' && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Validando link...
            </div>
          )}

          {(status === 'valid' || status === 'confirming') && request && (
            <>
              <Alert>
                <Clock className="h-5 w-5" />
                <AlertTitle>Confirme sua solicitação</AlertTitle>
                <AlertDescription>
                  Revise os dados abaixo e clique em <strong>Confirmar</strong> para enviar à coordenação.
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex items-start gap-2"><User className="h-4 w-4 mt-0.5 text-muted-foreground" /><span><strong>Responsável:</strong> {request.nome_responsavel}</span></div>
                <div className="flex items-start gap-2"><Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" /><span><strong>Data:</strong> {formatDate(request.data)} às {request.horario}</span></div>
                <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" /><span><strong>Local:</strong> {request.local}</span></div>
                <div><strong>Tipo:</strong> {request.tipo}</div>
                <div><strong>Descrição:</strong> {request.descricao}</div>
              </div>

              <Button onClick={handleConfirm} disabled={status === 'confirming'} size="lg" className="w-full gap-2">
                {status === 'confirming' ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirmando...</> : <><CheckCircle2 className="h-4 w-4" /> Confirmar solicitação</>}
              </Button>
            </>
          )}

          {status === 'confirmed' && (
            <Alert className="border-primary/30 bg-primary/5">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <AlertTitle>Solicitação confirmada!</AlertTitle>
              <AlertDescription>
                Sua solicitação foi enviada para análise da coordenação. Você será notificado por e-mail quando houver uma decisão.
              </AlertDescription>
            </Alert>
          )}

          {status === 'already' && (
            <Alert>
              <CheckCircle2 className="h-5 w-5" />
              <AlertTitle>Solicitação já confirmada</AlertTitle>
              <AlertDescription>
                Esta solicitação já foi confirmada anteriormente e está em análise (ou já foi processada).
              </AlertDescription>
            </Alert>
          )}

          {status === 'expired' && (
            <Alert variant="destructive">
              <XCircle className="h-5 w-5" />
              <AlertTitle>Link expirado</AlertTitle>
              <AlertDescription>
                {errorMsg} Faça uma nova solicitação no calendário.
              </AlertDescription>
            </Alert>
          )}

          {(status === 'invalid' || status === 'error') && (
            <Alert variant="destructive">
              <XCircle className="h-5 w-5" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <div className="pt-2 text-center">
            <Button variant="ghost" asChild>
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmScheduling;
