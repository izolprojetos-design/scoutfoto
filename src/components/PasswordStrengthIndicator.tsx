import { validatePassword, strengthLabel, strengthColor } from '@/lib/passwordValidation';
import { Check, X } from 'lucide-react';

interface Props {
  password: string;
}

const PasswordStrengthIndicator = ({ password }: Props) => {
  if (!password) return null;

  const { errors, strength, isValid } = validatePassword(password);

  const rules = [
    { label: 'Mínimo de 8 caracteres', ok: password.length >= 8 },
    { label: 'Letra maiúscula', ok: /[A-Z]/.test(password) },
    { label: 'Letra minúscula', ok: /[a-z]/.test(password) },
    { label: 'Número', ok: /[0-9]/.test(password) },
    { label: 'Símbolo (!@#$%...)', ok: /[^A-Za-z0-9]/.test(password) },
  ];

  const barWidth = strength === 'weak' ? '25%' : strength === 'fair' ? '50%' : strength === 'good' ? '75%' : '100%';

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${strengthColor[strength]}`}
            style={{ width: barWidth }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {strengthLabel[strength]}
        </span>
      </div>
      <ul className="space-y-0.5">
        {rules.map((rule, i) => (
          <li key={i} className="flex items-center gap-1.5 text-xs">
            {rule.ok ? (
              <Check className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className={rule.ok ? 'text-muted-foreground' : 'text-foreground'}>
              {rule.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrengthIndicator;
