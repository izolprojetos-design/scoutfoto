import { describe, it, expect } from 'vitest';
import { toTitleCase } from '@/lib/formatting';

describe('toTitleCase', () => {
  it('retorna string vazia para null/undefined/empty/whitespace', () => {
    expect(toTitleCase(null)).toBe('');
    expect(toTitleCase(undefined)).toBe('');
    expect(toTitleCase('')).toBe('');
    expect(toTitleCase('   ')).toBe('');
  });

  it('faz trim de espaços nas pontas', () => {
    expect(toTitleCase('  joão silva  ')).toBe('João Silva');
  });

  it('preserva acentos comuns do português', () => {
    expect(toTitleCase('joão')).toBe('João');
    expect(toTitleCase('CONCEIÇÃO')).toBe('Conceição');
    expect(toTitleCase('andré')).toBe('André');
    expect(toTitleCase('ÁGUAS CLARAS')).toBe('Águas Claras');
  });

  it('mantém palavras pequenas (de/da/do/das/dos/e) em minúsculas', () => {
    expect(toTitleCase('leandra magalhães dos santos')).toBe('Leandra Magalhães dos Santos');
    expect(toTitleCase('MARIA DA SILVA E SOUZA')).toBe('Maria da Silva e Souza');
    expect(toTitleCase('joão das neves')).toBe('João das Neves');
  });

  it('capitaliza palavra pequena quando é a primeira', () => {
    expect(toTitleCase('da silva')).toBe('Da Silva');
    expect(toTitleCase('e tal')).toBe('E Tal');
  });

  it('lida com sobrenomes compostos com hífen', () => {
    expect(toTitleCase('maria-josé pereira-lima')).toBe('Maria-José Pereira-Lima');
  });

  it('lida com apóstrofos (D’Ávila / D\'Ávila)', () => {
    expect(toTitleCase("d'ávila")).toBe("D'Ávila");
  });

  it('preserva acrônimos numéricos como 12/RR', () => {
    expect(toTitleCase('grupo escoteiro 12/rr')).toBe('Grupo Escoteiro 12/RR');
    expect(toTitleCase('12/rr')).toBe('12/RR');
  });

  it('formata local típico (rua/sede)', () => {
    expect(toTitleCase('SEDE DO GRUPO ESCOTEIRO')).toBe('Sede do Grupo Escoteiro');
    expect(toTitleCase('rua das flores, 123')).toBe('Rua das Flores, 123');
  });

  it('formata seção em title case', () => {
    expect(toTitleCase('TROPA ESCOTEIRA')).toBe('Tropa Escoteira');
    expect(toTitleCase('alcateia dos lobinhos')).toBe('Alcateia dos Lobinhos');
  });
});
