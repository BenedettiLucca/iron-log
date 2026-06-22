import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nProvider, useI18n, getNestedValue } from '@/src/i18n';
import { pt } from '@/src/i18n/translations/pt';
import { en } from '@/src/i18n/translations/en';
import { es } from '@/src/i18n/translations/es';
import { zh } from '@/src/i18n/translations/zh';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

describe('i18n', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNestedValue', () => {
    it('returns nested string value', () => {
      expect(getNestedValue(pt, 'common.save')).toBe(pt.common.save);
    });

    it('returns undefined for missing key', () => {
      expect(getNestedValue(pt, 'nonexistent')).toBeUndefined();
    });

    it('returns undefined for missing nested key', () => {
      expect(getNestedValue(pt, 'common.nonexistent')).toBeUndefined();
    });

    it('returns undefined for partially missing path', () => {
      expect(getNestedValue(pt, 'common.deep.missing')).toBeUndefined();
    });

    it('returns undefined for null object', () => {
      expect(getNestedValue(null, 'any.key')).toBeUndefined();
    });

    it('handles empty path', () => {
      expect(getNestedValue(pt, '')).toBeUndefined();
    });
  });

  describe('I18nProvider initialization', () => {
    it('defaults to Portuguese when no language is stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => expect(result.current.language).toBe('pt'));
    });

    it('loads stored language from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('en');

      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => expect(result.current.language).toBe('en'));
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@ironlog_language');
    });

    it('loads Spanish when stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('es');

      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => expect(result.current.language).toBe('es'));
    });

    it('loads Chinese when stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('zh');

      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => expect(result.current.language).toBe('zh'));
    });

    it('falls back to Portuguese for unsupported stored language', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('fr');

      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => expect(result.current.language).toBe('pt'));
    });

    it('uses initialLanguage prop when provided', () => {
      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <I18nProvider initialLanguage="en">{children}</I18nProvider>
      );

      const { result } = renderHook(() => useI18n(), { wrapper: customWrapper });

      expect(result.current.language).toBe('en');
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('setLanguage', () => {
    it('changes language and persists to AsyncStorage', async () => {
      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <I18nProvider initialLanguage="pt">{children}</I18nProvider>
      );

      const { result } = renderHook(() => useI18n(), { wrapper: customWrapper });

      expect(result.current.language).toBe('pt');

      await act(async () => {
        await result.current.setLanguage('en');
      });

      expect(result.current.language).toBe('en');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@ironlog_language', 'en');
    });

    it('can switch between all supported languages', async () => {
      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <I18nProvider initialLanguage="pt">{children}</I18nProvider>
      );

      const { result } = renderHook(() => useI18n(), { wrapper: customWrapper });

      for (const lang of ['en', 'es', 'zh', 'pt'] as const) {
        await act(async () => {
          await result.current.setLanguage(lang);
        });
        expect(result.current.language).toBe(lang);
        expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('@ironlog_language', lang);
      }
    });
  });

  describe('t() translations', () => {
    it('returns Portuguese translation by default', () => {
      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <I18nProvider initialLanguage="pt">{children}</I18nProvider>
      );

      const { result } = renderHook(() => useI18n(), { wrapper: customWrapper });

      expect(result.current.t('common.save')).toBe(pt.common.save);
      expect(result.current.t('home.title')).toBe(pt.home.title);
      expect(result.current.t('drawer.dashboard')).toBe(pt.drawer.dashboard);
    });

    it('returns English translations when language is en', () => {
      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <I18nProvider initialLanguage="en">{children}</I18nProvider>
      );

      const { result } = renderHook(() => useI18n(), { wrapper: customWrapper });

      expect(result.current.t('common.save')).toBe(en.common.save);
      expect(result.current.t('home.title')).toBe(en.home.title);
    });

    it('returns Spanish translations when language is es', () => {
      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <I18nProvider initialLanguage="es">{children}</I18nProvider>
      );

      const { result } = renderHook(() => useI18n(), { wrapper: customWrapper });

      expect(result.current.t('common.save')).toBe(es.common.save);
    });

    it('returns Chinese translations when language is zh', () => {
      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <I18nProvider initialLanguage="zh">{children}</I18nProvider>
      );

      const { result } = renderHook(() => useI18n(), { wrapper: customWrapper });

      expect(result.current.t('common.save')).toBe(zh.common.save);
    });
  });

  describe('t() fallback behavior', () => {
    it('falls back to key itself when translation is missing in all languages', () => {
      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <I18nProvider initialLanguage="pt">{children}</I18nProvider>
      );

      const { result } = renderHook(() => useI18n(), { wrapper: customWrapper });

      expect(result.current.t('totally.made.up.key')).toBe('totally.made.up.key');
    });

    it('returns nested value using dot notation', () => {
      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <I18nProvider initialLanguage="pt">{children}</I18nProvider>
      );

      const { result } = renderHook(() => useI18n(), { wrapper: customWrapper });

      expect(result.current.t('analytics.strengthScore')).toBe(pt.analytics.strengthScore);
      expect(result.current.t('bio.measurements')).toBe(pt.bio.measurements);
      expect(result.current.t('datePicker.title')).toBe(pt.datePicker.title);
      expect(result.current.t('photoComparison.title')).toBe(pt.photoComparison.title);
      expect(result.current.t('strengthCurve.title')).toBe(pt.strengthCurve.title);
      expect(result.current.t('summary.workoutReport')).toBe(pt.summary.workoutReport);
    });
  });

  describe('translation key parity', () => {
    function getAllKeys(obj: any, prefix = ''): string[] {
      const keys: string[] = [];
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          keys.push(...getAllKeys(obj[key], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys.sort();
    }

    const ptKeys = getAllKeys(pt);
    const enKeys = getAllKeys(en);
    const esKeys = getAllKeys(es);
    const zhKeys = getAllKeys(zh);

    it('Portuguese and English have the same keys', () => {
      expect(enKeys).toEqual(ptKeys);
    });

    it('Portuguese and Spanish have the same keys', () => {
      expect(esKeys).toEqual(ptKeys);
    });

    it('Portuguese and Chinese have the same keys', () => {
      expect(zhKeys).toEqual(ptKeys);
    });

    it('has no empty string translations in Portuguese', () => {
      for (const key of ptKeys) {
        const parts = key.split('.');
        let value: any = pt;
        for (const part of parts) value = value[part];
        expect(value).not.toBe('');
      }
    });

    it('has no empty string translations in English', () => {
      for (const key of enKeys) {
        const parts = key.split('.');
        let value: any = en;
        for (const part of parts) value = value[part];
        expect(value).not.toBe('');
      }
    });

    it('has no empty string translations in Spanish', () => {
      for (const key of esKeys) {
        const parts = key.split('.');
        let value: any = es;
        for (const part of parts) value = value[part];
        expect(value).not.toBe('');
      }
    });

    it('has no empty string translations in Chinese', () => {
      for (const key of zhKeys) {
        const parts = key.split('.');
        let value: any = zh;
        for (const part of parts) value = value[part];
        expect(value).not.toBe('');
      }
    });
  });
});
