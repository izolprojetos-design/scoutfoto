import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, Save, Loader2, ChevronDown, ChevronUp, Users } from 'lucide-react';
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

interface RoleDescription {
  role: AppRole;
  display_name: string;
  description: string;
}

const RolePermissionsManager = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<RoleDescription[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: perms }, { data: roleDescs }, { data: rps }] = await Promise.all([
      supabase.from('permissions').select('*').order('sort_order'),
      supabase.from('role_descriptions').select('*').order('role'),
      supabase.from('role_permissions').select('role, permission_id'),
    ]);

    setPermissions((perms as Permission[]) || []);
    setRoles((roleDescs as RoleDescription[]) || []);
    setRolePermissions((rps as RolePermission[]) || []);
    
    if (perms) {
      const cats: Record<string, boolean> = {};
      [...new Set(perms.map((p: any) => p.category))].forEach(c => { cats[c] = true; });
      setExpandedCategories(cats);
    }
    
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
    setDirty(true);
  };

  const toggleAllInCategory = (role: AppRole, category: string, enable: boolean) => {
    const categoryPermIds = permissions.filter(p => p.category === category).map(p => p.id);
    setRolePermissions(prev => {
      let next = prev.filter(rp => !(rp.role === role && categoryPermIds.includes(rp.permission_id)));
      if (enable) {
        next = [...next, ...categoryPermIds.map(pid => ({ role, permission_id: pid }))];
      }
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      // Delete existing for this role
      await supabase.from('role_permissions').delete().eq('role', selectedRole);

      // Insert new ones
      const toInsert = rolePermissions
        .filter(rp => rp.role === selectedRole)
        .map(rp => ({ role: rp.role, permission_id: rp.permission_id }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('role_permissions').insert(toInsert);
        if (error) throw error;
      }

      toast.success(`Permissões do papel ${selectedRole} salvas com sucesso!`);
      setDirty(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    }
    setSaving(false);
  };

  const categories = [...new Set(permissions.map(p => p.category))];
  const selectedRoleDesc = roles.find(r => r.role === selectedRole);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Role selection sidebar */}
      <Card className="border-0 shadow-lg h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Selecionar Papel
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1">
            {roles.map(r => (
              <button
                key={r.role}
                onClick={() => { setSelectedRole(r.role); setDirty(false); }}
                className={`w-full text-left rounded-lg p-3 transition-colors text-sm ${
                  selectedRole === r.role
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted/50 border border-transparent'
                }`}
              >
                <div className="font-bold flex items-center gap-2">
                  {r.display_name}
                  {r.role === 'admin' && <Badge variant="destructive" className="text-[10px] px-1 py-0">Admin</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permissions panel */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {selectedRole ? (
                <span>Permissões para <span className="text-primary">{selectedRoleDesc?.display_name || selectedRole}</span></span>
              ) : (
                'Permissões por Papel'
              )}
            </CardTitle>
            {selectedRole && selectedRole !== 'admin' && (
              <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            )}
          </div>
          {selectedRole && (
            <p className="text-sm text-muted-foreground mt-1">
              {selectedRoleDesc?.description}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!selectedRole ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Selecione um papel para gerenciar suas permissões globais</p>
            </div>
          ) : selectedRole === 'admin' ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-center">
              <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-medium">Administrador</p>
              <p className="text-sm text-muted-foreground mt-1">
                Administradores possuem todas as permissões automaticamente e não podem ser alterados via interface para evitar bloqueio acidental do sistema.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map(category => {
                const categoryPerms = permissions.filter(p => p.category === category);
                const allChecked = categoryPerms.every(p => hasPermission(selectedRole!, p.id));
                const someChecked = categoryPerms.some(p => hasPermission(selectedRole!, p.id));
                const isExpanded = expandedCategories[category] !== false;

                return (
                  <div key={category} className="rounded-lg border">
                    <button
                      className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={allChecked}
                          className={someChecked && !allChecked ? 'opacity-50' : ''}
                          onCheckedChange={(checked) => {
                            toggleAllInCategory(selectedRole!, category, !!checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          {category}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryPerms.filter(p => hasPermission(selectedRole!, p.id)).length}/{categoryPerms.length}
                        </Badge>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <div className="border-t px-4 py-2 space-y-1">
                        {categoryPerms.map(perm => (
                          <label
                            key={perm.id}
                            className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/20 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={hasPermission(selectedRole!, perm.id)}
                              onCheckedChange={() => togglePermission(selectedRole!, perm.id)}
                            />
                            <span className="text-sm font-medium">{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RolePermissionsManager;