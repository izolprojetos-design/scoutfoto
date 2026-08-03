import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ApprovalStep {
  id: string;
  nivel: number;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  aprovado_por: string | null;
  motivo_rejeicao: string | null;
  updated_at: string;
  aprovador_nome?: string;
}

const NIVEL_LABELS: Record<number, string> = {
  1: 'Coordenador',
  2: 'Diretor',
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  pendente: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Aguardando' },
  aprovado: { icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10 border-primary/30', label: 'Aprovado' },
  rejeitado: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30', label: 'Rejeitado' },
};

interface Props {
  steps: ApprovalStep[];
  compact?: boolean;
}

const ApprovalTimeline = ({ steps, compact = false }: Props) => {
  const sorted = [...steps].sort((a, b) => a.nivel - b.nivel);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {sorted.map((step, i) => {
          const cfg = STATUS_CONFIG[step.status];
          const Icon = cfg.icon;
          return (
            <div key={step.id} className="flex items-center gap-1.5">
              <div className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border', cfg.bg)}>
                <Icon className={cn('h-3 w-3', cfg.color)} />
                <span className={cn('font-medium', cfg.color)}>N{step.nivel}</span>
              </div>
              {i < sorted.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {sorted.map((step, i) => {
        const cfg = STATUS_CONFIG[step.status];
        const Icon = cfg.icon;
        const isLast = i === sorted.length - 1;

        return (
          <div key={step.id} className="relative flex gap-3 pb-4">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute left-[15px] top-[32px] bottom-0 w-0.5 bg-border" />
            )}

            {/* Icon circle */}
            <div className={cn(
              'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
              step.status === 'aprovado' && 'border-primary bg-primary/10',
              step.status === 'rejeitado' && 'border-destructive bg-destructive/10',
              step.status === 'pendente' && 'border-amber-500 bg-amber-500/10',
            )}>
              <Icon className={cn('h-4 w-4', cfg.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">
                  Nível {step.nivel} — {NIVEL_LABELS[step.nivel] ?? `Nível ${step.nivel}`}
                </span>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', cfg.bg, cfg.color)}>
                  {cfg.label}
                </span>
              </div>

              {step.aprovador_nome && step.status !== 'pendente' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Por: <span className="font-medium text-foreground">{step.aprovador_nome}</span>
                  {' · '}
                  {format(new Date(step.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}

              {step.status === 'pendente' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Aguardando análise do {NIVEL_LABELS[step.nivel]?.toLowerCase() ?? 'aprovador'}
                </p>
              )}

              {step.motivo_rejeicao && (
                <div className="mt-2 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
                  <strong>Motivo:</strong> {step.motivo_rejeicao}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ApprovalTimeline;
