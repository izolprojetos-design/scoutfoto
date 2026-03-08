import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, Users, Shield, ImageIcon, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  role: AppRole;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  image_id: string | null;
  created_at: string;
  details: Record<string, unknown>;
}

interface Stats {
  totalImages: number;
  branchCounts: { name: string; count: number }[];
  recentUploads: number;
}

const Admin = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats>({ totalImages: 0, branchCounts: [], recentUploads: 0 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

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
        };
      });
      setUsers(merged);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    const { count: totalImages } = await supabase.from('images').select('*', { count: 'exact', head: true });

    const { data: branches } = await supabase.from('branches').select('id, display_name');
    const branchCounts: { name: string; count: number }[] = [];
    if (branches) {
      for (const b of branches) {
        const { count } = await supabase.from('images').select('*', { count: 'exact', head: true }).eq('branch_id', b.id);
        branchCounts.push({ name: b.display_name, count: count || 0 });
      }
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: recentUploads } = await supabase.from('images').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString());

    setStats({ totalImages: totalImages || 0, branchCounts, recentUploads: recentUploads || 0 });
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
    fetchStats();
    fetchAuditLogs();
  }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    await supabase.from('user_roles').delete().eq('user_id', userId);
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
    if (error) {
      toast.error('Erro ao alterar papel: ' + error.message);
    } else {
      toast.success('Papel atualizado!');
      fetchUsers();
    }
  };

  const toggleActive = async (userId: string, currentActive: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_active: !currentActive }).eq('user_id', userId);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success(currentActive ? 'Usuário desativado' : 'Usuário ativado');
      fetchUsers();
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'destructive' as const;
      case 'chefe': return 'default' as const;
      case 'uploader': return 'default' as const;
      default: return 'secondary' as const;
    }
  };

  const userNameById = (uid: string) => users.find(u => u.user_id === uid)?.name || uid.slice(0, 8);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
          <Shield className="mr-2 inline h-7 w-7" />
          Painel Administrativo
        </h1>
        <p className="mt-1 text-muted-foreground">Gerencie usuários, permissões e acompanhe atividades</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center p-4">
            <ImageIcon className="mb-1 h-6 w-6 text-primary" />
            <p className="text-2xl font-bold">{stats.totalImages}</p>
            <p className="text-xs text-muted-foreground">Total de fotos</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center p-4">
            <Users className="mb-1 h-6 w-6 text-primary" />
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-xs text-muted-foreground">Usuários</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center p-4">
            <Activity className="mb-1 h-6 w-6 text-primary" />
            <p className="text-2xl font-bold">{stats.recentUploads}</p>
            <p className="text-xs text-muted-foreground">Uploads (7 dias)</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center p-4">
            <Shield className="mb-1 h-6 w-6 text-primary" />
            <p className="text-2xl font-bold">{auditLogs.length}</p>
            <p className="text-xs text-muted-foreground">Logs de auditoria</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuários ({filtered.length})
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="chefe">Chefe</SelectItem>
                      <SelectItem value="uploader">Uploader</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(u => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell><Badge variant={roleBadgeVariant(u.role)}>{u.role}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={u.is_active ? 'default' : 'secondary'}>
                            {u.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Select
                              value={u.role}
                              onValueChange={(v: AppRole) => handleRoleChange(u.user_id, v)}
                              disabled={u.user_id === user?.id}
                            >
                              <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="chefe">Chefe</SelectItem>
                                <SelectItem value="uploader">Uploader</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="parent">Parent</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="outline" size="sm" onClick={() => toggleActive(u.user_id, u.is_active)} disabled={u.user_id === user?.id}>
                              {u.is_active ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum usuário encontrado</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Fotos por Ramo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.branchCounts.map(bc => (
                  <div key={bc.name} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <span className="font-medium">{bc.name}</span>
                    <Badge variant="secondary">{bc.count} fotos</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Logs de Auditoria (últimos 100)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Imagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="text-sm">{userNameById(log.user_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.image_id?.slice(0, 8) || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {auditLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum log encontrado</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Admin;
