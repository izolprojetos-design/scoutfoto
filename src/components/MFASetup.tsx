import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';
import { logAudit } from '@/lib/auditLog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const MFASetup = () => {
  const { user } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  // Enrollment state
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Disable state
  const [disableCode, setDisableCode] = useState('');
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totpFactors = data?.totp || [];
      const verified = totpFactors.filter(f => f.status === 'verified');
      setMfaEnabled(verified.length > 0);
      if (verified.length > 0) {
        setFactorId(verified[0].id);
      }
    } catch {
      // MFA not available
    }
    setLoading(false);
  };

  const handleStartEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'ScoutFoto Authenticator',
      });

      if (error) {
        toast.error('Erro ao iniciar configuração: ' + error.message);
        setEnrolling(false);
        return;
      }

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setSetupOpen(true);
    } catch (err) {
      toast.error('Erro inesperado');
    }
    setEnrolling(false);
  };

  const handleVerifyEnroll = async () => {
    if (verifyCode.length !== 6) {
      toast.error('Digite o código de 6 dígitos');
      return;
    }
    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        toast.error('Erro: ' + challengeError.message);
        setVerifying(false);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) {
        toast.error('Código inválido. Tente novamente.');
        setVerifying(false);
        return;
      }

      setMfaEnabled(true);
      setSetupOpen(false);
      setVerifyCode('');
      toast.success('Autenticação em dois fatores ativada com sucesso!');

      if (user) {
        await logAudit(user.id, 'mfa_enabled', undefined, { method: 'totp' });
      }
    } catch {
      toast.error('Erro inesperado');
    }
    setVerifying(false);
  };

  const handleDisableMfa = async () => {
    if (disableCode.length !== 6) {
      toast.error('Digite o código de 6 dígitos para confirmar');
      return;
    }
    setDisabling(true);
    try {
      // Verify code first
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        toast.error('Erro: ' + challengeError.message);
        setDisabling(false);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: disableCode,
      });

      if (verifyError) {
        toast.error('Código inválido.');
        setDisabling(false);
        return;
      }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (unenrollError) {
        toast.error('Erro ao desativar: ' + unenrollError.message);
        setDisabling(false);
        return;
      }

      setMfaEnabled(false);
      setDisableOpen(false);
      setDisableCode('');
      toast.success('Autenticação em dois fatores desativada.');

      if (user) {
        await logAudit(user.id, 'mfa_disabled', undefined, { method: 'totp' });
      }
    } catch {
      toast.error('Erro inesperado');
    }
    setDisabling(false);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Autenticação em Dois Fatores (2FA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            {mfaEnabled ? (
              <ShieldCheck className="h-8 w-8 text-emerald-500 shrink-0" />
            ) : (
              <ShieldOff className="h-8 w-8 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">Aplicativo Autenticador (TOTP)</p>
                <Badge variant={mfaEnabled ? 'default' : 'secondary'}>
                  {mfaEnabled ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {mfaEnabled
                  ? 'Sua conta está protegida com autenticação em dois fatores.'
                  : 'Adicione uma camada extra de segurança usando um aplicativo autenticador como Google Authenticator ou Authy.'}
              </p>
            </div>
          </div>

          {mfaEnabled ? (
            <Button variant="destructive" size="sm" onClick={() => setDisableOpen(true)}>
              <ShieldOff className="h-4 w-4 mr-2" />
              Desativar 2FA
            </Button>
          ) : (
            <Button onClick={handleStartEnroll} disabled={enrolling}>
              {enrolling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Ativar 2FA
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={setupOpen} onOpenChange={(open) => { if (!open) setSetupOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Configurar 2FA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">1</Badge>
                <Label className="font-medium">Escaneie o QR Code</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Abra seu aplicativo autenticador e escaneie o código abaixo:
              </p>
              {qrCode && (
                <div className="flex justify-center py-4">
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <img src={qrCode} alt="QR Code" className="h-48 w-48" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Ou insira manualmente:</p>
                <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={copySecret}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <code className="block rounded-lg bg-muted p-2 text-xs font-mono text-center break-all">
                {secret}
              </code>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">2</Badge>
                <Label className="font-medium">Verifique o código</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Digite o código de 6 dígitos exibido no aplicativo:
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button className="w-full" onClick={handleVerifyEnroll} disabled={verifying || verifyCode.length !== 6}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Ativar 2FA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={disableOpen} onOpenChange={(open) => { if (!open) setDisableOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" />
              Desativar 2FA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para desativar a autenticação em dois fatores, confirme com um código do seu aplicativo autenticador:
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={disableCode} onChange={setDisableCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button variant="destructive" className="w-full" onClick={handleDisableMfa} disabled={disabling || disableCode.length !== 6}>
              {disabling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
              Confirmar Desativação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MFASetup;
