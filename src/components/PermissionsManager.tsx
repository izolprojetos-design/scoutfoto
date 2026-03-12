import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, Save, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Permission {
  id: string;
  key: string;
  name: string;
  category: string;
  sort_order: number;
}

interface RolePermission {
  role: AppRole;
  permission_id: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  chefe: 'Chefe Escoteiro',
  dirigente: 'Dirigente',
  dirigente_gestor: 'Dirigente Gestor',
  
  viewer: 'Visualizador',
  parent: 'Pai/Mãe',
};

const MANAGED_ROLES: AppRole[] = ['admin', 'chefe', 'dirigente', 'dirigente_gestor', 'uploader', 'viewer'];

const PermissionsManager = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [{ data: perms }, { data: rps }] = await Promise.all([
      supabase.from('permissions').select('*').order('sort_order'),
      supabase.from('role_permissions').select('*'),
    ]);
    setPermissions((perms as Permission[]) || []);
    setRolePermissions((rps as RolePermission[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const hasPermission = (role: AppRole, permId: string) =>
    rolePermissions.some(rp => rp.role === role && rp.permission_id === permId);

  const togglePermission = (role: AppRole, permId: string) => {
    if (hasPermission(role, permId)) {
      setRolePermissions(prev => prev.filter(rp => !(rp.role === role && rp.permission_id === permId)));
    } else {
      setRolePermissions(prev => [...prev, { role, permission_id: permId }]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all and re-insert
      for (const role of MANAGED_ROLES) {
        await supabase.from('role_permissions').delete().eq('role', role);
      }

      const toInsert = rolePermissions
        .filter(rp => MANAGED_ROLES.includes(rp.role))
        .map(rp => ({ role: rp.role, permission_id: rp.permission_id }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('role_permissions').insert(toInsert);
        if (error) throw error;
      }

      toast.success('Permissões salvas com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    }
    setSaving(false);
  };

  // Group permissions by category
  const categories = [...new Set(permissions.map(p => p.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissões por Perfil
          </CardTitle>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Permissões
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 pr-4 text-left font-medium text-muted-foreground">Permissão</th>
                {MANAGED_ROLES.map(role => (
                  <th key={role} className="px-3 py-3 text-center">
                    <Badge variant={role === 'admin' ? 'destructive' : 'secondary'} className="text-xs">
                      {ROLE_LABELS[role]}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <>
                  <tr key={`cat-${category}`}>
                    <td colSpan={MANAGED_ROLES.length + 1} className="pt-4 pb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {category}
                      </span>
                    </td>
                  </tr>
                  {permissions.filter(p => p.category === category).map(perm => (
                    <tr key={perm.id} className="border-b border-muted/30 transition-colors hover:bg-muted/20">
                      <td className="py-3 pr-4 font-medium">{perm.name}</td>
                      {MANAGED_ROLES.map(role => (
                        <td key={role} className="px-3 py-3 text-center">
                          <Checkbox
                            checked={hasPermission(role, perm.id)}
                            onCheckedChange={() => togglePermission(role, perm.id)}
                            disabled={role === 'admin'}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          * Administradores sempre possuem todas as permissões e não podem ser alterados.
        </p>
      </CardContent>
    </Card>
  );
};

export default PermissionsManager;
