import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { en, type TranslationKeys } from "./en";
import { zh } from "./zh";
import { es } from "./es";

export type Language = "en" | "zh" | "es";

export const LANGUAGES: { id: Language; label: string; nativeLabel: string }[] = [
  { id: "en", label: "English", nativeLabel: "English" },
  { id: "zh", label: "Chinese", nativeLabel: "\u4E2D\u6587" },
  { id: "es", label: "Spanish", nativeLabel: "Espa\u00F1ol" },
];

const translations: Record<Language, TranslationKeys> = { en, zh, es };

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const I18nContext = createContext<I18nContextType>({
  language: "en",
  setLanguage: () => {},
  t: en,
});

const STORAGE_KEY = "nextape-language";

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === "en" || stored === "zh" || stored === "es")) {
      return stored as Language;
    }
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith("zh")) return "zh";
    if (browserLang.startsWith("es")) return "es";
  } catch {}
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = translations[language];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

export type { TranslationKeys };
