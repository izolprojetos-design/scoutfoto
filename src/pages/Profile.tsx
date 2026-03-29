import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logAudit } from '@/lib/auditLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Camera, Save, Loader2, User, ImagePlus, Lock, Eye, EyeOff } from 'lucide-react';
import { validatePassword } from '@/lib/passwordValidation';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';
import DevicesSection from '@/components/profile/DevicesSection';

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

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const passwordValidation = validatePassword(newPassword);

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

        {/* Change Password */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={newPassword} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirm-new-password"
                  type={showConfirmPw ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              onClick={async () => {
                if (!currentPassword) {
                  toast.error('Digite sua senha atual');
                  return;
                }
                if (!passwordValidation.isValid) {
                  toast.error('A nova senha não atende aos requisitos mínimos');
                  return;
                }
                if (newPassword !== confirmNewPassword) {
                  toast.error('As senhas não coincidem');
                  return;
                }
                setChangingPassword(true);
                // Verify current password by attempting sign in
                const { error: verifyError } = await supabase.auth.signInWithPassword({
                  email: profile?.email || '',
                  password: currentPassword,
                });
                if (verifyError) {
                  toast.error('Senha atual incorreta');
                  setChangingPassword(false);
                  return;
                }
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                if (error) {
                  toast.error('Erro ao alterar senha: ' + error.message);
                } else {
                  toast.success('Senha alterada! Todas as sessões foram encerradas. Faça login novamente.');
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  // Revoke all sessions after password change
                  setTimeout(() => {
                    supabase.auth.signOut({ scope: 'global' });
                  }, 2000);
                }
                setChangingPassword(false);
              }}
              disabled={changingPassword || !passwordValidation.isValid || !currentPassword || newPassword !== confirmNewPassword}
              className="gap-2"
            >
              {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Alterar Senha
            </Button>
          </CardContent>
        </Card>

        {/* Connected Devices */}
        <DevicesSection />
      </div>
    </AppLayout>
  );
};

export default Profile;
