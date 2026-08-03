import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Shield, Loader2, Save, UserPlus } from 'lucide-react';
import { logAudit } from '@/lib/auditLog';
import { useAuth } from '@/contexts/AuthContext';

interface EventPermission {
  id?: string;
  event_id: string;
  user_id: string;
  can_view: boolean;
  can_upload: boolean;
  can_download: boolean;
  can_manage: boolean;
  user_name?: string;
  user_email?: string;
}

interface Profile {
  user_id: string;
  name: string;
  email: string;
}

interface EventPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
}

const EventPermissionsDialog = ({ open, onOpenChange, eventId, eventName }: EventPermissionsDialogProps) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<EventPermission[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchData();
  }, [open, eventId]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: perms }, { data: profiles }] = await Promise.all([
      supabase.from('event_permissions').select('*').eq('event_id', eventId),
      supabase.from('profiles').select('user_id, name, email').eq('is_active', true),
    ]);

    setAllUsers(profiles || []);

    if (perms && profiles) {
      const enriched = perms.map(p => {
        const prof = profiles.find(u => u.user_id === p.user_id);
        return { ...p, user_name: prof?.name || '', user_email: prof?.email || '' };
      });
      setPermissions(enriched);
    } else {
      setPermissions([]);
    }
    setLoading(false);
  };

  const addUser = (userId: string) => {
    if (permissions.some(p => p.user_id === userId)) return;
    const prof = allUsers.find(u => u.user_id === userId);
    setPermissions(prev => [...prev, {
      event_id: eventId,
      user_id: userId,
      can_view: true,
      can_upload: false,
      can_download: false,
      can_manage: false,
      user_name: prof?.name || '',
      user_email: prof?.email || '',
    }]);
  };

  const updatePermission = (userId: string, field: keyof Pick<EventPermission, 'can_view' | 'can_upload' | 'can_download' | 'can_manage'>, value: boolean) => {
    setPermissions(prev => prev.map(p => p.user_id === userId ? { ...p, [field]: value } : p));
  };

  const removeUser = (userId: string) => {
    setPermissions(prev => prev.filter(p => p.user_id !== userId));
  };

  const handleSave = async () => {
    setSaving(true);
    // Delete all existing then re-insert
    await supabase.from('event_permissions').delete().eq('event_id', eventId);

    if (permissions.length > 0) {
      const rows = permissions.map(({ event_id, user_id, can_view, can_upload, can_download, can_manage }) => ({
        event_id, user_id, can_view, can_upload, can_download, can_manage,
      }));
      const { error } = await supabase.from('event_permissions').insert(rows);
      if (error) {
        toast.error('Erro ao salvar permissões: ' + error.message);
        setSaving(false);
        return;
      }
    }

    if (user) {
      await logAudit(user.id, 'edit', undefined, {
        type: 'change_permissions',
        entity: 'event',
        entity_id: eventId,
        event_name: eventName,
      });
    }

    toast.success('Permissões do evento salvas!');
    setSaving(false);
    onOpenChange(false);
  };

  const availableUsers = allUsers.filter(u =>
    !permissions.some(p => p.user_id === u.user_id) &&
    (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Permissões — {eventName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Administradores possuem acesso total automático a todos os eventos.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Add user */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário para adicionar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {search && availableUsers.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border bg-popover p-1">
                  {availableUsers.slice(0, 5).map(u => (
                    <button
                      key={u.user_id}
                      className="flex w-full items-center justify-between rounded px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => { addUser(u.user_id); setSearch(''); }}
                    >
                      <span>{u.name} <span className="text-muted-foreground">({u.email})</span></span>
                      <UserPlus className="h-4 w-4 text-primary" />
                    </button>
                  ))}
                </div>
              )}
              {permissions.length === 0 && !search && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-primary border-primary/20 hover:bg-primary/5"
                    onClick={() => {
                      const activeUsers = allUsers.filter(u => u.user_id !== user?.id);
                      activeUsers.forEach(u => addUser(u.user_id));
                      toast.success(`${activeUsers.length} usuários adicionados. Não esqueça de salvar!`);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    Liberar para todos os usuários ativos
                  </Button>
                </div>
              )}
            </div>

            {/* Permissions table */}
            <div className="overflow-y-auto flex-1 min-h-0">
              {permissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Nenhuma permissão específica definida.</p>
                  <p className="text-xs mt-1">As permissões do perfil serão usadas como padrão.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead className="text-center w-20">Ver</TableHead>
                      <TableHead className="text-center w-20">Upload</TableHead>
                      <TableHead className="text-center w-20">Download</TableHead>
                      <TableHead className="text-center w-20">Gerenciar</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissions.map(p => (
                      <TableRow key={p.user_id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{p.user_name}</p>
                            <p className="text-xs text-muted-foreground">{p.user_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox checked={p.can_view} onCheckedChange={v => updatePermission(p.user_id, 'can_view', !!v)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox checked={p.can_upload} onCheckedChange={v => updatePermission(p.user_id, 'can_upload', !!v)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox checked={p.can_download} onCheckedChange={v => updatePermission(p.user_id, 'can_download', !!v)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox checked={p.can_manage} onCheckedChange={v => updatePermission(p.user_id, 'can_manage', !!v)} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeUser(p.user_id)}>
                            ✕
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Permissões
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventPermissionsDialog;
