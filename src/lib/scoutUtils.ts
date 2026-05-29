import { differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths, startOfDay } from 'date-fns';

/** Parse a "YYYY-MM-DD" date string as local time (avoids UTC timezone shift). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

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
  { name: 'Voluntário', key: 'voluntario', icon: '🤝', minAge: 252, maxAge: 1200, color: 'purple' },
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
  
  // Se for maior que 21 anos (252 meses), é Voluntário/Adulto
  if (ageMonths >= 252) {
    return ADULT_CATEGORIES.find(b => b.key === 'voluntario') || null;
  }

  // Encontrar o ramo baseado na idade para jovens
  const ageBranch = SCOUT_BRANCHES.find(b => ageMonths >= b.minAge && ageMonths < b.maxAge);
  if (ageBranch) return ageBranch;

  return null;
}

export function getNextBranchChange(birthDate: Date): { branch: BranchInfo; date: Date; monthsLeft: number; daysLeft: number } | null {
  const ageMonths = calculateAgeInMonths(birthDate);
  
  // Se já for adulto (21+ anos), não há próximo ramo por idade
  if (ageMonths >= 252) {
    return null;
  }

  // Encontrar em qual ramo o jovem está agora
  const currentIdx = SCOUT_BRANCHES.findIndex(b => ageMonths >= b.minAge && ageMonths < b.maxAge);
  
  // Se ainda não atingiu a idade do primeiro ramo (Lobinho)
  if (ageMonths < SCOUT_BRANCHES[0].minAge) {
    const nextBranch = SCOUT_BRANCHES[0];
    const changeDate = startOfDay(addMonths(birthDate, nextBranch.minAge));
    const now = startOfDay(new Date());
    const monthsLeft = differenceInMonths(changeDate, now);
    const afterMonths = addMonths(now, monthsLeft);
    const daysLeft = differenceInDays(changeDate, afterMonths);
    return { branch: nextBranch, date: changeDate, monthsLeft: Math.max(0, monthsLeft), daysLeft };
  }

  // Se não foi encontrado em nenhum ramo mas tem < 252 meses, provavelmente está entre Pioneiro e Voluntário
  if (currentIdx === -1) {
    const lastScoutBranch = SCOUT_BRANCHES[SCOUT_BRANCHES.length - 1];
    if (ageMonths >= lastScoutBranch.maxAge) {
      const adultBranch = ADULT_CATEGORIES.find(b => b.key === 'voluntario');
      if (!adultBranch) return null;
      
      const changeDate = startOfDay(addMonths(birthDate, 252)); // 21 anos
      const now = startOfDay(new Date());
      const monthsLeft = differenceInMonths(changeDate, now);
      const afterMonths = addMonths(now, monthsLeft);
      const daysLeft = differenceInDays(changeDate, afterMonths);
      return { branch: adultBranch, date: changeDate, monthsLeft: Math.max(0, monthsLeft), daysLeft };
    }
    return null;
  }

  const currentBranch = SCOUT_BRANCHES[currentIdx];
  let nextBranch: BranchInfo | undefined = SCOUT_BRANCHES[currentIdx + 1];
  
  // Se estiver no último ramo de jovens (Pioneiro), o próximo é Voluntário
  if (!nextBranch) {
    nextBranch = ADULT_CATEGORIES.find(b => b.key === 'voluntario');
  }

  if (!nextBranch) return null;

  const changeDate = startOfDay(addMonths(birthDate, currentBranch.maxAge));
  const now = startOfDay(new Date());
  const monthsLeft = differenceInMonths(changeDate, now);
  const afterMonths = addMonths(now, monthsLeft);
  const daysLeft = differenceInDays(changeDate, afterMonths);

  return { branch: nextBranch, date: changeDate, monthsLeft: Math.max(0, monthsLeft), daysLeft };
}

export function formatAge(birthDate: Date): string {
  const now = new Date();
  const years = differenceInYears(now, birthDate);
  const afterYears = addYears(birthDate, years);
  const months = differenceInMonths(now, afterYears);
  const afterMonths = addMonths(afterYears, months);
  const days = differenceInDays(now, afterMonths);
  
  return `${years}a, ${months}m, ${days}d`;
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
