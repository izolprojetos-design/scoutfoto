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

      // Acrônimos com dígitos (ex.: "12/rr" → "12/RR"):
      // - token contendo dígitos
      // - token curto (<=3 letras) imediatamente após "/" precedido por token com dígito
      const hasDigit = /\d/.test(token);
      const prev = idx > 0 ? arr[idx - 1] : '';
      const prevPrev = idx > 1 ? arr[idx - 2] : '';
      const isAfterSlashAcronym =
        prev === '/' && /\d/.test(prevPrev) && token.length <= 3 && /^\p{L}+$/u.test(token);

      if (hasDigit || isAfterSlashAcronym) {
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

/**
 * Formata uma data no padrão pt-BR DD/MM/AAAA, independente do locale do ambiente.
 */
export const formatDatePtBR = (date: Date = new Date()): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

/**
 * Formata um horário no padrão pt-BR HH:mm (24h), independente do locale do ambiente.
 */
export const formatTimePtBR = (date: Date = new Date()): string => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Aplica máscara de celular brasileiro: (00) 00000-0000.
 * Aceita qualquer entrada (inclusive já mascarada) e preserva os dígitos existentes.
 */
export const formatPhoneBR = (value: string | null | undefined): string => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
