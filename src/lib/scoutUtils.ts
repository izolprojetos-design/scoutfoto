import { differenceInYears, differenceInMonths, addYears, addMonths } from 'date-fns';

export interface BranchInfo {
  name: string;
  key: string;
  icon: string;
  minAge: number; // in months
  maxAge: number; // in months
  color: string;
}

export const SCOUT_BRANCHES: BranchInfo[] = [
  { name: 'Lobinho', key: 'lobinho', icon: '🐺', minAge: 78, maxAge: 126, color: 'amber' },
  { name: 'Escoteiro', key: 'escoteiro', icon: '⚜️', minAge: 120, maxAge: 168, color: 'emerald' },
  { name: 'Sênior', key: 'senior', icon: '🏔️', minAge: 180, maxAge: 204, color: 'red' },
  { name: 'Pioneiro', key: 'pioneiro', icon: '🧭', minAge: 216, maxAge: 252, color: 'orange' },
  { name: 'Dirigente', key: 'dirigente', icon: '🤝', minAge: 252, maxAge: 300, color: 'purple' },
  { name: 'Chefes', key: 'chefes', icon: '🎖️', minAge: 252, maxAge: 1200, color: 'blue' },
];

export function calculateAge(birthDate: Date): { years: number; months: number } {
  const now = new Date();
  const years = differenceInYears(now, birthDate);
  const months = differenceInMonths(now, birthDate) % 12;
  return { years, months };
}

export function calculateAgeInMonths(birthDate: Date): number {
  return differenceInMonths(new Date(), birthDate);
}

export function getCurrentBranch(birthDate: Date): BranchInfo | null {
  const ageMonths = calculateAgeInMonths(birthDate);
  return SCOUT_BRANCHES.find(b => ageMonths >= b.minAge && ageMonths < b.maxAge) || null;
}

export function getNextBranchChange(birthDate: Date): { branch: BranchInfo; date: Date; monthsLeft: number } | null {
  const currentBranch = getCurrentBranch(birthDate);
  if (!currentBranch) return null;

  const idx = SCOUT_BRANCHES.indexOf(currentBranch);
  const nextBranch = SCOUT_BRANCHES[idx + 1];
  if (!nextBranch) return null;

  const changeDate = addMonths(birthDate, currentBranch.maxAge);
  const monthsLeft = differenceInMonths(changeDate, new Date());

  return { branch: nextBranch, date: changeDate, monthsLeft: Math.max(0, monthsLeft) };
}

export function formatAge(birthDate: Date): string {
  const { years, months } = calculateAge(birthDate);
  if (months === 0) return `${years} anos`;
  return `${years} anos e ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

export function formatMonthsLeft(months: number): string {
  if (months <= 0) return 'Já pode mudar!';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  if (m === 0) return `${y} ${y === 1 ? 'ano' : 'anos'}`;
  return `${y}a ${m}m`;
}
