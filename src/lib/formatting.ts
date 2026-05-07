const SMALL_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e',
  'di', 'du', 'la', 'le', 'van', 'von', 'der', 'del', 'y',
]);

export const toTitleCase = (s: string) => {
  if (!s) return '';
  return s
    .toLocaleLowerCase('pt-BR')
    .split(/(\s+|[\/·])/u)
    .map((token, idx, arr) => {
      if (/^\s+$/.test(token) || token === '/' || token === '·') return token;
      return token
        .split('-')
        .map(part =>
          part
            .split("'")
            .map(sub => {
              if (!sub) return sub;
              const lower = sub.toLocaleLowerCase('pt-BR');
              const isFirstMeaningful = idx === 0 || arr.slice(0, idx).every(t => /^\s+$/.test(t));
              if (!isFirstMeaningful && SMALL_WORDS.has(lower)) return lower;
              return sub.charAt(0).toLocaleUpperCase('pt-BR') + sub.slice(1);
            })
            .join("'")
        )
        .join('-');
    })
    .join('');
};
