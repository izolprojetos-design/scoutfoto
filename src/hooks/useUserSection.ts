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
  const { profile, isAdmin, isVoluntario, hasRole } = useAuth();
  const isViewer = hasRole('viewer');
  const section = profile?.section || null;
  const sectionLabel = section ? SECTION_LABELS[section] || section : null;

  // Seções que não devem restringir a visualização de integrantes
  const globalSections = ['Dirigente', 'Escotista', 'Voluntário'];
  const isGlobalSection = section ? globalSections.includes(section) : false;

  return {
    section,
    sectionLabel,
    isAdmin,
    /** Non-admin users with a specific branch section set are restricted */
    isRestricted: !isAdmin && !isVoluntario && !isViewer && !!section && section !== '' && !isGlobalSection,
  };
};
