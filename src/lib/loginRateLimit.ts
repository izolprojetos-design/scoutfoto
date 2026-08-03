import { supabase } from '@/integrations/supabase/client';

const MAX_ATTEMPTS = 5;

export interface BlockStatus {
  locked: boolean;
  remainingMs: number;
  failedCount: number;
}

export const checkLoginBlock = async (email: string): Promise<BlockStatus> => {
  if (!email) return { locked: false, remainingMs: 0, failedCount: 0 };
  const { data, error } = await supabase.rpc('check_login_block', { p_email: email });
  if (error || !data || data.length === 0) {
    return { locked: false, remainingMs: 0, failedCount: 0 };
  }
  const row = data[0];
  return {
    locked: !!row.locked,
    remainingMs: (row.remaining_seconds || 0) * 1000,
    failedCount: row.failed_count || 0,
  };
};

export const recordFailedAttempt = async (
  email: string,
): Promise<{ locked: boolean; attemptsLeft: number; remainingMs: number }> => {
  const { data, error } = await supabase.rpc('record_login_failure', { p_email: email });
  if (error || !data || data.length === 0) {
    return { locked: false, attemptsLeft: MAX_ATTEMPTS, remainingMs: 0 };
  }
  const row = data[0];
  return {
    locked: !!row.locked,
    attemptsLeft: row.attempts_left ?? 0,
    remainingMs: (row.remaining_seconds || 0) * 1000,
  };
};

export const clearLoginAttempts = async (email: string) => {
  if (!email) return;
  await supabase.rpc('clear_login_attempts', { p_email: email });
};

export const formatLockoutTime = (ms: number): string => {
  const minutes = Math.ceil(ms / 60000);
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
};
