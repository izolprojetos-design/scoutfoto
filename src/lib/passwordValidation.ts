export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

const COMMON_PASSWORDS = new Set([
  'password', '12345678', '123456789', '1234567890', 'qwerty123',
  'abc12345', 'password1', 'iloveyou', 'sunshine1', 'princess1',
  'football1', 'charlie1', 'shadow12', 'master12', 'dragon12',
  'monkey12', 'letmein1', 'mustang1', 'access14', 'michael1',
  'escoteiro', 'sempreal', 'lobinho1', 'seniores',
]);

export const validatePassword = (password: string): PasswordValidation => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Mínimo de 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Pelo menos uma letra maiúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Pelo menos uma letra minúscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Pelo menos um número');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Pelo menos um símbolo (!@#$%...)');
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Senha muito comum, escolha outra');
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  let strength: PasswordValidation['strength'] = 'weak';
  if (score >= 5) strength = 'strong';
  else if (score >= 4) strength = 'good';
  else if (score >= 3) strength = 'fair';

  return { isValid: errors.length === 0, errors, strength };
};

export const strengthLabel: Record<PasswordValidation['strength'], string> = {
  weak: 'Fraca',
  fair: 'Razoável',
  good: 'Boa',
  strong: 'Forte',
};

export const strengthColor: Record<PasswordValidation['strength'], string> = {
  weak: 'bg-destructive',
  fair: 'bg-orange-500',
  good: 'bg-yellow-500',
  strong: 'bg-green-500',
};
