import fs from 'node:fs';
import path from 'node:path';
import { en } from '../../src/i18n/translations/en';
import { es } from '../../src/i18n/translations/es';
import { pt } from '../../src/i18n/translations/pt';
import { zh } from '../../src/i18n/translations/zh';

const projectRoot = path.resolve(__dirname, '../..');

type FlatTranslations = Record<string, string>;

function flattenTranslations(value: unknown, prefix = ''): FlatTranslations {
  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<FlatTranslations>(
    (flat, [key, nestedValue]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof nestedValue === 'string') {
        flat[fullKey] = nestedValue;
      } else {
        Object.assign(flat, flattenTranslations(nestedValue, fullKey));
      }
      return flat;
    },
    {},
  );
}

function interpolationTokens(value: string): string[] {
  return [...value.matchAll(/\{+([A-Za-z][A-Za-z0-9]*)\}+/g)]
    .map((match) => match[1])
    .sort();
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

const locales = {
  pt: flattenTranslations(pt),
  en: flattenTranslations(en),
  es: flattenTranslations(es),
  zh: flattenTranslations(zh),
};

const runtimeSources = [
  ...sourceFiles(path.join(projectRoot, 'app')),
  ...sourceFiles(path.join(projectRoot, 'components')),
];

describe('Sprint 6 i18n and content-fit contracts', () => {
  it('ships Chinese copy instead of romanized pinyin or untranslated phrases', () => {
    const allowedLatinOnlyKeys = new Set(['home.title']);
    const latinPhraseWithoutHan = /[A-Za-z]{2,}(?:[\s/-]+[A-Za-z]{2,})+/;
    const hanCharacter = /[\u3400-\u9fff]/;

    const contaminated = Object.entries(locales.zh)
      .filter(([key, value]) => (
        !allowedLatinOnlyKeys.has(key)
        && latinPhraseWithoutHan.test(value)
        && !hanCharacter.test(value)
      ))
      .map(([key, value]) => `${key}: ${value}`);

    expect(contaminated).toEqual([]);
  });

  it('uses the Chinese duration label rather than the market mistranslation', () => {
    expect(zh.summary.duration).toBe('时长');
  });

  it('uses Spanish opening punctuation and corrected accented copy', () => {
    const punctuationViolations = Object.entries(locales.es)
      .filter(([, value]) => (
        (value.includes('?') && !value.includes('¿'))
        || (value.endsWith('!') && !value.includes('¡'))
      ))
      .map(([key, value]) => `${key}: ${value}`);

    expect(punctuationViolations).toEqual([]);
    expect(es.bioEvolution.movingAverage).toBe('Media móvil (7 días)');
    expect(es.bioEvolution.emptyAnalysis).toBe('Registra tus métricas para ver análisis y tendencias.');
    expect(es.bioEvolution.gainingWeight).toBe('Estás ganando peso consistentemente');
    expect(es.bioEvolution.losingWeight).toBe('Estás perdiendo peso consistentemente');
    expect(es.bioEvolution.weightChange).toBe('Variación de Peso');
    expect(es.bioEvolution.analysisTab).toBe('ANÁLISIS');
    expect(es.bioEvolution.tipText).toBe(
      'Para cambios de peso saludables, busca perder o ganar 0,5-1 kg por semana.',
    );
    expect(es.bioGoals.goalStatus).toContain('días restantes');
    expect(es.bioGoals.emptyDesc).toContain('métricas corporales');
    expect(es.finish.bodyWeight).toBe('Peso corporal (kg)');
    expect(es.services.invalidBackup).toBe('Archivo de backup inválido o vacío.');
    expect(es.services.sharingUnavailable).toBe('Compartir no está disponible en este dispositivo.');
  });

  it('does not ship the verified English contamination in Portuguese or Spanish', () => {
    expect(pt.analytics.strengthScore).toBe('Pontuação de Força');
    expect(pt.bioAnalytics.strengthScore).toBe('Pontuação de Força');
    expect(es.analytics.strengthScore).toBe('Puntuación de Fuerza');
    expect(es.bioAnalytics.strengthScore).toBe('Puntuación de Fuerza');
    expect(pt.exercise.reps).toBe('Repetições');
    expect(es.exercise.reps).toBe('Repeticiones');
    expect(es.finish.volume).toBe('Volumen (kg)');
    expect(es.finish.volumeKg).toBe('Volumen (kg)');
    expect(es.analytics.volume).toBe('Volumen');
    expect(pt.supplements.streak).toBe('Sequência');
  });

  it('keeps interpolation variables identical in every locale', () => {
    for (const key of Object.keys(locales.pt)) {
      const expectedTokens = interpolationTokens(locales.pt[key]);
      expect({ key, tokens: interpolationTokens(locales.en[key]) }).toEqual({ key, tokens: expectedTokens });
      expect({ key, tokens: interpolationTokens(locales.es[key]) }).toEqual({ key, tokens: expectedTokens });
      expect({ key, tokens: interpolationTokens(locales.zh[key]) }).toEqual({ key, tokens: expectedTokens });
    }
  });

  it('does not hide guaranteed translation keys behind hardcoded UI fallbacks', () => {
    const violations = runtimeSources.flatMap((absolutePath) => {
      const relativePath = path.relative(projectRoot, absolutePath);
      return fs.readFileSync(absolutePath, 'utf8')
        .split('\n')
        .flatMap((line, index) => (
          /\bt\([^\n;]+\)\s*\|\|\s*['"`]/.test(line)
            ? [`${relativePath}:${index + 1} ${line.trim()}`]
            : []
        ));
    });

    expect(violations).toEqual([]);
  });

  it('does not ship the verified hardcoded Portuguese UI copy', () => {
    const forbiddenLiterals = ['title="Usar"', 'Análise por Exercício'];
    const violations = runtimeSources.flatMap((absolutePath) => {
      const source = fs.readFileSync(absolutePath, 'utf8');
      return forbiddenLiterals
        .filter((literal) => source.includes(literal))
        .map((literal) => `${path.relative(projectRoot, absolutePath)}: ${literal}`);
    });

    expect(violations).toEqual([]);
  });
});
