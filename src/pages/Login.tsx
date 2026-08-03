import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Shield, Camera, Users, Eye, EyeOff, AlertCircle, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkLoginBlock, recordFailedAttempt, clearLoginAttempts, formatLockoutTime } from '@/lib/loginRateLimit';
import { logAudit } from '@/lib/auditLog';
import { supabase } from '@/integrations/supabase/client';
import LogoCircle from '@/components/LogoCircle';
import { Helmet } from 'react-helmet-async';


const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { canViewPhotos } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Tick down lockout countdown locally; refresh from server periodically
  useEffect(() => {
    let cancelled = false;
    const refreshFromServer = async () => {
      if (!email) return;
      const { locked, remainingMs } = await checkLoginBlock(email);
      if (!cancelled) setLockoutRemaining(locked ? remainingMs : 0);
    };
    refreshFromServer();
    const tick = setInterval(() => {
      setLockoutRemaining(prev => (prev > 1000 ? prev - 1000 : 0));
    }, 1000);
    const sync = setInterval(refreshFromServer, 30000);
    return () => { cancelled = true; clearInterval(tick); clearInterval(sync); };
  }, [email]);

  const isLocked = lockoutRemaining > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const preCheck = await checkLoginBlock(email);
    if (preCheck.locked) {
      setLockoutRemaining(preCheck.remainingMs);
      setLoginError(`Conta bloqueada. Tente novamente em ${formatLockoutTime(preCheck.remainingMs)} ou contate um administrador.`);
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      const { locked, attemptsLeft, remainingMs } = await recordFailedAttempt(email);

      try {
        await logAudit('00000000-0000-0000-0000-000000000000', 'login_failed' as any, undefined, { email, reason: 'invalid_credentials' });
      } catch {}

      if (locked) {
        setLockoutRemaining(remainingMs || 15 * 60 * 1000);
        setLoginError(`Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em ${formatLockoutTime(remainingMs || 15 * 60 * 1000)} ou contate um administrador.`);

        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'security-account-locked',
            recipientEmail: email,
            idempotencyKey: `account-locked-${email}-${Date.now()}`,
            templateData: {
              name: email.split('@')[0],
              attempts: 5,
              lockDuration: '15 minutos',
            },
          },
        }).catch(() => {});
      } else {
        setLoginError(`E-mail ou senha incorretos. ${attemptsLeft} tentativa${attemptsLeft === 1 ? '' : 's'} restante${attemptsLeft === 1 ? '' : 's'}.`);
      }
    } else {
      await clearLoginAttempts(email);
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const features = [
    { icon: Camera, text: 'Upload seguro de fotos' },
    { icon: Shield, text: 'Proteção de menores' },
    { icon: Users, text: 'Compartilhamento controlado' },
  ];

  return (
    <>
      <Helmet>
        <title>Entrar — ScoutFoto</title>
        <meta name="description" content="Acesse o ScoutFoto, banco de imagens do Grupo Escoteiro Monte Caburaí (12º GEMC). Apenas integrantes e voluntários autorizados." />
        <link rel="canonical" href="https://scoutfoto.app/login" />
        <meta property="og:title" content="Entrar — ScoutFoto" />
        <meta property="og:description" content="Acesso restrito a integrantes e voluntários do 12º GEMC." />
        <meta property="og:url" content="https://scoutfoto.app/login" />
      </Helmet>
      <main className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 scout-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <LogoCircle size="sm" shadowClassName="shadow-lg" ringClassName="ring-white/20" />
              <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>ScoutFoto</span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-balance" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Todas as aventuras escoteiras em um só lugar
              </h1>
              <p className="mt-4 text-lg text-white/80 leading-relaxed">
                Organize, proteja e compartilhe fotos de atividades do seu grupo escoteiro com segurança e praticidade.
              </p>
            </div>

            <div className="space-y-3">
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.15 }}
                  className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm border border-white/5"
                >
                  <f.icon className="h-5 w-5 text-secondary" />
                  <span className="text-sm font-medium text-white/90">{f.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} ScoutFoto - Todos os direitos reservados
          </p>
        </div>

        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-secondary/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />
      </div>

      {/* Right Panel - Login Only */}
      <div className="flex w-full items-center justify-center px-4 py-8 lg:w-1/2 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile Logo */}
          <div className="mb-8 text-center lg:hidden">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4 w-fit"
            >
              <LogoCircle size="md" shadowClassName="shadow-xl" ringClassName="ring-primary/10" />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">ScoutFoto</h1>
            <p className="mt-1 text-sm text-muted-foreground">Banco de imagens escoteiro</p>
          </div>

          {/* Desktop heading */}
          <div className="mb-6 hidden lg:block">
            <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
            <p className="mt-1 text-muted-foreground">Acesse sua conta para continuar</p>
          </div>

          <Card className="border shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="h-11"
                    tabIndex={1}
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="h-11 pr-10"
                      tabIndex={2}
                      disabled={isLocked}
                    />
                    <button
                      type="button"
                      tabIndex={3}
                      onPointerDown={(e) => { e.preventDefault(); setShowPassword(!showPassword); }}
                      className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation"
                    >
                      <Eye className={`h-4 w-4 absolute transition-opacity duration-150 ${showPassword ? 'opacity-0' : 'opacity-100'}`} />
                      <EyeOff className={`h-4 w-4 absolute transition-opacity duration-150 ${showPassword ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {(loginError || isLocked) && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
                    >
                      {isLocked ? (
                        <Lock className="h-4 w-4 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                      )}
                      {isLocked
                        ? `Conta bloqueada. Tente novamente em ${formatLockoutTime(lockoutRemaining)}.`
                        : loginError}
                    </motion.div>
                  )}
                </AnimatePresence>
                <Button type="submit" className="w-full h-11 font-semibold rounded-xl" disabled={loading || isLocked} tabIndex={4}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLocked ? 'Bloqueado' : 'Entrar'}
                </Button>
              </form>

              <div className="mt-3 text-center">
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline"
                  tabIndex={5}
                >
                  Esqueci minha senha
                </Link>
              </div>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Não tem conta? Solicite ao administrador do sistema.
              </p>
            </CardContent>
          </Card>

          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} ScoutFoto - Todos os direitos reservados
            </p>
          </div>
        </motion.div>
      </div>
      </main>
    </>
  );
};

export default Login;
