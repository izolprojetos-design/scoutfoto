import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldAlert, Loader2, Eye, EyeOff } from 'lucide-react';
import { validatePassword } from '@/lib/passwordValidation';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';

const ForceChangePassword = () => {
  const { profile, user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const mustChange = profile?.must_change_password === true;
  const validation = validatePassword(password);

  const handleChangePassword = async () => {
    if (!validation.isValid) {
      toast.error('A senha não atende aos requisitos mínimos');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error('Erro ao alterar senha: ' + error.message);
    } else {
      await supabase.from('profiles').update({ must_change_password: false }).eq('user_id', user!.id);
      toast.success('Senha alterada com sucesso!');
      window.location.reload();
    }
    setSaving(false);
  };

  if (!mustChange) return null;

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Troca de Senha Obrigatória
          </DialogTitle>
          <DialogDescription>
            Sua senha foi redefinida pelo administrador. Por segurança, você precisa criar uma nova senha antes de continuar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrengthIndicator password={password} />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={saving || !validation.isValid} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            Alterar Senha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ForceChangePassword;
