const LOGIN_ATTEMPTS_KEY = 'login_attempts';
const LOCKOUT_KEY = 'login_lockout_until';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LoginAttempts {
  count: number;
  firstAttemptAt: number;
}

export const getLoginAttempts = (): LoginAttempts => {
  try {
    const stored = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!stored) return { count: 0, firstAttemptAt: Date.now() };
    return JSON.parse(stored);
  } catch {
    return { count: 0, firstAttemptAt: Date.now() };
  }
};

export const isLockedOut = (): { locked: boolean; remainingMs: number } => {
  const lockoutUntil = localStorage.getItem(LOCKOUT_KEY);
  if (!lockoutUntil) return { locked: false, remainingMs: 0 };
  const until = parseInt(lockoutUntil, 10);
  const remaining = until - Date.now();
  if (remaining <= 0) {
    localStorage.removeItem(LOCKOUT_KEY);
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    return { locked: false, remainingMs: 0 };
  }
  return { locked: true, remainingMs: remaining };
};

export const recordFailedAttempt = (): { locked: boolean; attemptsLeft: number } => {
  const attempts = getLoginAttempts();
  const newCount = attempts.count + 1;

  if (newCount >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_DURATION_MS));
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    return { locked: true, attemptsLeft: 0 };
  }

  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({
    count: newCount,
    firstAttemptAt: attempts.firstAttemptAt,
  }));

  return { locked: false, attemptsLeft: MAX_ATTEMPTS - newCount };
};

export const clearLoginAttempts = () => {
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
};

export const formatLockoutTime = (ms: number): string => {
  const minutes = Math.ceil(ms / 60000);
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
};
