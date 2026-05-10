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

export function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value === undefined || value === null) return undefined;
    value = value[key];
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
      let value = getNestedValue(translations[language], key);
      if (value === undefined) {
        value = getNestedValue(translations.pt, key);
      }
      if (value === undefined) return key;
      
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          value = value!.replace(new RegExp(`{${k}}`, 'g'), String(v));
        });
      }
      
      return value;
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
