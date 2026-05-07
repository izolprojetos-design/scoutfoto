const SMALL_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e',
  'di', 'du', 'la', 'le', 'van', 'von', 'der', 'del', 'y',
]);

/**
 * Converte uma string para Title Case com regras específicas para PT-BR:
 * - palavras pequenas (de, da, do, das, dos, e, etc.) ficam em minúsculas (exceto se forem a primeira)
 * - acrônimos com dígitos (ex.: "12/RR") são preservados em caixa alta após o "/"
 * - hífens e apóstrofos são tratados (ex.: "Maria-José", "D'Ávila")
 * - aceita null/undefined e faz trim para evitar quebras de layout
 */
export const toTitleCase = (s: string | null | undefined): string => {
  if (!s) return '';
  const trimmed = s.trim();
  if (!trimmed) return '';

  return trimmed
    .toLocaleLowerCase('pt-BR')
    .split(/(\s+|[\/·])/u)
    .map((token, idx, arr) => {
      if (/^\s+$/.test(token) || token === '/' || token === '·') return token;

      // Acrônimos com dígitos (ex.: "12/rr" → "12/RR")
      if (/\d/.test(token) && /^[\p{L}\d]+$/u.test(token)) {
        return token.toLocaleUpperCase('pt-BR');
      }

      return token
        .split('-')
        .map(part =>
          part
            .split("'")
            .map(sub => {
              if (!sub) return sub;
              const lower = sub.toLocaleLowerCase('pt-BR');
              const isFirstMeaningful =
                idx === 0 || arr.slice(0, idx).every(t => /^\s+$/.test(t));
              if (!isFirstMeaningful && SMALL_WORDS.has(lower)) return lower;
              return sub.charAt(0).toLocaleUpperCase('pt-BR') + sub.slice(1);
            })
            .join("'")
        )
        .join('-');
    })
    .join('');
};
