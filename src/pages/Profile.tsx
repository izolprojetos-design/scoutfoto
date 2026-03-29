import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Camera, Save, Loader2, User, ImagePlus, Lock, Eye, EyeOff } from 'lucide-react';
import { validatePassword } from '@/lib/passwordValidation';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  chefe: 'Chefe Escoteiro',
  dirigente: 'Dirigente',
  
  viewer: 'Visitante',
};

const Profile = () => {
  const { profile, roles, user, isAdmin } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const initials = profile?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

  const handleSaveName = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Nome atualizado!');
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 2MB');
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `avatars/${user.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('scout-photos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error('Erro no upload: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('scout-photos').getPublicUrl(path);
    const newUrl = urlData.publicUrl + '?t=' + Date.now();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: newUrl })
      .eq('user_id', user.id);

    if (updateError) {
      toast.error('Erro ao salvar avatar: ' + updateError.message);
    } else {
      setAvatarUrl(newUrl);
      toast.success('Foto de perfil atualizada!');
    }
    setUploading(false);
  };

  const primaryRole = roles[0] || 'viewer';

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <User className="mr-2 inline h-7 w-7" />
            Meu Perfil
          </h1>
          <p className="mt-1 text-muted-foreground">Gerencie suas informações pessoais</p>
        </div>

        {/* Avatar Card */}
        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <div className="relative">
              <Avatar className="h-28 w-28 border-4 border-primary/20">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={profile?.name} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 flex gap-1">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-9 w-9 rounded-full shadow-md"
                  onClick={() => cameraRef.current?.click()}
                  disabled={uploading}
                  title="Tirar foto"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-9 w-9 rounded-full shadow-md"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  title="Escolher da galeria"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
              </div>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold">{profile?.name}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <Badge variant="default" className="mt-2">{roleLabel[primaryRole]}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Edit Name */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="h-11"
                disabled={!isAdmin}
              />
              {!isAdmin && (
                <p className="text-xs text-muted-foreground">Apenas o administrador pode alterar o nome</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || ''} disabled className="h-11 bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={roleLabel[primaryRole]} disabled className="h-11 bg-muted" />
              <p className="text-xs text-muted-foreground">O cargo é definido pelo administrador</p>
            </div>
            {isAdmin && <Button onClick={handleSaveName} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Profile;
