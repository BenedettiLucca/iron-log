import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pt } from './translations/pt';
import { en } from './translations/en';
import { es } from './translations/es';
import { zh } from './translations/zh';

export type Language = 'pt' | 'en' | 'es' | 'zh';

export const LANGUAGE_LOCALES: Record<Language, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  zh: 'zh-CN',
};

export function getLocaleForLanguage(language: Language): string {
  return LANGUAGE_LOCALES[language] || 'pt-BR';
}

export type Translations = typeof pt;

const translations: Record<Language, Translations> = { pt, en, es, zh };

const LANGUAGE_KEY = '@ironlog_language';

export async function getStoredLanguage(): Promise<Language> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored && (stored === 'pt' || stored === 'en' || stored === 'es' || stored === 'zh')) {
      return stored as Language;
    }
  } catch {}
  return 'pt';
}

export function translate(key: string, vars?: Record<string, string | number>, lang: Language = 'pt'): string {
  let value = getNestedValue(translations[lang], key);
  if (value === undefined) {
    value = getNestedValue(translations.pt, key);
  }
  if (value === undefined) return key;

  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      value = value!.replaceAll(`{${k}}`, String(v));
    });
  }

  return value;
}

export async function getTranslation(key: string, vars?: Record<string, string | number>, lang?: Language): Promise<string> {
  const activeLang = lang ?? (await getStoredLanguage());
  return translate(key, vars, activeLang);
}

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'pt',
  setLanguage: async () => {},
  t: (key: string) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

export function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split('.');
  let value: unknown = obj;
  for (const key of keys) {
    if (typeof value !== 'object' || value === null || !(key in value)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === 'string' ? value : undefined;
}

export function I18nProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: Language }) {
  const [language, setLangState] = useState<Language>(initialLanguage ?? 'pt');
  const [ready, setReady] = useState(!!initialLanguage);

  useEffect(() => {
    if (initialLanguage) return;

    // Safety timeout: never block app load for more than 500ms
    const timeoutId = setTimeout(() => {
      setReady(true);
    }, 500);

    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((stored) => {
        clearTimeout(timeoutId);
        if (stored && ['pt', 'en', 'es', 'zh'].includes(stored)) {
          setLangState(stored as Language);
        }
        setReady(true);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setReady(true);
      });

    return () => clearTimeout(timeoutId);
  }, [initialLanguage]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLangState(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      return translate(key, vars, language);
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
