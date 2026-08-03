import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Shield, Save, Loader2, Search, User, ChevronDown, ChevronUp } from 'lucide-react';

interface Permission {
  id: string;
  key: string;
  name: string;
  category: string;
  sort_order: number;
}

interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  section: string | null;
  is_active: boolean;
  user_number: number | null;
}

interface UserPermission {
  user_id: string;
  permission_id: string;
}

const PermissionsManager = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const fetchData = async () => {
    const [{ data: perms }, { data: profiles }, { data: ups }, { data: roles }] = await Promise.all([
      supabase.from('permissions').select('*').order('sort_order'),
      supabase.from('profiles').select('user_id, name, email, section, is_active, user_number'),
      supabase.from('user_permissions').select('user_id, permission_id'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    setPermissions((perms as Permission[]) || []);
    setUsers((profiles as UserProfile[]) || []);
    setUserPermissions((ups as UserPermission[]) || []);
    const roleMap: Record<string, string> = {};
    (roles || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
    setUserRoles(roleMap);
    setLoading(false);

    // Expand all categories by default
    if (perms) {
      const cats: Record<string, boolean> = {};
      [...new Set(perms.map((p: any) => p.category))].forEach(c => { cats[c] = true; });
      setExpandedCategories(cats);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const sections = [...new Set(users.map(u => u.section).filter(Boolean))] as string[];

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchSection = sectionFilter === 'all' || (u.section || '') === sectionFilter;
    return matchSearch && matchSection;
  }).sort((a, b) => (a.user_number ?? Infinity) - (b.user_number ?? Infinity));

  const selectedUser = users.find(u => u.user_id === selectedUserId);
  const isAdmin = selectedUserId ? userRoles[selectedUserId] === 'admin' : false;

  const hasPermission = (userId: string, permId: string) =>
    userPermissions.some(up => up.user_id === userId && up.permission_id === permId);

  const togglePermission = (userId: string, permId: string) => {
    if (hasPermission(userId, permId)) {
      setUserPermissions(prev => prev.filter(up => !(up.user_id === userId && up.permission_id === permId)));
    } else {
      setUserPermissions(prev => [...prev, { user_id: userId, permission_id: permId }]);
    }
    setDirty(true);
  };

  const toggleAllInCategory = (userId: string, category: string, enable: boolean) => {
    const categoryPermIds = permissions.filter(p => p.category === category).map(p => p.id);
    setUserPermissions(prev => {
      let next = prev.filter(up => !(up.user_id === userId && categoryPermIds.includes(up.permission_id)));
      if (enable) {
        next = [...next, ...categoryPermIds.map(pid => ({ user_id: userId, permission_id: pid }))];
      }
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      // Delete existing permissions for this user
      await supabase.from('user_permissions').delete().eq('user_id', selectedUserId);

      // Insert new ones
      const toInsert = userPermissions
        .filter(up => up.user_id === selectedUserId)
        .map(up => ({ user_id: up.user_id, permission_id: up.permission_id }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('user_permissions').insert(toInsert);
        if (error) throw error;
      }

      toast.success(`Permissões de ${selectedUser?.name} salvas com sucesso!`);
      setDirty(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    }
    setSaving(false);
  };

  const categories = [...new Set(permissions.map(p => p.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* User list sidebar */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="h-4 w-4" />
            Selecionar Usuário
          </CardTitle>
          <div className="space-y-2 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Filtrar por seção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as seções</SelectItem>
                {sections.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[500px] overflow-y-auto space-y-1 -mx-2 px-2">
            {filteredUsers.map(u => (
              <button
                key={u.user_id}
                onClick={() => { setSelectedUserId(u.user_id); setDirty(false); }}
                className={`w-full text-left rounded-lg p-3 transition-colors text-sm ${
                  selectedUserId === u.user_id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted/50 border border-transparent'
                }`}
              >
                <div className="font-bold truncate flex items-center gap-2 text-foreground">
                  {u.user_number != null && (
                    <span className="text-xs text-muted-foreground font-mono">#{String(u.user_number).padStart(4, '0')}</span>
                  )}
                  {u.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  {userRoles[u.user_id] === 'admin' && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Admin</Badge>
                  )}
                  {u.section && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 truncate max-w-[180px]">{u.section}</Badge>
                  )}
                </div>
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permissions panel */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {selectedUser ? (
                <span>Permissões de <span className="text-primary">{selectedUser.name}</span></span>
              ) : (
                'Permissões por Usuário'
              )}
            </CardTitle>
            {selectedUser && !isAdmin && (
              <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            )}
          </div>
          {selectedUser && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{selectedUser.email}</span>
              {selectedUser.section && (
                <>
                  <span>•</span>
                  <Badge variant="outline" className="text-xs">{selectedUser.section}</Badge>
                </>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!selectedUser ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <User className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Selecione um usuário para gerenciar suas permissões</p>
            </div>
          ) : isAdmin ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-center">
              <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-medium">Administrador</p>
              <p className="text-sm text-muted-foreground mt-1">
                Administradores possuem todas as permissões automaticamente e não podem ser alterados.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map(category => {
                const categoryPerms = permissions.filter(p => p.category === category);
                const allChecked = categoryPerms.every(p => hasPermission(selectedUserId!, p.id));
                const someChecked = categoryPerms.some(p => hasPermission(selectedUserId!, p.id));
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
                            toggleAllInCategory(selectedUserId!, category, !!checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          {category}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryPerms.filter(p => hasPermission(selectedUserId!, p.id)).length}/{categoryPerms.length}
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
                              checked={hasPermission(selectedUserId!, perm.id)}
                              onCheckedChange={() => togglePermission(selectedUserId!, perm.id)}
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

export default PermissionsManager;
