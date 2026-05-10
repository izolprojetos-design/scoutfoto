import { describe, it, expect } from 'vitest';
import { formatDatePtBR, formatTimePtBR } from '@/lib/formatting';

/**
 * Garante que os cabeçalhos dos exports Excel e DOCX usem sempre
 * o padrão pt-BR (DD/MM/AAAA e HH:mm), independentemente do ambiente.
 *
 * Reproduz exatamente as strings construídas em src/pages/Scouts.tsx
 * para os exports Excel (aoa_to_sheet) e DOCX (TextRun).
 */
describe('Cabeçalho pt-BR nos exports Excel e DOCX', () => {
  const fixed = new Date(2026, 4, 9, 8, 7); // 09/05/2026 08:07
  const dateRegex = /^Exportado em: \d{2}\/\d{2}\/\d{4}$/;
  const timeRegex = /^Horário: \d{2}:\d{2}( • Total: \d+)?$/;

  describe('Excel (aoa_to_sheet headerRows)', () => {
    const buildExcelHeader = (now: Date) => {
      const dateStr = formatDatePtBR(now);
      const timeStr = formatTimePtBR(now);
      return [
        ['12º Grupo Escoteiro Monte Caburai-12º GEMC'],
        [`Exportado em: ${dateStr}`],
        [`Horário: ${timeStr}`],
        [],
      ];
    };

    it('produz linhas com data DD/MM/AAAA e horário HH:mm para data fixa', () => {
      const rows = buildExcelHeader(fixed);
      expect(rows[1][0]).toBe('Exportado em: 09/05/2026');
      expect(rows[2][0]).toBe('Horário: 08:07');
    });

    it('mantém o padrão regex em qualquer data atual (independente do ambiente)', () => {
      const rows = buildExcelHeader(new Date());
      expect(rows[1][0]).toMatch(dateRegex);
      expect(rows[2][0]).toMatch(timeRegex);
    });

    it('preserva linha vazia separadora antes dos dados', () => {
      const rows = buildExcelHeader(fixed);
      expect(rows[3]).toEqual([]);
    });
  });

  describe('DOCX (TextRun text)', () => {
    const buildDocxHeader = (total: number) => ({
      title: '12º Grupo Escoteiro Monte Caburai-12º GEMC',
      exportedAt: `Exportado em: ${formatDatePtBR()}`,
      timeAndTotal: `Horário: ${formatTimePtBR()} • Total: ${total}`,
    });

    it('usa formatos pt-BR no "Exportado em" e "Horário"', () => {
      const header = buildDocxHeader(42);
      expect(header.exportedAt).toMatch(dateRegex);
      expect(header.timeAndTotal).toMatch(timeRegex);
    });

    it('inclui total ao lado do horário', () => {
      const header = buildDocxHeader(7);
      expect(header.timeAndTotal).toContain('• Total: 7');
    });

    it('horário nunca usa AM/PM (sempre 24h)', () => {
      const header = buildDocxHeader(1);
      expect(header.timeAndTotal).not.toMatch(/AM|PM/i);
    });
  });
});
