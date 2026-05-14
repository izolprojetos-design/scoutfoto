import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error('Erro ao enviar email: ' + error.message);
    } else {
      setSent(true);
      toast.success('Email de recuperação enviado!');
    }
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Recuperar senha — ScoutFoto</title>
        <meta name="description" content="Receba um e-mail para redefinir sua senha do ScoutFoto, banco de imagens do 12º GEMC." />
        <link rel="canonical" href="https://scoutfoto.app/forgot-password" />
        <meta property="og:title" content="Recuperar senha — ScoutFoto" />
        <meta property="og:description" content="Redefinição de senha por e-mail no ScoutFoto." />
        <meta property="og:url" content="https://scoutfoto.app/forgot-password" />
      </Helmet>
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px]"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl scout-gradient shadow-lg overflow-hidden p-2">
            <img src="/logo.png" alt="ScoutFoto Logo" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Recuperar Senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Digite seu email para receber o link de recuperação
          </p>
        </div>

        <Card className="border shadow-sm">
          <CardContent className="p-6">
            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Enviar link de recuperação
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Email enviado!</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Verifique sua caixa de entrada e spam. O link expira em 1 hora.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Caso não receba, entre em contato com o administrador do sistema para redefinir sua senha.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
        </div>
      </motion.div>
      </main>
    </>
  );
};

export default ForgotPassword;
