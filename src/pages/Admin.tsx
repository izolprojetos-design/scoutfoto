import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/auditLog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Users, Shield, UserPlus, KeyRound, Loader2, Lock, Save, Pencil, Trash2, Plus, FolderTree, Wrench, ImageOff, Eye, EyeOff, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PermissionsManager from '@/components/PermissionsManager';
import RolesManager from '@/components/RolesManager';
import ActivityLogsViewer from '@/components/ActivityLogsViewer';
import SecurityDashboard from '@/components/SecurityDashboard';
import InviteLinkPanel from '@/components/InviteLinkPanel';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';
import { validatePassword } from '@/lib/passwordValidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';
import { ALL_CATEGORIES } from '@/lib/scoutUtils';
import { SECTION_OPTIONS } from '@/lib/sectionOptions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  role: AppRole;
  section: string;
  user_number: number | null;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  image_id: string | null;
  created_at: string;
  details: Record<string, unknown>;
}


interface Subgroup {
  id: string;
  name: string;
  branch_key: string;
  created_at: string;
}

const Admin = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Create user form
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('viewer');
  const [newSection, setNewSection] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Reset password form
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetUserName, setResetUserName] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Edit name form
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editNameUserId, setEditNameUserId] = useState('');
  const [editNameValue, setEditNameValue] = useState('');
  const [editingName, setEditingName] = useState(false);

  // Pending changes
  const [pendingRoles, setPendingRoles] = useState<Record<string, AppRole>>({});
  const [pendingStatus, setPendingStatus] = useState<Record<string, boolean>>({});
  const [pendingSections, setPendingSections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const hasPendingChanges = Object.keys(pendingRoles).length > 0 || Object.keys(pendingStatus).length > 0 || Object.keys(pendingSections).length > 0;

  // Subgroups state
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [subgroupBranchFilter, setSubgroupBranchFilter] = useState('all');
  const [editSubgroupId, setEditSubgroupId] = useState<string | null>(null);
  const [editSubgroupName, setEditSubgroupName] = useState('');
  const [editSubgroupBranch, setEditSubgroupBranch] = useState('');
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [newSubgroupBranch, setNewSubgroupBranch] = useState('');
  const [savingSubgroup, setSavingSubgroup] = useState(false);

  // Maintenance - broken photos
  const [cleaningPhotos, setCleaningPhotos] = useState(false);
  const [brokenPhotos, setBrokenPhotos] = useState<{ id: string; name: string; photo_url: string }[]>([]);
  const [photoScanDone, setPhotoScanDone] = useState(false);

  const handleScanBrokenPhotos = async () => {
    setCleaningPhotos(true);
    setBrokenPhotos([]);
    setPhotoScanDone(false);
    try {
      const { data: scouts } = await supabase.from('scouts').select('id, name, photo_url').not('photo_url', 'is', null);
      if (!scouts || scouts.length === 0) {
        setPhotoScanDone(true);
        setCleaningPhotos(false);
        return;
      }

      const broken: { id: string; name: string; photo_url: string }[] = [];
      await Promise.all(
        scouts.map(
          (scout) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => resolve();
              img.onerror = () => {
                broken.push({ id: scout.id, name: scout.name, photo_url: scout.photo_url! });
                resolve();
              };
              img.src = scout.photo_url!;
            })
        )
      );

      setBrokenPhotos(broken);
      setPhotoScanDone(true);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao verificar fotos');
    }
    setCleaningPhotos(false);
  };

  const handleCleanBrokenPhotos = async () => {
    if (brokenPhotos.length === 0) return;
    setCleaningPhotos(true);
    let cleaned = 0;
    for (const scout of brokenPhotos) {
      const { error } = await supabase.from('scouts').update({ photo_url: null }).eq('id', scout.id);
      if (!error) cleaned++;
    }
    toast.success(`${cleaned} URL(s) de foto limpa(s) com sucesso`);
    setBrokenPhotos([]);
    setPhotoScanDone(false);
    setCleaningPhotos(false);
  };

  const fetchSubgroups = async () => {
    const { data } = await supabase.from('subgroups').select('*').order('branch_key').order('name');
    setSubgroups((data as Subgroup[]) || []);
  };

  const handleCreateSubgroup = async () => {
    if (!user || !newSubgroupName.trim() || !newSubgroupBranch) {
      toast.error('Preencha nome e ramo');
      return;
    }
    setSavingSubgroup(true);
    const { error } = await supabase.from('subgroups').insert({
      name: newSubgroupName.trim(),
      branch_key: newSubgroupBranch,
      created_by: user.id,
    });
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Equipe criada!');
      setNewSubgroupName('');
      setNewSubgroupBranch('');
      fetchSubgroups();
    }
    setSavingSubgroup(false);
  };

  const handleUpdateSubgroup = async () => {
    if (!editSubgroupId || !editSubgroupName.trim() || !editSubgroupBranch) return;
    setSavingSubgroup(true);
    const { error } = await supabase.from('subgroups').update({
      name: editSubgroupName.trim(),
      branch_key: editSubgroupBranch,
    }).eq('id', editSubgroupId);
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Equipe atualizada!');
      setEditSubgroupId(null);
      fetchSubgroups();
    }
    setSavingSubgroup(false);
  };

  const handleDeleteSubgroup = async (id: string) => {
    // First unlink scouts
    await supabase.from('scouts').update({ subgroup_id: null }).eq('subgroup_id', id);
    const { error } = await supabase.from('subgroups').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Equipe excluída!');
      fetchSubgroups();
    }
  };

  const filteredSubgroups = subgroups.filter(sg =>
    subgroupBranchFilter === 'all' || sg.branch_key === subgroupBranchFilter
  );

  const branchLabel = (key: string) => {
    const b = ALL_CATEGORIES.find(c => c.key === key);
    return b ? `${b.icon} ${b.name}` : key;
  };

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');

    if (profiles && roles) {
      const merged: UserWithRole[] = profiles.map(p => {
        const userRole = roles.find(r => r.user_id === p.user_id);
        return {
          user_id: p.user_id,
          name: p.name,
          email: p.email,
          is_active: p.is_active,
          created_at: p.created_at,
          role: userRole?.role || 'viewer',
          section: (p as any).section || '',
          user_number: (p as any).user_number || null,
        };
      });
      setUsers(merged);
    }
    setLoading(false);
  };


  const fetchAuditLogs = async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setAuditLogs((data as AuditLog[]) || []);
  };

  useEffect(() => {
    fetchUsers();
    
    fetchAuditLogs();
    fetchSubgroups();
  }, []);

  const stageRoleChange = (userId: string, newRole: AppRole) => {
    const original = users.find(u => u.user_id === userId);
    if (original && original.role === newRole) {
      setPendingRoles(prev => { const next = { ...prev }; delete next[userId]; return next; });
    } else {
      setPendingRoles(prev => ({ ...prev, [userId]: newRole }));
    }
  };

  const stageStatusToggle = (userId: string, newActive: boolean) => {
    const original = users.find(u => u.user_id === userId);
    if (original && original.is_active === newActive) {
      setPendingStatus(prev => { const next = { ...prev }; delete next[userId]; return next; });
    } else {
      setPendingStatus(prev => ({ ...prev, [userId]: newActive }));
    }
  };

  const stageSectionChange = (userId: string, newSection: string) => {
    const original = users.find(u => u.user_id === userId);
    if (original && (original.section || '') === newSection) {
      setPendingSections(prev => { const next = { ...prev }; delete next[userId]; return next; });
    } else {
      setPendingSections(prev => ({ ...prev, [userId]: newSection }));
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    let hasError = false;

    // Save role changes
    for (const [userId, role] of Object.entries(pendingRoles)) {
      const original = users.find(u => u.user_id === userId);
      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) { toast.error('Erro ao alterar papel: ' + error.message); hasError = true; }
      else if (user) {
        logAudit(user.id, 'role_change', undefined,
          { target_user_id: userId, target_name: original?.name },
          { role: original?.role },
          { role }
        );
      }
    }

    // Save status changes
    for (const [userId, isActive] of Object.entries(pendingStatus)) {
      const original = users.find(u => u.user_id === userId);
      const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('user_id', userId);
      if (error) { toast.error('Erro: ' + error.message); hasError = true; }
      else if (user) {
        logAudit(user.id, 'status_change', undefined,
          { target_user_id: userId, target_name: original?.name },
          { is_active: original?.is_active },
          { is_active: isActive }
        );
      }
    }

    // Save section changes
    for (const [userId, section] of Object.entries(pendingSections)) {
      const original = users.find(u => u.user_id === userId);
      const { error } = await supabase.from('profiles').update({ section }).eq('user_id', userId);
      if (error) { toast.error('Erro ao alterar seção: ' + error.message); hasError = true; }
      else if (user) {
        logAudit(user.id, 'section_change', undefined,
          { target_user_id: userId, target_name: original?.name },
          { section: original?.section || '' },
          { section }
        );
      }
    }

    if (!hasError) toast.success('Alterações salvas com sucesso!');
    setPendingRoles({});
    setPendingStatus({});
    setPendingSections({});
    fetchUsers();
    setSaving(false);
  };

  const handleCreateUser = async () => {
    if (!newName || !newEmail || !newPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    const pwValidation = validatePassword(newPassword);
    if (!pwValidation.isValid) {
      toast.error('A senha não atende aos requisitos mínimos de segurança');
      return;
    }
    setCreating(true);

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { action: 'create', email: newEmail, password: newPassword, name: newName, role: newRole, section: newSection },
    });

    if (error || data?.error) {
      toast.error('Erro ao criar usuário: ' + (data?.error || error?.message));
    } else {
      toast.success('Usuário criado com sucesso! Ao fazer login, será solicitado a trocar a senha imediatamente.', { duration: 6000 });
      setCreateOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('viewer');
      setNewSection('');
      fetchUsers();
    }
    setCreating(false);
  };

  const handleResetPassword = async () => {
    const pwValidation = validatePassword(resetPassword);
    if (!pwValidation.isValid) {
      toast.error('A senha não atende aos requisitos mínimos de segurança');
      return;
    }
    setResetting(true);

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { action: 'reset-password', user_id: resetUserId, new_password: resetPassword },
    });

    if (error || data?.error) {
      toast.error('Erro: ' + (data?.error || error?.message));
    } else {
      // Set must_change_password flag
      await supabase.from('profiles').update({ must_change_password: true }).eq('user_id', resetUserId);
      toast.success('Senha redefinida! O usuário será solicitado a trocar a senha no próximo login.');
      setResetOpen(false);
      setResetPassword('');
    }
    setResetting(false);
  };

  const openResetDialog = (userId: string, userName: string) => {
    setResetUserId(userId);
    setResetUserName(userName);
    setResetPassword('');
    setResetOpen(true);
  };

  const openEditNameDialog = (userId: string, currentName: string) => {
    setEditNameUserId(userId);
    setEditNameValue(currentName);
    setEditNameOpen(true);
  };

  const handleEditName = async () => {
    if (!editNameValue.trim()) {
      toast.error('Nome não pode estar vazio');
      return;
    }
    setEditingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: editNameValue.trim() })
      .eq('user_id', editNameUserId);
    if (error) {
      toast.error('Erro ao atualizar nome: ' + error.message);
    } else {
      toast.success('Nome atualizado!');
      setEditNameOpen(false);
      fetchUsers();
    }
    setEditingName(false);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.section || '').toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  }).sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));

  const roleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'destructive' as const;
      case 'voluntario': return 'default' as const;
      case 'dirigente_gestor': return 'default' as const;
      default: return 'secondary' as const;
    }
  };

  const userNameById = (uid: string) => users.find(u => u.user_id === uid)?.name || uid.slice(0, 8);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
          <Shield className="mr-2 inline h-7 w-7" />
          Painel Administrativo
        </h1>
        <p className="mt-1 text-muted-foreground">Gerencie usuários, permissões e acompanhe atividades</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center p-4">
            <Users className="mb-1 h-6 w-6 text-primary" />
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-xs text-muted-foreground">Usuários</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center p-4">
            <Shield className="mb-1 h-6 w-6 text-primary" />
            <p className="text-2xl font-bold">{auditLogs.length}</p>
            <p className="text-xs text-muted-foreground">Logs de auditoria</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center p-4">
            <FolderTree className="mb-1 h-6 w-6 text-primary" />
            <p className="text-2xl font-bold">{subgroups.length}</p>
            <p className="text-xs text-muted-foreground">Equipes</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4 bg-muted/60">
          <TabsTrigger value="users" className="text-sm font-semibold data-[state=active]:text-foreground data-[state=inactive]:text-foreground/70">Usuários</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5 text-sm font-semibold data-[state=active]:text-foreground data-[state=inactive]:text-foreground/70"><Shield className="h-3.5 w-3.5" />Papéis</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1.5 text-sm font-semibold data-[state=active]:text-foreground data-[state=inactive]:text-foreground/70"><Lock className="h-3.5 w-3.5" />Permissões</TabsTrigger>
          
          <TabsTrigger value="audit" className="text-sm font-semibold data-[state=active]:text-foreground data-[state=inactive]:text-foreground/70">Auditoria</TabsTrigger>
          <TabsTrigger value="subgroups" className="gap-1.5 text-sm font-semibold data-[state=active]:text-foreground data-[state=inactive]:text-foreground/70"><FolderTree className="h-3.5 w-3.5" />Equipes</TabsTrigger>
          <TabsTrigger value="invites" className="gap-1.5 text-sm font-semibold data-[state=active]:text-foreground data-[state=inactive]:text-foreground/70"><Link2 className="h-3.5 w-3.5" />Convites</TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1.5 text-sm font-semibold data-[state=active]:text-foreground data-[state=inactive]:text-foreground/70"><Wrench className="h-3.5 w-3.5" />Manutenção</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 text-sm font-semibold data-[state=active]:text-foreground data-[state=inactive]:text-foreground/70"><Shield className="h-3.5 w-3.5" />Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuários ({filtered.length})
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      className="pl-10"
                      autoComplete="off"
                    />
                    {showSuggestions && search.length >= 1 && (() => {
                      const suggestions = users.filter(u =>
                        u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase())
                      ).slice(0, 8);
                      if (suggestions.length === 0) return null;
                      return (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
                          {suggestions.map(s => (
                            <button
                              key={s.user_id}
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                              onMouseDown={() => { setSearch(s.name); setShowSuggestions(false); }}
                            >
                              <span className="font-medium truncate">{s.name}</span>
                              <Badge variant={roleBadgeVariant(s.role)} className="ml-auto text-xs shrink-0">{s.role}</Badge>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="voluntario">Voluntário</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Create User Button */}
                  <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <UserPlus className="h-4 w-4" />
                        Criar Usuário
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar novo usuário</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label>Nome completo</Label>
                          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do usuário" />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
                        </div>
                        <div className="space-y-2">
                          <Label>Senha</Label>
                          <div className="relative">
                            <Input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="pr-10" />
                            <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <PasswordStrengthIndicator password={newPassword} />
                        </div>
                        <div className="space-y-2">
                          <Label>Cargo</Label>
                          <Select value={newRole} onValueChange={(v: AppRole) => setNewRole(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="voluntario">Voluntário</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Seção</Label>
                          <Select value={newSection || 'none'} onValueChange={(v) => setNewSection(v === 'none' ? '' : v)}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma</SelectItem>
                              {SECTION_OPTIONS.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleCreateUser} disabled={creating} className="w-full gap-2">
                          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                          Criar Usuário
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Seção</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(u => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {u.user_number ? String(u.user_number).padStart(7, '0') : '—'}
                        </TableCell>
                        <TableCell className="font-medium">
                          <button
                            className="text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                            onClick={() => openEditNameDialog(u.user_id, u.name)}
                            title="Clique para editar o nome"
                          >
                            {u.name}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          {(() => {
                            const currentSection = pendingSections[u.user_id] !== undefined ? pendingSections[u.user_id] : (u.section || '');
                            const isPending = pendingSections[u.user_id] !== undefined;
                            return (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <button
                                    className={`h-8 px-3 rounded-md border text-xs text-left truncate max-w-[220px] hover:bg-accent transition-colors ${isPending ? 'ring-2 ring-primary/50' : ''}`}
                                  >
                                    {currentSection || '— Nenhuma —'}
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                                  <DialogHeader>
                                    <DialogTitle className="text-base">Selecionar Seção — {u.name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-1 py-2">
                                    <button
                                      className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${currentSection === '' ? 'bg-primary/10 border border-primary/30 font-medium' : 'hover:bg-muted/50 border border-transparent'}`}
                                      onClick={() => stageSectionChange(u.user_id, '')}
                                    >
                                      — Nenhuma —
                                    </button>
                                    {SECTION_OPTIONS.map(s => (
                                      <button
                                        key={s}
                                        className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${currentSection === s ? 'bg-primary/10 border border-primary/30 font-medium' : 'hover:bg-muted/50 border border-transparent'}`}
                                        onClick={() => stageSectionChange(u.user_id, s)}
                                      >
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            );
                          })()}
                        </TableCell>
                        <TableCell><Badge variant={roleBadgeVariant(u.role)}>{{ admin: 'Admin', voluntario: 'Voluntário', dirigente_gestor: 'Dir. Gestor', viewer: 'Visitante', parent: 'Pai/Mãe' }[u.role] || u.role}</Badge></TableCell>
                        <TableCell>
                          {(() => {
                            const currentActive = pendingStatus[u.user_id] !== undefined ? pendingStatus[u.user_id] : u.is_active;
                            const isPending = pendingStatus[u.user_id] !== undefined;
                            return (
                              <Badge variant={currentActive ? 'default' : 'secondary'} className={isPending ? 'ring-2 ring-primary/50' : ''}>
                                {currentActive ? 'Ativo' : 'Inativo'}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Select
                              value={pendingRoles[u.user_id] || u.role}
                              onValueChange={(v: AppRole) => stageRoleChange(u.user_id, v)}
                              disabled={u.user_id === user?.id}
                            >
                              <SelectTrigger className={`h-8 w-[120px] ${pendingRoles[u.user_id] ? 'ring-2 ring-primary/50' : ''}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="voluntario">Voluntário</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="outline" size="sm" onClick={() => openResetDialog(u.user_id, u.name)} disabled={u.user_id === user?.id}>
                              <KeyRound className="h-3.5 w-3.5 mr-1" />
                              Senha
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentActive = pendingStatus[u.user_id] !== undefined ? pendingStatus[u.user_id] : u.is_active;
                                stageStatusToggle(u.user_id, !currentActive);
                              }}
                              disabled={u.user_id === user?.id}
                            >
                              {(pendingStatus[u.user_id] !== undefined ? pendingStatus[u.user_id] : u.is_active) ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum usuário encontrado</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Floating Save Button */}
          <AnimatePresence>
            {hasPendingChanges && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
              >
                <Button
                  size="lg"
                  className="gap-2 shadow-lg px-8"
                  onClick={handleSaveAll}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar alterações ({Object.keys(pendingRoles).length + Object.keys(pendingStatus).length + Object.keys(pendingSections).length})
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="roles">
          <RolesManager />
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionsManager />
        </TabsContent>


        <TabsContent value="audit">
          <ActivityLogsViewer />
        </TabsContent>

        <TabsContent value="subgroups">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="h-5 w-5" />
                  Equipes ({subgroups.length})
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Select value={subgroupBranchFilter} onValueChange={setSubgroupBranchFilter}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Ramos</SelectItem>
                      {ALL_CATEGORIES.map(b => (
                        <SelectItem key={b.key} value={b.key}>{b.icon} {b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Create new subgroup */}
              <div className="flex gap-2 items-end flex-wrap">
                <div className="space-y-1 flex-1 min-w-[150px]">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={newSubgroupName}
                    onChange={e => setNewSubgroupName(e.target.value)}
                    placeholder="Ex: Equipe Gavião"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1 min-w-[140px]">
                  <Label className="text-xs">Ramo</Label>
                  <Select value={newSubgroupBranch} onValueChange={setNewSubgroupBranch}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Ramo" /></SelectTrigger>
                    <SelectContent>
                      {ALL_CATEGORIES.map(b => (
                        <SelectItem key={b.key} value={b.key}>{b.icon} {b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" className="gap-1.5 h-9" onClick={handleCreateSubgroup} disabled={savingSubgroup}>
                  <Plus className="h-3.5 w-3.5" /> Criar
                </Button>
              </div>

              {/* List */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Ramo</TableHead>
                      <TableHead className="w-[140px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubgroups.map(sg => (
                      <TableRow key={sg.id}>
                        <TableCell>
                          {editSubgroupId === sg.id ? (
                            <Input
                              value={editSubgroupName}
                              onChange={e => setEditSubgroupName(e.target.value)}
                              className="h-8 w-full max-w-[200px]"
                            />
                          ) : (
                            <span className="font-medium">{sg.name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editSubgroupId === sg.id ? (
                            <Select value={editSubgroupBranch} onValueChange={setEditSubgroupBranch}>
                              <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ALL_CATEGORIES.map(b => (
                                  <SelectItem key={b.key} value={b.key}>{b.icon} {b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{branchLabel(sg.branch_key)}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editSubgroupId === sg.id ? (
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="default" className="h-7 gap-1" onClick={handleUpdateSubgroup} disabled={savingSubgroup}>
                                <Save className="h-3 w-3" /> Salvar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditSubgroupId(null)}>Cancelar</Button>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1"
                                onClick={() => {
                                  setEditSubgroupId(sg.id);
                                  setEditSubgroupName(sg.name);
                                  setEditSubgroupBranch(sg.branch_key);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive" className="h-7 gap-1">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir "{sg.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>Os integrantes vinculados a esta equipe serão desvinculados.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteSubgroup(sg.id)}>Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSubgroups.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Nenhuma equipe cadastrada</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Manutenção
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Broken Photos Cleanup */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <ImageOff className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold">Fotos de Integrantes Órfãs</h3>
                    <p className="text-sm text-muted-foreground">
                      Detecta e limpa URLs de fotos que apontam para arquivos removidos do armazenamento.
                    </p>
                  </div>
                  <Button
                    onClick={handleScanBrokenPhotos}
                    disabled={cleaningPhotos}
                    variant="outline"
                    className="gap-2"
                  >
                    {cleaningPhotos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Verificar
                  </Button>
                </div>

                {photoScanDone && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-md border bg-muted/30 p-3"
                  >
                    {brokenPhotos.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        ✅ Nenhuma foto órfã encontrada. Tudo limpo!
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-medium">
                          Encontrada(s) <span className="text-destructive font-bold">{brokenPhotos.length}</span> foto(s) com URL inválida:
                        </p>
                        <div className="max-h-48 overflow-auto space-y-1">
                          {brokenPhotos.map((bp) => (
                            <div key={bp.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-background">
                              <ImageOff className="h-3.5 w-3.5 text-destructive shrink-0" />
                              <span className="truncate">{bp.name}</span>
                            </div>
                          ))}
                        </div>
                        <Button
                          onClick={handleCleanBrokenPhotos}
                          disabled={cleaningPhotos}
                          variant="destructive"
                          className="w-full gap-2"
                        >
                          {cleaningPhotos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Limpar {brokenPhotos.length} URL(s) inválida(s)
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites">
          <InviteLinkPanel />
        </TabsContent>

        <TabsContent value="security">
          <SecurityDashboard />
        </TabsContent>
      </Tabs>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha de {resetUserName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowResetPassword(!showResetPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={resetPassword} />
            </div>
            <Button onClick={handleResetPassword} disabled={resetting} className="w-full gap-2">
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Redefinir Senha
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Name Dialog */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar nome do usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editNameValue}
                onChange={e => setEditNameValue(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <Button onClick={handleEditName} disabled={editingName} className="w-full gap-2">
              {editingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Salvar Nome
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Admin;
