import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { ROLE_LABELS, ROLE_PRIORITY } from '@/lib/userRoles';

type AppRole = Database['public']['Enums']['app_role'];

export interface AvailableRole {
  value: AppRole;
  label: string;
  description: string;
}

/**
 * Fonte única dos papéis do sistema.
 * Lê a mesma tabela usada pela tela "Configuração do Sistema → Papéis do Sistema"
 * (`role_descriptions`), garantindo que qualquer papel cadastrado/renomeado ali
 * apareça automaticamente nos formulários de criação/edição de usuário e convites.
 *
 * Enquanto a tabela carrega, faz fallback para ROLE_LABELS (evita dropdown vazio).
 */
export function useAvailableRoles(options?: { excludeAdmin?: boolean }) {
  const [roles, setRoles] = useState<AvailableRole[]>(() =>
    ROLE_PRIORITY
      .filter(r => (options?.excludeAdmin ? r !== 'admin' : true))
      .map(r => ({ value: r, label: ROLE_LABELS[r], description: '' }))
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('role_descriptions')
        .select('role, display_name, description');

      if (cancelled) return;

      if (!error && data && data.length > 0) {
        const list = (data as Array<{ role: AppRole; display_name: string; description: string | null }>)
          .filter(r => (options?.excludeAdmin ? r.role !== 'admin' : true))
          .map(r => ({
            value: r.role,
            label: r.display_name || ROLE_LABELS[r.role] || r.role,
            description: r.description || '',
          }))
          .sort((a, b) => {
            const ai = ROLE_PRIORITY.indexOf(a.value);
            const bi = ROLE_PRIORITY.indexOf(b.value);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          });
        setRoles(list);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [options?.excludeAdmin]);

  return { roles, loading };
}
