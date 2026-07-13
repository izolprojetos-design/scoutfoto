import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { logAudit } from '@/lib/auditLog';
import { checkAndRegisterDevice } from '@/lib/deviceDetection';
import { notifyNewDevice, notifyLoginSuccess } from '@/lib/securityNotifications';
import { ROLE_PRIORITY } from '@/lib/userRoles';

type AppRole = Database['public']['Enums']['app_role'];

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  must_change_password: boolean;
  section: string | null;
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
  refreshProfile: () => Promise<void>;

  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isVoluntario: boolean;
  canUpload: boolean;
  canViewMinors: boolean;
  refreshRoles: () => Promise<void>;
  simulateRoles: (roles: AppRole[] | null) => void;
  isSimulating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [simulatedRoles, setSimulatedRoles] = useState<AppRole[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setProfile(data ?? null);
  }, []);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const sortedRoles = (data?.map(r => r.role) || []).sort(
      (a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b)
    );

    setRoles(sortedRoles);
  }, []);

  const checkMfaStatus = useCallback(async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.filter(f => f.status === 'verified') || [];
      if (verified.length > 0) {
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
  }, []);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setMfaRequired(false);
    setMfaVerified(false);
  }, []);

  const handleExpiredSession = useCallback(async (showToast = true) => {
    clearAuthState();
    setLoading(false);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

    if (showToast) {
      toast.info('Sua sessão expirou. Faça login novamente.');
    }
  }, [clearAuthState]);

  // Refs mirroring latest state so syncSessionState stays stable (no re-subscribe loop)
  const userRef = useRef<User | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<Profile | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  const syncSessionState = useCallback(async (nextSession: Session | null, showExpiredToast = true, skipValidation = false) => {
    if (!nextSession) {
      if (userRef.current || sessionRef.current || profileRef.current) {
        clearAuthState();
      }
      setLoading(false);
      return;
    }

    // Only set loading if we don't have a session or if it's a new user
    const currentUser = userRef.current;
    const isNewUser = !currentUser || currentUser.id !== nextSession.user.id;
    if (isNewUser) {
      setLoading(true);
    }

    let activeSession = nextSession;
    const expiresSoon = typeof activeSession.expires_at === 'number' && activeSession.expires_at * 1000 <= Date.now() + 30_000;

    if (expiresSoon) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        await handleExpiredSession(showExpiredToast);
        return;
      }
      activeSession = data.session;
    }

    let validatedUser = activeSession.user ?? null;

    if (!skipValidation) {
      const userCheck = await supabase.auth.getUser(activeSession.access_token);
      if (userCheck.error || !userCheck.data.user) {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
          await handleExpiredSession(showExpiredToast);
          return;
        }
        activeSession = data.session;
        validatedUser = activeSession.user;
      } else {
        validatedUser = userCheck.data.user;
      }
    }

    // Only update state if something actually changed to avoid unnecessary re-renders
    if (isNewUser || sessionRef.current?.access_token !== activeSession.access_token) {
      setSession(activeSession);
      setUser(validatedUser);

      await Promise.all([
        fetchProfile(validatedUser.id),
        fetchRoles(validatedUser.id),
        checkMfaStatus(),
      ]);

      // Atualiza last_login_at do dispositivo atual em toda restauração/renovação de sessão
      // para que a lista de "Dispositivos Conectados" mostre horário real do último acesso.
      try {
        void checkAndRegisterDevice(validatedUser.id);
      } catch {}
    }


    setLoading(false);
  }, [checkMfaStatus, clearAuthState, fetchProfile, fetchRoles, handleExpiredSession]);

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
    let initialHandled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSes) => {
        if (event === 'SIGNED_OUT') {
          clearAuthState();
          setLoading(false);
          return;
        }

        if (event === 'INITIAL_SESSION') {
          if (initialHandled) return;
          initialHandled = true;
          void syncSessionState(nextSes, false, true);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          // Avoid triggering sync for minor events if we already have a valid session
          if (event === 'TOKEN_REFRESHED' && sessionRef.current?.access_token === nextSes?.access_token) {
            return;
          }

          setTimeout(() => {
            void syncSessionState(nextSes, true, false);
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: fallbackSes } }) => {
      if (!initialHandled) {
        initialHandled = true;
        void syncSessionState(fallbackSes, false, true);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

          supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'security-new-device',
              recipientEmail: email,
              idempotencyKey: `new-device-${data.user.id}-${Date.now()}`,
              templateData: {
                name: data.user.user_metadata?.name || email.split('@')[0],
                device: deviceInfo.deviceName,
                browser: deviceInfo.browser,
                loginTime: new Date().toLocaleString('pt-BR'),
              },
            },
          }).catch(() => {});
        } else {
          notifyLoginSuccess(data.user.id);
        }
      } catch {}

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
    // Garante que toda subscription de Realtime atrelada à sessão atual
    // (ex.: agendamentos, notificações) seja encerrada antes de derrubar a sessão,
    // evitando vazamento entre usuários que façam login em sequência.
    try { await supabase.removeAllChannels(); } catch { /* noop */ }
    await supabase.auth.signOut();
  };

  const currentRoles = useMemo(() => simulatedRoles || roles, [simulatedRoles, roles]);
  const isAdmin = currentRoles.includes('admin');
  const isVoluntario = currentRoles.includes('voluntario');
  const canUpload = isAdmin || isVoluntario;
  const canViewMinors = isAdmin || isVoluntario;

  // Stable hasRole via ref — avoids invalidating memoized context value
  const currentRolesRef = useRef(currentRoles);
  useEffect(() => { currentRolesRef.current = currentRoles; }, [currentRoles]);
  const hasRole = useCallback((role: AppRole) => currentRolesRef.current.includes(role), []);

  const refreshProfile = useCallback(
    () => (userRef.current ? fetchProfile(userRef.current.id) : Promise.resolve()),
    [fetchProfile],
  );
  const refreshRoles = useCallback(
    () => (userRef.current ? fetchRoles(userRef.current.id) : Promise.resolve()),
    [fetchRoles],
  );

  const contextValue = useMemo<AuthContextType>(() => ({
    user, session, profile, roles: currentRoles, loading,
    mfaRequired, mfaVerified, setMfaVerified,
    signIn, signUp, signOut, hasRole,
    isAdmin, isVoluntario, canUpload, canViewMinors,
    refreshProfile,
    refreshRoles,
    simulateRoles: setSimulatedRoles,
    isSimulating: simulatedRoles !== null,
  }), [
    user, session, profile, currentRoles, loading,
    mfaRequired, mfaVerified,
    hasRole, isAdmin, isVoluntario, canUpload, canViewMinors,
    refreshProfile, refreshRoles, simulatedRoles,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
