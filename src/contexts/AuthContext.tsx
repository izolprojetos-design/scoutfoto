import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { logAudit } from '@/lib/auditLog';
import { checkAndRegisterDevice } from '@/lib/deviceDetection';

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

  // Inactivity timeout: 30 minutes
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 min
    const WARNING_BEFORE = 5 * 60 * 1000; // 5 min antes
    const THROTTLE_MS = 2000; // throttle events to avoid excessive resets
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
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
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
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      // Log successful login
      try {
        await logAudit(data.user.id, 'login' as any, undefined, { email });
      } catch {}
    }
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin,
      },
    });
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
    <AuthContext.Provider value={{ user, session, profile, roles, loading, signIn, signUp, signOut, hasRole, isAdmin, isChefe, isDirigente, canUpload, canViewMinors }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
