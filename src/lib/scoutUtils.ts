import { differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths } from 'date-fns';

export interface BranchInfo {
  name: string;
  key: string;
  icon: string;
  minAge: number; // in months
  maxAge: number; // in months
  color: string;
}

// Ramos escoteiros (classificação automática por idade)
export const SCOUT_BRANCHES: BranchInfo[] = [
  { name: 'Lobinho', key: 'lobinho', icon: '🐺', minAge: 78, maxAge: 132, color: 'amber' },
  { name: 'Escoteiro', key: 'escoteiro', icon: '⚜️', minAge: 132, maxAge: 180, color: 'emerald' },
  { name: 'Sênior', key: 'senior', icon: '🏔️', minAge: 180, maxAge: 216, color: 'red' },
  { name: 'Pioneiro', key: 'pioneiro', icon: '🧭', minAge: 216, maxAge: 252, color: 'orange' },
];

// Categorias de adultos (atribuição somente manual)
export const ADULT_CATEGORIES: BranchInfo[] = [
  { name: 'Dirigente', key: 'dirigente', icon: '🤝', minAge: 252, maxAge: 480, color: 'purple' },
  { name: 'Chefes', key: 'chefes', icon: '🎖️', minAge: 480, maxAge: 1200, color: 'blue' },
];

// Todas as categorias combinadas (para filtros, UI, etc.)
export const ALL_CATEGORIES: BranchInfo[] = [...SCOUT_BRANCHES, ...ADULT_CATEGORIES];

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

export function getNextBranchChange(birthDate: Date): { branch: BranchInfo; date: Date; monthsLeft: number; daysLeft: number } | null {
  const currentBranch = getCurrentBranch(birthDate);
  if (!currentBranch) return null;

  const idx = SCOUT_BRANCHES.indexOf(currentBranch);
  const nextBranch = SCOUT_BRANCHES[idx + 1];
  if (!nextBranch) return null;

  const changeDate = addMonths(birthDate, currentBranch.maxAge);
  const now = new Date();
  const monthsLeft = differenceInMonths(changeDate, now);
  const afterMonths = addMonths(now, monthsLeft);
  const daysLeft = Math.max(0, Math.floor((changeDate.getTime() - afterMonths.getTime()) / (1000 * 60 * 60 * 24)));

  return { branch: nextBranch, date: changeDate, monthsLeft: Math.max(0, monthsLeft), daysLeft };
}

export function formatAge(birthDate: Date): string {
  const now = new Date();
  const years = differenceInYears(now, birthDate);
  const afterYears = addYears(birthDate, years);
  const months = differenceInMonths(now, afterYears);
  const afterMonths = addMonths(afterYears, months);
  const days = differenceInDays(now, afterMonths);
  
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} a`);
  if (months > 0) parts.push(`${months} m`);
  if (days > 0) parts.push(`${days} d`);
  return parts.join(', ') || '0 d';
}

export function formatTimeLeft(months: number, days: number = 0): string {
  if (months <= 0 && days <= 0) return 'Já pode mudar!';
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? 'ano' : 'anos'}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? 'mês' : 'meses'}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);
  return parts.join(', ');
}
