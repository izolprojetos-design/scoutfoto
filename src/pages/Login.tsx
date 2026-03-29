import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield, Camera, Users, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setLoginError('E-mail ou senha incorretos. Por favor, tente novamente.');
    } else {
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
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 scout-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-2xl backdrop-blur-sm">
                ⚜️
              </div>
              <span className="text-2xl font-bold tracking-tight">ScoutFoto</span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-balance">
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
                  className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 backdrop-blur-sm"
                >
                  <f.icon className="h-5 w-5 text-white/90" />
                  <span className="text-sm font-medium text-white/90">{f.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} ScoutFoto — Feito com ❤️ para o escotismo
          </p>
        </div>

        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
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
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl scout-gradient text-3xl shadow-lg"
            >
              ⚜️
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">ScoutFoto</h1>
            <p className="mt-1 text-sm text-muted-foreground">Banco de imagens escoteiro</p>
          </div>

          {/* Desktop heading */}
          <div className="mb-6 hidden lg:block">
            <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
            <p className="mt-1 text-muted-foreground">Acesse sua conta para continuar</p>
          </div>

          <Card className="border shadow-sm">
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
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Senha</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Não tem conta? Solicite ao administrador do sistema.
              </p>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} ScoutFoto
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
