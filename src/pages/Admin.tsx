import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/auditLog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Users, Shield, UserPlus, KeyRound, Loader2, Lock, Save, Pencil, Trash2, Plus, FolderTree, Wrench, ImageOff, Eye, EyeOff, Link2, Archive, RefreshCw, Unlock, LogOut, LayoutDashboard, Cloud, Mail, Server, ShieldCheck, Info, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PermissionsManager from '@/components/PermissionsManager';
import RolePermissionsManager from '@/components/RolePermissionsManager';

import ActivityLogsViewer from '@/components/ActivityLogsViewer';
import AccessLogViewer from '@/components/AccessLogViewer';
import SecurityDashboard from '@/components/SecurityDashboard';
import InviteLinkPanel from '@/components/InviteLinkPanel';
import ArchivedPhotosPanel from '@/components/ArchivedPhotosPanel';
import StorageUsageCard from '@/components/StorageUsageCard';
import AdminStorageMetrics from '@/components/admin/AdminStorageMetrics';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';
import LockedAccountsPanel from '@/components/LockedAccountsPanel';
import AdminOverview from '@/components/AdminOverview';
import MotivationalMessagesManager from '@/components/MotivationalMessagesManager';

import GroupLogoSettings from '@/components/GroupLogoSettings';
import GoogleDriveSettings from '@/components/GoogleDriveSettings';
import { validatePassword } from '@/lib/passwordValidation';
import ScoutAvatar from '@/components/ScoutAvatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';
import { ROLE_LABELS } from '@/lib/userRoles';
import { ALL_CATEGORIES } from '@/lib/scoutUtils';
import { SECTION_OPTIONS, VOLUNTEER_CARGOS, CARGO_2_OPTIONS } from '@/lib/sectionOptions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import HealthCheck from '@/components/HealthCheck';
import EmailLogs from '@/components/EmailLogs';
import { DataIntegrityCheck } from '@/components/admin/DataIntegrityCheck';

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
  cargo_1: string | null;
  cargo_2: string | null;
  avatar_url: string | null;
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
  const location = useLocation();
  const navigate = useNavigate();
  const { roles: availableRoles } = useAvailableRoles();

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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newCargo1, setNewCargo1] = useState('');
  const [newCargo2, setNewCargo2] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('voluntario');
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

  // Force remote refresh
  const [forcingRefreshFor, setForcingRefreshFor] = useState<string | null>(null);

  const handleForceRefresh = async (userId: string, userName: string) => {
    setForcingRefreshFor(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ force_refresh_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      toast.error('Erro ao solicitar atualização: ' + error.message);
    } else {
      toast.success(`Atualização solicitada para ${userName}. O app dele recarregará em até 2 minutos.`);
      if (user) {
        logAudit(user.id, 'force_remote_refresh', undefined, {
          target_user_id: userId,
          target_name: userName,
        }).catch(() => {});
      }
    }
    setForcingRefreshFor(null);
  };

  // Pending changes
  const [pendingRoles, setPendingRoles] = useState<Record<string, AppRole>>({});
  const [pendingStatus, setPendingStatus] = useState<Record<string, boolean>>({});
  const [pendingSections, setPendingSections] = useState<Record<string, string>>({});
  const [pendingCargo1, setPendingCargo1] = useState<Record<string, string>>({});
  const [pendingCargo2, setPendingCargo2] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const hasPendingChanges = Object.keys(pendingRoles).length > 0 || 
    Object.keys(pendingStatus).length > 0 || 
    Object.keys(pendingSections).length > 0 ||
    Object.keys(pendingCargo1).length > 0 ||
    Object.keys(pendingCargo2).length > 0;

  // Subgroups state
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [subgroupBranchFilter, setSubgroupBranchFilter] = useState('all');
  const [editSubgroupId, setEditSubgroupId] = useState<string | null>(null);
  const [editSubgroupName, setEditSubgroupName] = useState('');
  const [editSubgroupBranch, setEditSubgroupBranch] = useState('');
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [newSubgroupBranch, setNewSubgroupBranch] = useState('');
  const [savingSubgroup, setSavingSubgroup] = useState(false);



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
    const { data: profiles } = await supabase.from('profiles').select('*, avatar_url');
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
          cargo_1: (p as any).cargo_1 || '',
          cargo_2: (p as any).cargo_2 || '',
          avatar_url: p.avatar_url,
        };
      });
      merged.sort((a, b) => {
        const an = a.user_number ?? Number.MAX_SAFE_INTEGER;
        const bn = b.user_number ?? Number.MAX_SAFE_INTEGER;
        return an - bn;
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

  const [activeTab, setActiveTab] = useState('overview');

  const updateTabFromUrl = (searchParams: string) => {
    const params = new URLSearchParams(searchParams);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    } else {
      setActiveTab('overview');
    }
  };

  useEffect(() => {
    updateTabFromUrl(window.location.search);
  }, [location.search]);

  // Fetch next number when create dialog opens
  useEffect(() => {
    if (createOpen && !newNumber) {
      const getNext = async () => {
        const { data: nextNum } = await supabase.rpc('get_next_user_number');
        if (nextNum) setNewNumber(nextNum.toString().padStart(4, '0'));
      };
      getNext();
    }
  }, [createOpen, newNumber]);

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

  const stageCargo1Change = (userId: string, value: string) => {
    const original = users.find(u => u.user_id === userId);
    if (original && (original.cargo_1 || '') === value) {
      setPendingCargo1(prev => { const next = { ...prev }; delete next[userId]; return next; });
    } else {
      setPendingCargo1(prev => ({ ...prev, [userId]: value }));
    }
  };

  const stageCargo2Change = (userId: string, value: string) => {
    const original = users.find(u => u.user_id === userId);
    if (original && (original.cargo_2 || '') === value) {
      setPendingCargo2(prev => { const next = { ...prev }; delete next[userId]; return next; });
    } else {
      setPendingCargo2(prev => ({ ...prev, [userId]: value }));
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    let hasError = false;
    const affectedUserIds = new Set<string>();

    // Save role changes
    for (const [userId, role] of Object.entries(pendingRoles)) {
      const original = users.find(u => u.user_id === userId);
      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) {
        toast.error('Erro ao alterar papel: ' + error.message);
        hasError = true;
      } else {
        affectedUserIds.add(userId);
        if (user) {
          logAudit(user.id, 'role_change', undefined,
            { target_user_id: userId, target_name: original?.name },
            { role: original?.role },
            { role }
          );
        }
      }
    }

    // Save status changes
    for (const [userId, isActive] of Object.entries(pendingStatus)) {
      const original = users.find(u => u.user_id === userId);
      const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('user_id', userId);
      if (error) {
        toast.error('Erro: ' + error.message);
        hasError = true;
      } else {
        affectedUserIds.add(userId);
        if (user) {
          logAudit(user.id, 'status_change', undefined,
            { target_user_id: userId, target_name: original?.name },
            { is_active: original?.is_active },
            { is_active: isActive }
          );
        }
      }
    }

    // Save section changes
    for (const [userId, section] of Object.entries(pendingSections)) {
      const original = users.find(u => u.user_id === userId);
      const { error } = await supabase.from('profiles').update({ section }).eq('user_id', userId);
      if (error) {
        toast.error('Erro ao alterar seção: ' + error.message);
        hasError = true;
      } else {
        affectedUserIds.add(userId);
        if (user) {
          logAudit(user.id, 'section_change', undefined,
            { target_user_id: userId, target_name: original?.name },
            { section: original?.section || '' },
            { section }
          );
        }
      }
    }

    // Save cargo_1 changes
    for (const [userId, cargo_1] of Object.entries(pendingCargo1)) {
      const original = users.find(u => u.user_id === userId);
      const { error } = await supabase.from('profiles').update({ cargo_1 }).eq('user_id', userId);
      if (error) {
        toast.error('Erro ao alterar Cargo 1: ' + error.message);
        hasError = true;
      } else {
        affectedUserIds.add(userId);
      }
    }

    // Save cargo_2 changes
    for (const [userId, cargo_2] of Object.entries(pendingCargo2)) {
      const original = users.find(u => u.user_id === userId);
      const { error } = await supabase.from('profiles').update({ cargo_2 }).eq('user_id', userId);
      if (error) {
        toast.error('Erro ao alterar Cargo 2: ' + error.message);
        hasError = true;
      } else {
        affectedUserIds.add(userId);
      }
    }

    if (affectedUserIds.size > 0) {
      const { error: refreshError } = await supabase
        .from('profiles')
        .update({ force_refresh_at: new Date().toISOString() })
        .in('user_id', Array.from(affectedUserIds));

      if (refreshError) {
        toast.error('Alterações salvas, mas não foi possível solicitar atualização do app: ' + refreshError.message);
        hasError = true;
      }
    }

    if (!hasError) toast.success('Alterações salvas com sucesso! O app do usuário será atualizado automaticamente.');
    setPendingRoles({});
    setPendingStatus({});
    setPendingSections({});
    setPendingCargo1({});
    setPendingCargo2({});
    fetchUsers();
    setSaving(false);
  };

  const handleCreateUser = async () => {
    if (!newName || !newEmail || !newPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    const pwValidation = validatePassword(newPassword);
    if (!pwValidation.isValid) {
      toast.error('A senha não atende aos requisitos mínimos de segurança');
      return;
    }
    setCreating(true);

    let finalNumber = newNumber ? parseInt(newNumber) : null;
    if (!finalNumber) {
      const { data: nextNum } = await supabase.rpc('get_next_user_number');
      if (nextNum) finalNumber = nextNum;
    }

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { 
        action: 'create', 
        email: newEmail, 
        password: newPassword, 
        name: newName, 
        role: newRole, 
        section: newSection,
        user_number: finalNumber,
        cargo_1: newCargo1,
        cargo_2: newCargo2
      },
    });

    if (error || data?.error) {
      const raw = data?.error || error?.message || '';
      const friendly = /weak|known|pwned|compromised|easy to guess/i.test(raw)
        ? 'Esta senha aparece em vazamentos públicos e foi considerada insegura. Escolha outra, de preferência única e com mais de 12 caracteres.'
        : raw;
      toast.error('Erro ao criar usuário', { description: friendly });
    } else {
      toast.success('Usuário criado com sucesso! Ao fazer login, será solicitado a trocar a senha imediatamente.', { duration: 6000 });
      setCreateOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
      setNewNumber('');
      setNewCargo1('');
      setNewCargo2('');
      setNewRole('voluntario');
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
      const raw = data?.error || error?.message || '';
      const friendly = /weak|known|pwned|compromised|easy to guess/i.test(raw)
        ? 'Esta senha aparece em vazamentos públicos e foi considerada insegura. Escolha outra, de preferência única e com mais de 12 caracteres.'
        : raw;
      toast.error('Erro ao redefinir senha', { description: friendly });
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

  const [unlockingFor, setUnlockingFor] = useState<string | null>(null);
  const handleUnlockLogin = async (email: string, name: string) => {
    if (!email) return;
    setUnlockingFor(email);
    const { error } = await supabase.rpc('admin_unlock_login', { p_email: email });
    setUnlockingFor(null);
    if (error) {
      toast.error('Erro ao desbloquear', { description: error.message });
    } else {
      toast.success('Login desbloqueado', { description: `Tentativas de ${name} foram zeradas.` });
    }
  };

  const [signingOutUser, setSigningOutUser] = useState<string | null>(null);
  const handleSignOutUser = async (userId: string, userName: string) => {
    setSigningOutUser(userId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { action: 'signout-user', user_id: userId },
      });
      if (error || (data as { error?: string })?.error) {
        toast.error('Erro ao derrubar usuário', {
          description: error?.message || (data as { error?: string })?.error,
        });
      } else {
        toast.success(`${userName} foi desconectado de todos os dispositivos.`);
        if (user) {
          logAudit(user.id, 'logout_all_sessions', undefined, {
            target_user_id: userId,
            target_name: userName,
            forced_by_admin: true,
          }).catch(() => {});
        }
      }
    } finally {
      setSigningOutUser(null);
    }
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
  }).sort((a, b) => {
    const an = a.user_number ?? Number.MAX_SAFE_INTEGER;
    const bn = b.user_number ?? Number.MAX_SAFE_INTEGER;
    return an - bn;
  });

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

      <Tabs 
        value={activeTab} 
        onValueChange={(val) => {
          setActiveTab(val);
          const newPath = val === 'overview' ? '/admin' : `/admin?tab=${val}`;
          navigate(newPath, { replace: true });
        }}
        className="space-y-4"
      >

        <TabsList className="mb-4 bg-muted/60 flex-wrap h-auto p-1 gap-1">
          <TabsTrigger value="audit" className="text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="access_log" className="gap-1.5 text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            <LogOut className="h-4 w-4 rotate-180" /> Log de Acessos
          </TabsTrigger>
          <TabsTrigger value="invites" className="gap-1.5 text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            <Link2 className="h-4 w-4" /> Convites
          </TabsTrigger>
          <TabsTrigger value="subgroups" className="gap-1.5 text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            <FolderTree className="h-4 w-4" /> Equipes
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-1.5 text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            <ImageOff className="h-4 w-4" /> Identidade
          </TabsTrigger>
          <TabsTrigger value="roles_permissions" className="gap-1.5 text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            <Shield className="h-4 w-4" /> Papéis e Permissões
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            <Shield className="h-4 w-4" /> Segurança
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-1.5 text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            <RefreshCw className="h-4 w-4" /> Sistema
          </TabsTrigger>
          <TabsTrigger value="motivational" className="gap-1.5 text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            <Sparkles className="h-4 w-4" /> Mensagens Motivacionais
          </TabsTrigger>

          <TabsTrigger value="users" className="text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            Usuários
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-1.5 text-sm font-bold px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
            <LayoutDashboard className="h-4 w-4" /> Visão Geral
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverview />
        </TabsContent>

        <TabsContent value="branding">
          <GroupLogoSettings />
        </TabsContent>


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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Id</Label>
                          <Input value={newNumber} readOnly className="bg-muted font-mono w-24" placeholder="..." />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Nome do associado</Label>
                          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome completo" />
                        </div>
                        <div className="space-y-2">
                          <Label>Seção</Label>
                          <Select value={newSection || 'none'} onValueChange={(v) => setNewSection(v === 'none' ? '' : v)}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="none">Nenhuma</SelectItem>
                              {SECTION_OPTIONS.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Cargo 1</Label>
                          <Select value={newCargo1 || 'none'} onValueChange={(v) => setNewCargo1(v === 'none' ? '' : v)}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="none">Nenhum</SelectItem>
                              {VOLUNTEER_CARGOS.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Cargo 2 (opcional)</Label>
                          <Select value={newCargo2 || 'none'} onValueChange={(v) => setNewCargo2(v === 'none' ? '' : v)}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="none">Nenhum</SelectItem>
                              {CARGO_2_OPTIONS.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Papel no Sistema</Label>
                          <Select value={newRole} onValueChange={(v: AppRole) => setNewRole(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {availableRoles.map(r => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>E-mail</Label>
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
                          <Label>Confirmar senha</Label>
                          <Input type={showNewPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
                        </div>
                        <div className="md:col-span-2 pt-2">
                          <Button onClick={handleCreateUser} disabled={creating} className="w-full gap-2">
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            Criar Usuário
                          </Button>
                        </div>
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
                      <TableHead className="w-[80px] font-bold text-center">Foto</TableHead>
                      <TableHead className="w-[80px] font-bold">ID</TableHead>
                      <TableHead className="font-bold">Nome</TableHead>
                      <TableHead className="font-bold">Seção</TableHead>
                      <TableHead className="font-bold">Cargo 1</TableHead>
                      <TableHead className="font-bold">Cargo 2</TableHead>
                      <TableHead className="font-bold">E-mail</TableHead>
                      <TableHead className="font-bold">Papel</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="font-bold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(u => (
                      <TableRow key={u.user_id}>
                        <TableCell className="text-center py-1">
                          <ScoutAvatar 
                            name={u.name} 
                            photoUrl={u.avatar_url} 
                            className="h-9 w-9 mx-auto ring-1 ring-muted" 
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-primary">
                          {u.user_number ? String(u.user_number).padStart(4, '0') : '—'}
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
                                    <div className="flex flex-col gap-1 pb-20">
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
                                  </div>
                                  <div className="pt-4 mt-auto border-t bg-background">
                                    <DialogTrigger asChild>
                                      <Button className="w-full">Confirmar Seleção</Button>
                                    </DialogTrigger>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const currentCargo1 = pendingCargo1[u.user_id] !== undefined ? pendingCargo1[u.user_id] : (u.cargo_1 || '');
                            const isPending = pendingCargo1[u.user_id] !== undefined;
                            return (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <button
                                    className={`h-8 px-3 rounded-md border text-xs text-left truncate max-w-[200px] hover:bg-accent transition-colors ${isPending ? 'ring-2 ring-primary/50' : ''}`}
                                  >
                                    {currentCargo1 || '— Nenhum —'}
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                                  <DialogHeader>
                                    <DialogTitle className="text-base">Selecionar Cargo 1 — {u.name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-1 py-2">
                                    <div className="flex flex-col gap-1 pb-20">
                                      <button
                                        className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${currentCargo1 === '' ? 'bg-primary/10 border border-primary/30 font-medium' : 'hover:bg-muted/50 border border-transparent'}`}
                                        onClick={() => stageCargo1Change(u.user_id, '')}
                                      >
                                        — Nenhum —
                                      </button>
                                      {VOLUNTEER_CARGOS.map(c => (
                                        <button
                                          key={c}
                                          className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${currentCargo1 === c ? 'bg-primary/10 border border-primary/30 font-medium' : 'hover:bg-muted/50 border border-transparent'}`}
                                          onClick={() => stageCargo1Change(u.user_id, c)}
                                        >
                                          {c}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="pt-4 mt-auto border-t bg-background">
                                    <DialogTrigger asChild>
                                      <Button className="w-full">Confirmar Seleção</Button>
                                    </DialogTrigger>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const currentCargo2 = pendingCargo2[u.user_id] !== undefined ? pendingCargo2[u.user_id] : (u.cargo_2 || '');
                            const isPending = pendingCargo2[u.user_id] !== undefined;
                            return (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <button
                                    className={`h-8 px-3 rounded-md border text-xs text-left truncate max-w-[200px] hover:bg-accent transition-colors ${isPending ? 'ring-2 ring-primary/50' : ''}`}
                                  >
                                    {currentCargo2 || '— Nenhum —'}
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                                  <DialogHeader>
                                    <DialogTitle className="text-base">Selecionar Cargo 2 — {u.name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-1 py-2">
                                    <div className="flex flex-col gap-1 pb-20">
                                      <button
                                        className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${currentCargo2 === '' ? 'bg-primary/10 border border-primary/30 font-medium' : 'hover:bg-muted/50 border border-transparent'}`}
                                        onClick={() => stageCargo2Change(u.user_id, '')}
                                      >
                                        — Nenhum —
                                      </button>
                                      {CARGO_2_OPTIONS.map(c => (
                                        <button
                                          key={c}
                                          className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${currentCargo2 === c ? 'bg-primary/10 border border-primary/30 font-medium' : 'hover:bg-muted/50 border border-transparent'}`}
                                          onClick={() => stageCargo2Change(u.user_id, c)}
                                        >
                                          {c}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="pt-4 mt-auto border-t bg-background">
                                    <DialogTrigger asChild>
                                      <Button className="w-full">Confirmar Seleção</Button>
                                    </DialogTrigger>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                        <TableCell>
                          {(() => {
                            const currentRole = (pendingRoles[u.user_id] || u.role) as AppRole;
                            const isPending = !!pendingRoles[u.user_id];
                            const label = ROLE_LABELS[currentRole] || currentRole;
                            const isSelf = u.user_id === user?.id;
                            return (
                              <Select
                                value={currentRole}
                                onValueChange={(v: AppRole) => stageRoleChange(u.user_id, v)}
                                disabled={isSelf}
                              >
                                <SelectTrigger
                                  className={`h-auto w-auto gap-1 border-0 bg-transparent p-0 shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:opacity-50 ${isSelf ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                  aria-label="Alterar cargo"
                                >
                                  <Badge variant={roleBadgeVariant(currentRole)} className={isPending ? 'ring-2 ring-primary/50' : ''}>
                                    {label}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  {availableRoles.map(r => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          })()}
                        </TableCell>
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
                            <Button variant="outline" size="sm" onClick={() => openResetDialog(u.user_id, u.name)} disabled={u.user_id === user?.id}>
                              <KeyRound className="h-3.5 w-3.5 mr-1" />
                              Senha
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnlockLogin(u.email, u.name)}
                              disabled={u.user_id === user?.id || unlockingFor === u.email || !u.email}
                              title="Zera as tentativas falhas e desbloqueia o login deste usuário"
                            >
                              {unlockingFor === u.email ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <Unlock className="h-3.5 w-3.5 mr-1" />
                              )}
                              Desbloquear login
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleForceRefresh(u.user_id, u.name)}
                              disabled={u.user_id === user?.id || forcingRefreshFor === u.user_id}
                              title="Limpa o cache e recarrega o app deste usuário na próxima verificação (até 2 minutos)"
                            >
                              {forcingRefreshFor === u.user_id ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                              )}
                              Forçar atualização
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={u.user_id === user?.id || signingOutUser === u.user_id}
                                  title="Encerra todas as sessões ativas deste usuário em todos os dispositivos"
                                  className="text-destructive hover:text-destructive"
                                >
                                  {signingOutUser === u.user_id ? (
                                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                  ) : (
                                    <LogOut className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  Derrubar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Derrubar {u.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Todas as sessões ativas deste usuário (em qualquer dispositivo) serão encerradas imediatamente. Ele precisará fazer login novamente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleSignOutUser(u.user_id, u.name)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Derrubar usuário
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
                        <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Nenhum usuário encontrado</TableCell>
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

        <TabsContent value="roles_permissions">
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Gerenciamento de Acessos
                </CardTitle>
                <CardDescription>
                  Unificamos a gestão de papéis e permissões. Configure as regras globais por papel ou ajuste acessos individuais.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="by_role" className="space-y-4">
                  <TabsList className="bg-muted/40 p-1 mb-4">
                    <TabsTrigger value="by_role" className="text-xs sm:text-sm font-bold px-4 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">Por Papel (Configuração do Sistema)</TabsTrigger>
                    <TabsTrigger value="by_user" className="text-xs sm:text-sm font-bold px-4 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">Por Usuário (Ajustes Específicos)</TabsTrigger>
                  </TabsList>
                  <TabsContent value="by_role">
                    <RolePermissionsManager />
                  </TabsContent>
                  <TabsContent value="by_user">
                    <PermissionsManager />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </TabsContent>



        <TabsContent value="audit">
          <ActivityLogsViewer />
        </TabsContent>

        <TabsContent value="access_log">
          <AccessLogViewer />
        </TabsContent>

        <TabsContent value="motivational">
          <MotivationalMessagesManager />
        </TabsContent>



        <TabsContent value="subgroups">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 font-bold">
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


        <TabsContent value="invites">
          <InviteLinkPanel />
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-6">
            <AdminStorageMetrics />
            <StorageUsageCard />
            <LockedAccountsPanel />
            <SecurityDashboard />
          </div>
        </TabsContent>


        <TabsContent value="system">
          <div className="space-y-8 pb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <DataIntegrityCheck />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <HealthCheck />
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <EmailLogs />
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                <CardHeader>
              <CardTitle className="flex items-center gap-2 font-bold">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" /> Monitoramento & Erros (Sentry/Metrics)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Taxa de Erro (24h)</p>
                      <p className="text-2xl font-bold text-emerald-400">0.02%</p>
                      <p className="text-[10px] text-slate-500 mt-1">Abaixo do limite de 1%</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Latência API (p95)</p>
                      <p className="text-2xl font-bold text-blue-400">142ms</p>
                      <p className="text-[10px] text-slate-500 mt-1">Região: us-east-1</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Disponibilidade</p>
                      <p className="text-2xl font-bold text-emerald-400">99.99%</p>
                      <p className="text-[10px] text-slate-500 mt-1">SLA mantido</p>
                    </div>
                  </div>
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      Integração com Sentry ativa. Erros críticos de frontend e timeout de requests no backend são reportados automaticamente para o painel de suporte Lovable.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
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
