import { supabase } from '@/integrations/supabase/client';

type Priority = 'high' | 'medium' | 'info';

interface NotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  priority: Priority;
  metadata?: Record<string, unknown>;
}

export const createSecurityNotification = async (params: NotificationParams) => {
  try {
    await supabase.from('security_notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority,
      metadata: (params.metadata || {}) as any,
    });
  } catch {
    // Fire-and-forget, don't break auth flows
  }
};

export const notifyNewDevice = (userId: string, device: string, browser: string) =>
  createSecurityNotification({
    userId,
    type: 'new_device',
    title: 'Novo dispositivo detectado',
    message: `Login realizado em um novo dispositivo: ${device} (${browser}). Se não foi você, altere sua senha imediatamente.`,
    priority: 'high',
    metadata: { device, browser },
  });

export const notifyPasswordChanged = (userId: string) =>
  createSecurityNotification({
    userId,
    type: 'password_changed',
    title: 'Senha alterada',
    message: 'Sua senha foi alterada com sucesso. Se não foi você, entre em contato com o administrador.',
    priority: 'medium',
  });

export const notifyMfaEnabled = (userId: string) =>
  createSecurityNotification({
    userId,
    type: 'mfa_enabled',
    title: 'Autenticação em duas etapas ativada',
    message: 'A verificação em duas etapas (2FA) foi ativada na sua conta.',
    priority: 'info',
  });

export const notifyMfaDisabled = (userId: string) =>
  createSecurityNotification({
    userId,
    type: 'mfa_disabled',
    title: 'Autenticação em duas etapas desativada',
    message: 'A verificação em duas etapas (2FA) foi desativada. Recomendamos mantê-la ativa para maior segurança.',
    priority: 'high',
  });

export const notifyFailedAttempts = (userId: string, attempts: number) =>
  createSecurityNotification({
    userId,
    type: 'failed_attempts',
    title: 'Tentativas de login falharam',
    message: `Foram detectadas ${attempts} tentativas de login sem sucesso na sua conta. Se não foi você, altere sua senha.`,
    priority: 'high',
    metadata: { attempts },
  });

export const notifyAccountLocked = (userId: string) =>
  createSecurityNotification({
    userId,
    type: 'account_locked',
    title: 'Conta bloqueada temporariamente',
    message: 'Sua conta foi bloqueada por 15 minutos devido a múltiplas tentativas de login incorretas.',
    priority: 'high',
  });

export const notifyLoginSuccess = (userId: string) =>
  createSecurityNotification({
    userId,
    type: 'login_success',
    title: 'Login realizado',
    message: 'Um login foi realizado na sua conta com sucesso.',
    priority: 'info',
  });
