import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, Save, Loader2, Pencil, X, Users } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface RoleDescription {
  role: AppRole;
  display_name: string;
  description: string;
}

const ACTIVE_ROLES: AppRole[] = ['admin', 'voluntario'];

const ROLE_BADGE_VARIANT: Record<string, 'destructive' | 'default' | 'secondary'> = {
  admin: 'destructive',
  voluntario: 'default',
};

const RolesManager = () => {
  const [roles, setRoles] = useState<RoleDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<AppRole | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  const fetchData = async () => {
    const [{ data: roleDescs }, { data: userRoles }] = await Promise.all([
      supabase.from('role_descriptions').select('*').order('role'),
      supabase.from('user_roles').select('role'),
    ]);

    const filtered = ((roleDescs as RoleDescription[]) || []).filter(r => ACTIVE_ROLES.includes(r.role));
    setRoles(filtered);

    // Count users per role
    const counts: Record<string, number> = {};
    (userRoles || []).forEach((ur: any) => {
      counts[ur.role] = (counts[ur.role] || 0) + 1;
    });
    setUserCounts(counts);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const startEdit = (role: RoleDescription) => {
    setEditingRole(role.role);
    setEditName(role.display_name);
    setEditDesc(role.description);
  };

  const cancelEdit = () => {
    setEditingRole(null);
    setEditName('');
    setEditDesc('');
  };

  const handleSave = async () => {
    if (!editingRole || !editName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('role_descriptions')
      .update({ display_name: editName.trim(), description: editDesc.trim() })
      .eq('role', editingRole);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Papel atualizado!');
      cancelEdit();
      fetchData();
    }
    setSaving(false);
  };

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
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Papéis do Sistema
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Gerencie os nomes e descrições dos papéis. As permissões de cada papel são configuradas na aba "Permissões".
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {roles.map(role => (
            <div
              key={role.role}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/20"
            >
              {editingRole === role.role ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Nome de exibição</label>
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Nome do papel"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                    <Textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Descreva as responsabilidades deste papel..."
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={ROLE_BADGE_VARIANT[role.role] || 'secondary'}>
                        {role.display_name}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">({role.role})</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                        <Users className="h-3 w-3" />
                        {userCounts[role.role] || 0} usuário{(userCounts[role.role] || 0) !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{role.description || 'Sem descrição'}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(role)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}

          {roles.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum papel configurado</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RolesManager;
