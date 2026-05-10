import { describe, it, expect } from 'vitest';
import { formatDatePtBR, formatTimePtBR } from '@/lib/formatting';

describe('Formatação pt-BR para cabeçalho de exports (PDF/Excel/DOCX)', () => {
  const fixed = new Date(2026, 4, 9, 8, 7); // 09/05/2026 08:07

  it('formatDatePtBR retorna DD/MM/AAAA com zero à esquerda', () => {
    expect(formatDatePtBR(fixed)).toBe('09/05/2026');
  });

  it('formatTimePtBR retorna HH:mm em 24h com zero à esquerda', () => {
    expect(formatTimePtBR(fixed)).toBe('08:07');
  });

  it('aplica zero à esquerda em dias e meses < 10', () => {
    expect(formatDatePtBR(new Date(2026, 0, 1))).toBe('01/01/2026');
  });

  it('usa formato 24h (não AM/PM)', () => {
    const afternoon = new Date(2026, 4, 9, 23, 59);
    expect(formatTimePtBR(afternoon)).toBe('23:59');
    expect(formatTimePtBR(afternoon)).not.toMatch(/AM|PM/i);
  });

  it('saída sempre casa com regex DD/MM/AAAA e HH:mm', () => {
    expect(formatDatePtBR()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(formatTimePtBR()).toMatch(/^\d{2}:\d{2}$/);
  });
});
