// Lista oficial de seções/cargos do grupo escoteiro

// Seções para voluntários
export const VOLUNTEER_SECTIONS = ['Dirigente', 'Escotista'] as const;
export type VolunteerSection = typeof VOLUNTEER_SECTIONS[number];

// Cargos individuais para voluntários (1ª e 2ª função)
export const VOLUNTEER_CARGOS = [
  'Assistente - Diretoria Administrativa',
  'Assistente - Diretoria Administrativa - Condecorações - Loja',
  'Assistente - Diretoria de Comunicação',
  'Assistente de Seção - Alcateia',
  'Assistente de Seção - Clã Pioneiro',
  'Assistente de Seção - Tropa Escoteira',
  'Assistente de Seção - Tropa Sênior',
  'Chefe de Seção - Alcateia',
  'Chefe de Seção - Tropa Escoteira',
  'Chefe de Seção - Tropa Sênior',
  'Comissão Fiscal - Suplente',
  'Comissão Fiscal - Titular',
  'Diretor - Gestão de adultos',
  'Diretor de Comunicação',
  'Diretor Financeiro',
  'Diretora - Relações Públicas',
  'Diretora Administrativa',
  'Diretora de Eventos',
  'Presidente'
] as const;

export type VolunteerCargo = typeof VOLUNTEER_CARGOS[number];

// Cargos específicos para Cargo 2 (conforme solicitado pelo usuário)
export const CARGO_2_OPTIONS = [
  'Assistente de Seção - Tropa Escoteira',
  'Assistente de Seção - Tropa Sênior',
  'Chefe de Seção - Clã Pioneiro'
] as const;

export type Cargo2Option = typeof CARGO_2_OPTIONS[number];

// Categorias de cargos para agrupamento na UI
export const VOLUNTEER_CARGO_CATEGORIES = {
  'Diretoria': VOLUNTEER_CARGOS.filter(c =>
    /^(Presidente|Diretor|Diretora|Assistente - Diretoria)/i.test(c)
  ),
  'Comissão Fiscal': VOLUNTEER_CARGOS.filter(c => c.startsWith('Comissão Fiscal')),
  'Chefes de Seção': VOLUNTEER_CARGOS.filter(c => c.startsWith('Chefe de Seção')),
  'Assistentes de Seção': VOLUNTEER_CARGOS.filter(c => c.startsWith('Assistente de Seção')),
} as const;

// Helper: parse section field for volunteers
// Format: "Seção::Cargo1 / Cargo2" or legacy "Cargo1 / Cargo2"
export function parseVolunteerSection(section: string | null): {
  secao: string;
  cargo1: string;
  cargo2: string;
} {
  if (!section) return { secao: '', cargo1: '', cargo2: '' };

  let secao = '';
  let cargoPart = section;

  if (section.includes('::')) {
    const [s, rest] = section.split('::', 2);
    secao = s.trim();
    cargoPart = rest.trim();
  }

  const parts = cargoPart.split(' / ').map(p => p.trim()).filter(Boolean);
  
  // Derive secao from cargo if not stored
  if (!secao && parts[0]) {
    secao = deriveSecaoFromCargo(parts[0]);
  }

  return {
    secao,
    cargo1: parts[0] || '',
    cargo2: parts[1] || '',
  };
}

// Helper: derive seção type from cargo name
export function deriveSecaoFromCargo(cargo: string): string {
  if (!cargo) return '';
  if (/chefe de se[çc][ãa]o|assistente de se[çc][ãa]o/i.test(cargo)) {
    return 'Escotista';
  }
  return 'Dirigente';
}

// Helper: build section field string for storage
export function buildVolunteerSection(secao: string, cargo1: string, cargo2: string): string {
  const cargos = [cargo1, cargo2].filter(Boolean).join(' / ');
  if (!secao && !cargos) return '';
  if (!cargos) return secao ? `${secao}::` : '';
  return `${secao}::${cargos}`;
}

// Legacy / Combined list for the SECTION_OPTIONS constant used in some components
export const SECTION_OPTIONS = [
  'Dirigente',
  'Escotista'
] as const;

export type SectionOption = typeof SECTION_OPTIONS[number];

