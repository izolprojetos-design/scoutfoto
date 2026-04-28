// Lightweight, dependency-free i18n for the chunk-reload recovery toasts.
// Detects the user's preferred language from <html lang>, localStorage, or
// navigator.language. Falls back to pt-BR (the app's primary language).

export type ReloadLocale = "pt-BR" | "en";

type ReloadMessages = {
  successTitle: string;
  successDescription: string;
  failureTitle: string;
  failureDescription: string;
  reloadAction: string;
};

const MESSAGES: Record<ReloadLocale, ReloadMessages> = {
  "pt-BR": {
    successTitle: "Página atualizada",
    successDescription: "Carregamos a versão mais recente do ScoutFoto.",
    failureTitle: "Não foi possível carregar parte do app",
    failureDescription:
      "Pode haver uma nova versão disponível. Recarregue para atualizar.",
    reloadAction: "Recarregar agora",
  },
  en: {
    successTitle: "Page updated",
    successDescription: "We loaded the latest version of ScoutFoto.",
    failureTitle: "Couldn't load part of the app",
    failureDescription:
      "A new version may be available. Reload to update.",
    reloadAction: "Reload now",
  },
};

const normalize = (lang: string | null | undefined): ReloadLocale => {
  if (!lang) return "pt-BR";
  const lower = lang.toLowerCase();
  if (lower.startsWith("pt")) return "pt-BR";
  if (lower.startsWith("en")) return "en";
  // Default app language
  return "pt-BR";
};

export const detectLocale = (): ReloadLocale => {
  try {
    // 1) Explicit override (matches whatever future i18n layer the app adopts)
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("scoutfoto_locale") ||
          localStorage.getItem("i18nextLng")
        : null;
    if (stored) return normalize(stored);

    // 2) <html lang="…"> set by the app
    const htmlLang =
      typeof document !== "undefined"
        ? document.documentElement.getAttribute("lang")
        : null;
    if (htmlLang) return normalize(htmlLang);

    // 3) Browser preference
    if (typeof navigator !== "undefined") {
      const nav = navigator.languages?.[0] || navigator.language;
      return normalize(nav);
    }
  } catch {
    // ignore — fall through to default
  }
  return "pt-BR";
};

export const getReloadMessages = (): ReloadMessages =>
  MESSAGES[detectLocale()];
