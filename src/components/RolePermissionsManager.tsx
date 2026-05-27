import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Shield, Save, Loader2, ChevronDown, ChevronUp, Users, Pencil, X } from 'lucide-react';
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
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  // Editing state for role identity
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [{ data: perms }, { data: roleDescs }, { data: rps }, { data: userRoles }] = await Promise.all([
      supabase.from('permissions').select('*').order('sort_order'),
      supabase.from('role_descriptions').select('*').order('role'),
      supabase.from('role_permissions').select('role, permission_id'),
      supabase.from('user_roles').select('role'),
    ]);

    setPermissions((perms as Permission[]) || []);
    setRoles(((roleDescs as RoleDescription[]) || []).sort((a, b) => a.display_name.localeCompare(b.display_name, 'pt-BR')));
    setRolePermissions((rps as RolePermission[]) || []);
    
    // Count users per role
    const counts: Record<string, number> = {};
    (userRoles || []).forEach((ur: any) => {
      counts[ur.role] = (counts[ur.role] || 0) + 1;
    });
    setUserCounts(counts);

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

  const handleSaveAll = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      // 1. Save role identity if editing
      if (isEditingIdentity) {
        const { error: identityError } = await supabase
          .from('role_descriptions')
          .update({ display_name: editName.trim(), description: editDesc.trim() })
          .eq('role', selectedRole);
        
        if (identityError) throw identityError;
        setIsEditingIdentity(false);
      }

      // 2. Save permissions
      await supabase.from('role_permissions').delete().eq('role', selectedRole);

      const toInsert = rolePermissions
        .filter(rp => rp.role === selectedRole)
        .map(rp => ({ role: rp.role, permission_id: rp.permission_id }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('role_permissions').insert(toInsert);
        if (error) throw error;
      }

      toast.success('Alterações salvas com sucesso!');
      setDirty(false);
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    }
    setSaving(false);
  };

  const startEditing = () => {
    const role = roles.find(r => r.role === selectedRole);
    if (role) {
      setEditName(role.display_name);
      setEditDesc(role.description || '');
      setIsEditingIdentity(true);
    }
  };

  const cancelEditing = () => {
    setIsEditingIdentity(false);
    setEditName('');
    setEditDesc('');
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
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Papéis do Sistema
          </CardTitle>
          <CardDescription className="text-xs">
            Selecione para ver e gerenciar permissões.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1">
            {roles.map(r => (
              <button
                key={r.role}
                onClick={() => { 
                  setSelectedRole(r.role); 
                  setDirty(false); 
                  setIsEditingIdentity(false);
                }}
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
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                  <Users className="h-2.5 w-2.5" />
                  {userCounts[r.role] || 0} usuário{(userCounts[r.role] || 0) !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permissions panel */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-1">
              {selectedRole ? (
                isEditingIdentity ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome de exibição</label>
                      <Input
                        value={editName}
                        onChange={e => { setEditName(e.target.value); setDirty(true); }}
                        placeholder="Nome do papel"
                        className="font-bold text-lg h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</label>
                      <Textarea
                        value={editDesc}
                        onChange={e => { setEditDesc(e.target.value); setDirty(true); }}
                        placeholder="Descreva as responsabilidades deste papel..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <CardTitle className="flex items-center gap-2 text-xl font-bold">
                      <Shield className="h-5 w-5 text-primary" />
                      <span>{selectedRoleDesc?.display_name || selectedRole}</span>
                      <span className="text-xs text-muted-foreground font-mono font-normal">({selectedRole})</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedRoleDesc?.description || 'Sem descrição definida.'}
                    </p>
                  </>
                )
              ) : (
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Gerenciar Permissões
                </CardTitle>
              )}
            </div>
            
            <div className="flex gap-2 shrink-0">
              {selectedRole && selectedRole !== 'admin' && (
                <>
                  {!isEditingIdentity ? (
                    <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5 h-9">
                      <Pencil className="h-3.5 w-3.5" />
                      Editar Nome
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={cancelEditing} className="gap-1.5 h-9">
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </Button>
                  )}
                  <Button onClick={handleSaveAll} disabled={saving || !dirty} className="gap-2 h-9 px-4 font-bold">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {!selectedRole ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Selecione um papel à esquerda para gerenciar</p>
              <p className="text-xs mt-1">Você poderá editar o nome, descrição e permissões.</p>
            </div>
          ) : selectedRole === 'admin' ? (
            <div className="rounded-xl border bg-muted/30 p-8 text-center max-w-lg mx-auto my-8">
              <Shield className="h-10 w-10 mx-auto mb-3 text-primary" />
              <p className="font-bold text-lg">Administrador do Sistema</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Este papel possui acesso total e irrestrito a todas as funcionalidades. 
                Por segurança, as permissões de administrador são fixas e não podem ser removidas para evitar que você perca o acesso ao painel.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">Configurar Permissões de Acesso</span>
              </div>
              {categories.map(category => {
                const categoryPerms = permissions.filter(p => p.category === category);
                const allChecked = categoryPerms.every(p => hasPermission(selectedRole!, p.id));
                const someChecked = categoryPerms.some(p => hasPermission(selectedRole!, p.id));
                const isExpanded = expandedCategories[category] !== false;

                return (
                  <div key={category} className="rounded-lg border shadow-sm overflow-hidden">
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
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                          {category}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {categoryPerms.filter(p => hasPermission(selectedRole!, p.id)).length}/{categoryPerms.length}
                        </Badge>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <div className="border-t bg-muted/5 px-4 py-3 grid gap-1 sm:grid-cols-2">
                        {categoryPerms.map(perm => (
                          <label
                            key={perm.id}
                            className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-background border border-transparent hover:border-border cursor-pointer transition-all"
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