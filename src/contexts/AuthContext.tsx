import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { logAudit } from '@/lib/auditLog';
import { checkAndRegisterDevice } from '@/lib/deviceDetection';
import { notifyNewDevice, notifyLoginSuccess } from '@/lib/securityNotifications';

type AppRole = Database['public']['Enums']['app_role'];

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  must_change_password: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  mfaRequired: boolean;
  mfaVerified: boolean;
  setMfaVerified: (v: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isChefe: boolean;
  isDirigente: boolean;
  canUpload: boolean;
  canViewMinors: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    setProfile(data);
  };

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    setRoles(data?.map(r => r.role) || []);
  };

  const checkMfaStatus = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.filter(f => f.status === 'verified') || [];
      if (verified.length > 0) {
        // Check current AAL level
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2') {
          setMfaRequired(true);
          setMfaVerified(false);
        } else {
          setMfaRequired(false);
          setMfaVerified(true);
        }
      } else {
        setMfaRequired(false);
        setMfaVerified(false);
      }
    } catch {
      setMfaRequired(false);
    }
  };

  // Inactivity timeout: 30 minutes
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_LIMIT = 30 * 60 * 1000;
    const WARNING_BEFORE = 5 * 60 * 1000;
    const THROTTLE_MS = 2000;
    let logoutTimer: ReturnType<typeof setTimeout>;
    let warningTimer: ReturnType<typeof setTimeout>;
    let warningToastId: string | number | undefined;
    let lastReset = 0;

    const resetTimerCore = () => {
      clearTimeout(logoutTimer);
      clearTimeout(warningTimer);
      if (warningToastId) {
        toast.dismiss(warningToastId);
        warningToastId = undefined;
      }

      warningTimer = setTimeout(() => {
        warningToastId = toast.warning('Sua sessão expira em 5 minutos por inatividade. Mova o mouse ou pressione uma tecla para continuar.', {
          duration: WARNING_BEFORE,
          id: 'session-warning',
        });
      }, INACTIVITY_LIMIT - WARNING_BEFORE);

      logoutTimer = setTimeout(() => {
        toast.dismiss('session-warning');
        supabase.auth.signOut();
        toast.info('Sessão encerrada por inatividade.');
      }, INACTIVITY_LIMIT);
    };

    const resetTimer = () => {
      const now = Date.now();
      if (now - lastReset < THROTTLE_MS) return;
      lastReset = now;
      resetTimerCore();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimerCore();

    return () => {
      clearTimeout(logoutTimer);
      clearTimeout(warningTimer);
      toast.dismiss('session-warning');
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchRoles(session.user.id);
            checkMfaStatus();
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setMfaRequired(false);
          setMfaVerified(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRoles(session.user.id);
        checkMfaStatus();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      try {
        await logAudit(data.user.id, 'login', undefined, { email });
      } catch {}

      try {
        const { isNewDevice, deviceInfo } = await checkAndRegisterDevice(data.user.id);
        if (isNewDevice) {
          toast.warning(
            `Novo dispositivo detectado: ${deviceInfo.deviceName} (${deviceInfo.browser}). Se não foi você, altere sua senha imediatamente.`,
            { duration: 10000, id: 'new-device-alert' }
          );
          await logAudit(data.user.id, 'login', undefined, {
            email,
            new_device: true,
            device: deviceInfo.deviceName,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
          });
          notifyNewDevice(data.user.id, deviceInfo.deviceName, deviceInfo.browser);
        } else {
          notifyLoginSuccess(data.user.id);
        }
      } catch {}

      // Check MFA
      await checkMfaStatus();
    }
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin,
      },
    });

    // Send welcome email (fire-and-forget)
    if (!error && data.user) {
      supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'welcome',
          recipientEmail: email,
          idempotencyKey: `welcome-${data.user.id}`,
          templateData: { name },
        },
      }).catch(() => {});
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole('admin');
  const isChefe = hasRole('chefe');
  const isDirigente = hasRole('dirigente');
  const canUpload = isAdmin || isChefe || isDirigente;
  const canViewMinors = isAdmin || isChefe || isDirigente;

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, loading,
      mfaRequired, mfaVerified, setMfaVerified,
      signIn, signUp, signOut, hasRole,
      isAdmin, isChefe, isDirigente, canUpload, canViewMinors,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
