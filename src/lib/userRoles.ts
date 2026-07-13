import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export const ROLE_PRIORITY: AppRole[] = [
  'admin',
  'diretor_presidente',
  'diretor_administrativo',
  'diretor_financeiro',
  'dirigente_gestor',
  'chefe',
  'dirigente',
  'voluntario',
  'assistente',
  'parent',
  'viewer',
];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  diretor_presidente: 'Diretor Presidente',
  diretor_administrativo: 'Diretor Administrativo',
  diretor_financeiro: 'Diretor Financeiro',
  voluntario: 'Voluntário',
  dirigente_gestor: 'Dirigente Gestor',
  chefe: 'Chefe Escoteiro',
  dirigente: 'Dirigente',
  assistente: 'Assistente',
  parent: 'Pai/Mãe',
  viewer: 'Visitante',
};

export function getPrimaryRole(roles: AppRole[] | null | undefined): AppRole {
  if (!roles || roles.length === 0) return 'viewer';

  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }

  return roles[0] ?? 'viewer';
}
