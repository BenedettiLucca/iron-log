import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pt } from './translations/pt';
import { en } from './translations/en';
import { es } from './translations/es';
import { zh } from './translations/zh';

export type Language = 'pt' | 'en' | 'es' | 'zh';

export type Translations = typeof pt;

const translations: Record<Language, Translations> = { pt, en, es, zh };

const LANGUAGE_KEY = '@ironlog_language';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'pt',
  setLanguage: async () => {},
  t: (key: string) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value === undefined || value === null) return undefined;
    value = value[key];
  }
  return typeof value === 'string' ? value : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<Language>('pt');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
      if (stored && ['pt', 'en', 'es', 'zh'].includes(stored)) {
        setLangState(stored as Language);
      }
      setReady(true);
    });
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLangState(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const value = getNestedValue(translations[language], key);
      if (value !== undefined) return value;
      // Fallback to PT
      const fallback = getNestedValue(translations.pt, key);
      return fallback ?? key;
    },
    [language]
  );

  if (!ready) return null;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}
