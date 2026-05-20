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
  const [userPermissions, setUserPermissions] = useState<any[]>([]);
  const [drivePermissions, setDrivePermissions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [uRes, upRes, pRes] = await Promise.all([
        supabase.from('profiles').select('user_id, name, email'),
        supabase.from('user_permissions').select('*'),
        supabase.from('permissions').select('id, key').like('key', 'google_drive_%')
      ]);
      
      setUsers(uRes.data || []);
      setUserPermissions(upRes.data || []);
      
      const pMap: Record<string, string> = {};
      pRes.data?.forEach(p => {
        pMap[p.key] = p.id;
      });
      setDrivePermissions(pMap);
      setLoading(false);
    };
    fetchData();
  }, []);

  const togglePermission = async (userId: string, permissionKey: string, checked: boolean) => {
    const permissionId = drivePermissions[permissionKey];
    if (!permissionId) return;

    if (checked) {
      const { error } = await supabase.from('user_permissions').insert({ user_id: userId, permission_id: permissionId });
      if (error) {
        toast.error('Erro ao salvar: ' + error.message);
        return;
      }
      setUserPermissions([...userPermissions, { user_id: userId, permission_id: permissionId }]);
    } else {
      const { error } = await supabase.from('user_permissions').delete().eq('user_id', userId).eq('permission_id', permissionId);
      if (error) {
        toast.error('Erro ao remover: ' + error.message);
        return;
      }
      setUserPermissions(userPermissions.filter(p => !(p.user_id === userId && p.permission_id === permissionId)));
    }
    toast.success('Permissão atualizada!');
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Exceções por Integrante</CardTitle>
        <CardDescription>Habilite acesso específico para usuários que não deveriam ter permissão global</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-center">Fotos</TableHead>
                <TableHead className="text-center">Vídeos</TableHead>
                <TableHead className="text-center">Documentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const userPermIds = userPermissions.filter(p => p.user_id === user.user_id).map(p => p.permission_id);
                
                return (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={userPermIds.includes(drivePermissions['google_drive_images'])} 
                        onCheckedChange={(c) => togglePermission(user.user_id, 'google_drive_images', !!c)} 
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={userPermIds.includes(drivePermissions['google_drive_videos'])} 
                        onCheckedChange={(c) => togglePermission(user.user_id, 'google_drive_videos', !!c)} 
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={userPermIds.includes(drivePermissions['google_drive_documents'])} 
                        onCheckedChange={(c) => togglePermission(user.user_id, 'google_drive_documents', !!c)} 
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
