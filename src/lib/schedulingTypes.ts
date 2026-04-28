export const SCHEDULING_TYPES = [
  { value: 'reuniao', label: 'Reunião' },
  { value: 'acampamento', label: 'Acampamento' },
  { value: 'atividade_especial', label: 'Atividade Especial' },
  { value: 'outro', label: 'Outro' },
] as const;

export type SchedulingType = typeof SCHEDULING_TYPES[number]['value'];

export const SCHEDULING_STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  confirmado_email: { label: 'Aguardando Confirmação', variant: 'outline' },
  em_aprovacao: { label: 'Em aprovação', variant: 'outline' },
  aprovado: { label: 'Aprovado', variant: 'default' },
  rejeitado: { label: 'Rejeitado', variant: 'destructive' },
};

export const APPROVAL_LEVELS = [
  { nivel: 1, label: 'Coordenador' },
  { nivel: 2, label: 'Diretor' },
] as const;

export function getSchedulingTypeLabel(value: string): string {
  return SCHEDULING_TYPES.find(t => t.value === value)?.label ?? value;
}
