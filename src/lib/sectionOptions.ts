// Lista oficial de seções/cargos do grupo escoteiro

// Seções para voluntários
export const VOLUNTEER_SECTIONS = ['Dirigente', 'Escotista'] as const;
export type VolunteerSection = typeof VOLUNTEER_SECTIONS[number];

// Cargos individuais para voluntários (1ª e 2ª função)
export const VOLUNTEER_CARGOS = [
  // Diretoria
  'Presidente',
  'Diretora Administrativa',
  'Diretor de Comunicação',
  'Diretor Financeiro',
  'Diretora de Eventos',
  'Diretora - Relações Públicas',
  'Diretor - Gestão de Adultos',
  'Assistente - Diretoria Administrativa',
  'Assistente - Diretoria de Comunicação',
  'Assistente - Diretoria Financeira - Loja',
  // Comissão Fiscal
  'Comissão Fiscal - Titular',
  'Comissão Fiscal - Suplente',
  // Chefes de Seção
  'Chefe de Seção - Alcateia',
  'Chefe de Seção - Tropa Escoteira',
  'Chefe de Seção - Tropa Sênior',
  'Chefe de Seção - Clã Pioneiro',
  // Assistentes de Seção
  'Assistente de Seção - Alcateia',
  'Assistente de Seção - Tropa Escoteira',
  'Assistente de Seção - Tropa Sênior',
  'Assistente de Seção - Clã Pioneiro',
  // Outros
  'Pais/Responsáveis',
] as const;

export type VolunteerCargo = typeof VOLUNTEER_CARGOS[number];

// Categorias de cargos para agrupamento na UI
export const VOLUNTEER_CARGO_CATEGORIES = {
  'Diretoria': VOLUNTEER_CARGOS.filter(c =>
    /^(Presidente|Diretor|Diretora|Assistente - Diretoria)/i.test(c)
  ),
  'Comissão Fiscal': VOLUNTEER_CARGOS.filter(c => c.startsWith('Comissão Fiscal')),
  'Chefes de Seção': VOLUNTEER_CARGOS.filter(c => c.startsWith('Chefe de Seção')),
  'Assistentes de Seção': VOLUNTEER_CARGOS.filter(c => c.startsWith('Assistente de Seção')),
  'Outros': VOLUNTEER_CARGOS.filter(c => c === 'Escotista' || c === 'Pais/Responsáveis'),
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
  if (/chefe de se[çc][ãa]o|assistente de se[çc][ãa]o|^escotista$/i.test(cargo)) {
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

// Legacy: kept for backward compatibility in other parts of the app
export const SECTION_OPTIONS = [
  'Assistente - Diretoria Administrativa',
  'Assistente - Diretoria de Comunicação',
  'Assistente - Diretoria Financeira - Loja',
  'Assistente de Seção - Alcateia',
  'Assistente de Seção - Clã Pioneiro',
  'Assistente de Seção - Tropa Escoteira',
  'Assistente de Seção - Tropa Sênior',
  'Chefe de Seção - Alcateia',
  'Chefe de Seção - Tropa Escoteira',
  'Chefe de Seção - Tropa Sênior',
  'Chefe de Seção - Clã Pioneiro',
  'Comissão Fiscal - Suplente',
  'Comissão Fiscal - Titular',
  'Diretor - Gestão de Adultos',
  'Diretor de Comunicação',
  'Diretor Financeiro',
  'Diretora - Relações Públicas',
  'Diretora Administrativa',
  'Diretora de Eventos',
  'Escotista',
  'Pais/Responsáveis',
  'Presidente',
] as const;

export type SectionOption = typeof SECTION_OPTIONS[number];

// Categorias para agrupamento na UI
export const SECTION_CATEGORIES = {
  'Diretoria': SECTION_OPTIONS.filter(s => 
    s.startsWith('Diretor') || s.startsWith('Diretora') || s.startsWith('Presidente') || s.startsWith('Assistente - Diretoria')
  ),
  'Alcateia (Lobinhos)': SECTION_OPTIONS.filter(s => s.includes('Alcateia')),
  'Tropa Escoteira': SECTION_OPTIONS.filter(s => s.includes('Tropa Escoteira')),
  'Tropa Sênior': SECTION_OPTIONS.filter(s => s.includes('Tropa Sênior')),
  'Clã Pioneiro': SECTION_OPTIONS.filter(s => s.includes('Clã Pioneiro')),
  'Comissão Fiscal': SECTION_OPTIONS.filter(s => s.includes('Comissão Fiscal')),
  'Outros': SECTION_OPTIONS.filter(s => s === 'Escotista' || s === 'Pais/Responsáveis'),
} as const;
