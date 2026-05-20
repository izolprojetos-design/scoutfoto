import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface User {
  user_id: string;
  name: string;
  email: string;
}

export const GoogleDriveExceptions = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: usersData } = await supabase.from('profiles').select('user_id, name, email');
      const { data: permsData } = await supabase.from('user_permissions').select('*');
      setUsers(usersData || []);
      setPermissions(permsData || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const togglePermission = async (userId: string, permissionKey: string, checked: boolean) => {
    // Find permission ID
    const { data: pData } = await supabase.from('permissions').select('id').eq('key', permissionKey).single();
    if (!pData) return;

    if (checked) {
      await supabase.from('user_permissions').insert({ user_id: userId, permission_id: pData.id });
      setPermissions([...permissions, { user_id: userId, permission_id: pData.id }]);
    } else {
      await supabase.from('user_permissions').delete().eq('user_id', userId).eq('permission_id', pData.id);
      setPermissions(permissions.filter(p => !(p.user_id === userId && p.permission_id === pData.id)));
    }
    toast.success('Permissão atualizada!');
  };

  if (loading) return <Loader2 className="animate-spin" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exceções por Integrante</CardTitle>
        <CardDescription>Habilite acesso específico para usuários que não deveriam ter permissão global</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Fotos</TableHead>
              <TableHead>Vídeos</TableHead>
              <TableHead>Documentos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => {
              const userPerms = permissions.filter(p => p.user_id === user.user_id).map(p => p.permission_id);
              // Map keys to IDs
              const imgId = 'f8a62f91-acf1-46f1-bb44-2415d6cf3486';
              const vidId = 'b85f1a92-b1b0-4399-86e6-32e6766e4f00';
              const docId = '1973e42e-6ff9-43c1-8a6d-30094e514808';

              return (
                <TableRow key={user.user_id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell><Checkbox checked={userPerms.includes(imgId)} onCheckedChange={(c) => togglePermission(user.user_id, 'google_drive_images', !!c)} /></TableCell>
                  <TableCell><Checkbox checked={userPerms.includes(vidId)} onCheckedChange={(c) => togglePermission(user.user_id, 'google_drive_videos', !!c)} /></TableCell>
                  <TableCell><Checkbox checked={userPerms.includes(docId)} onCheckedChange={(c) => togglePermission(user.user_id, 'google_drive_documents', !!c)} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
