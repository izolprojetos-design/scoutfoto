import { useAuth } from '@/contexts/AuthContext';

const SECTION_LABELS: Record<string, string> = {
  Lobinho: '🐺 Lobinho',
  Escoteiro: '⚜️ Escoteiro',
  'Sênior': '🔴 Sênior',
  Pioneiro: '🟠 Pioneiro',
  'Voluntário': '🟣 Voluntário',
};

export const SECTION_OPTIONS = ['Lobinho', 'Escoteiro', 'Sênior', 'Pioneiro', 'Voluntário'] as const;
export type SectionName = typeof SECTION_OPTIONS[number];

export const useUserSection = () => {
  const { profile, isAdmin } = useAuth();
  const section = profile?.section || null;
  const sectionLabel = section ? SECTION_LABELS[section] || section : null;

  return {
    section,
    sectionLabel,
    isAdmin,
    /** Non-admin users with a section set are restricted */
    isRestricted: !isAdmin && !!section && section !== '',
  };
};
