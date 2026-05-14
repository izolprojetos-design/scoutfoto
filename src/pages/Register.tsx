import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Shield, Eye, EyeOff, AlertCircle, UserPlus, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';
import { validatePassword } from '@/lib/passwordValidation';
import { Helmet } from 'react-helmet-async';

const Register = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteExpired, setInviteExpired] = useState(false);
  const [inviteUsed, setInviteUsed] = useState(false);
  const [inviteRole, setInviteRole] = useState('');
  const [inviteSection, setInviteSection] = useState('');
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      const { data, error } = await supabase
        .rpc('get_invite_link_by_token', { p_token: token });

      if (error || !data || data.length === 0) {
        setLoading(false);
        return;
      }

      const invite = data[0];

      setInviteValid(true);
      setInviteRole(invite.role);
      setInviteSection(invite.section || '');
      setLoading(false);
    };

    validateToken();
  }, [token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Preencha todos os campos');
      return;
    }

    const pwValidation = validatePassword(password);
    if (!pwValidation.isValid) {
      setError('A senha não atende aos requisitos mínimos de segurança');
      return;
    }

    setSubmitting(true);

    // Use the edge function to create user with the invite token
    const { data, error: fnError } = await supabase.functions.invoke('admin-create-user', {
      body: {
        action: 'register-invite',
        token,
        name: name.trim(),
        email: email.trim(),
        password,
      },
    });

    if (fnError || data?.error) {
      const rawError = data?.error || fnError?.message || 'Erro ao criar conta';
      const friendly = /weak|known|pwned|compromised|easy to guess/i.test(rawError)
        ? 'Esta senha aparece em vazamentos públicos e foi considerada insegura. Escolha outra senha, de preferência única, com mais de 12 caracteres.'
        : rawError;
      setError(friendly);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token || (!inviteValid && !inviteExpired && !inviteUsed)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold text-foreground">Link inválido</h1>
            <p className="text-muted-foreground">Este link de convite não é válido. Solicite um novo link ao administrador.</p>
            <Link to="/login">
              <Button variant="outline">Ir para o login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteUsed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500" />
            <h1 className="text-xl font-bold text-foreground">Link já utilizado</h1>
            <p className="text-muted-foreground">Este link de convite já foi utilizado. Se você já possui uma conta, faça login.</p>
            <Link to="/login">
              <Button variant="outline">Ir para o login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500" />
            <h1 className="text-xl font-bold text-foreground">Link expirado</h1>
            <p className="text-muted-foreground">Este link de convite expirou. Solicite um novo link ao administrador.</p>
            <Link to="/login">
              <Button variant="outline">Ir para o login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="w-full max-w-md border-0 shadow-xl">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Conta criada com sucesso!</h1>
              <p className="text-muted-foreground">Sua conta foi criada. Você já pode fazer login.</p>
              <Link to="/login">
                <Button className="gap-2">Ir para o login</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const roleLabel = inviteRole === 'voluntario' ? 'Voluntário' : inviteRole === 'chefe' ? 'Chefe' : inviteRole === 'viewer' ? 'Visualizador' : inviteRole;

  return (
    <>
      <Helmet>
        <title>Criar conta — ScoutFoto</title>
        <meta name="description" content="Crie sua conta no ScoutFoto a partir de um convite enviado pelo administrador do grupo escoteiro." />
        <link rel="canonical" href="https://scoutfoto.app/register" />
        <meta property="og:title" content="Criar conta — ScoutFoto" />
        <meta property="og:description" content="Cadastro mediante convite no banco de imagens do 12º GEMC." />
        <meta property="og:url" content="https://scoutfoto.app/register" />
      </Helmet>
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md"
      >
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-3">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Space Grotesk' }}>
            ScoutFoto
          </h1>
          <p className="text-sm text-muted-foreground">Crie sua conta para acessar o sistema</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardContent className="p-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={password} />
              </div>

              {inviteRole && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Cargo:</span> {roleLabel}
                  {inviteSection && (
                    <> · <span className="font-medium text-foreground">Seção:</span> {inviteSection}</>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Criar Conta
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Faça login
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      </main>
    </>
  );
};

export default Register;
