// Lista oficial de seções/cargos do grupo escoteiro
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
  'Comissão Fiscal - Suplente',
  'Comissão Fiscal - Titular',
  'Diretor - Gestão de Adultos / Chefe de Seção - Clã Pioneiro',
  'Diretor de Comunicação',
  'Diretor Financeiro / Assistente de Seção - Alcateia',
  'Diretora - Relações Públicas / Assistente de Seção - Tropa Escoteira',
  'Diretora Administrativa',
  'Diretora de Eventos',
  'Escotista',
  'Pais/Responsáveis',
  'Presidente / Assistente de Seção - Tropa Sênior',
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
