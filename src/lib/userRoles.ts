import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export const ROLE_PRIORITY: AppRole[] = [
  'admin',
  'voluntario',
  'dirigente_gestor',
  'chefe',
  'dirigente',
  'parent',
  'viewer',
];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  voluntario: 'Voluntário',
  dirigente_gestor: 'Dirigente Gestor',
  chefe: 'Chefe Escoteiro',
  dirigente: 'Dirigente',
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
