import {
  DEFAULT_FOLDER_NAME,
  getFolderChipNames,
  normalizeFolderName,
  validateFolderName,
} from '@/src/utils/folders';

describe('folder helpers', () => {
  it('normalizes names without changing their content', () => {
    expect(normalizeFolderName('  Push  ')).toBe('Push');
  });

  it('hides Geral when it is the only persisted folder', () => {
    expect(getFolderChipNames([DEFAULT_FOLDER_NAME])).toEqual(['Todos']);
  });

  it('keeps persisted empty and assigned folders in chip order', () => {
    expect(getFolderChipNames(['Geral', 'Push', 'Leg'])).toEqual([
      'Todos',
      'Geral',
      'Push',
      'Leg',
    ]);
  });

  it('deduplicates blank and repeated folder names', () => {
    expect(getFolderChipNames(['', 'Push', 'Push', '  '])).toEqual(['Todos', 'Push']);
  });

  it('deduplicates folder names case-insensitively and canonicalizes Geral', () => {
    expect(getFolderChipNames(['geral', 'Push', 'push'])).toEqual(['Todos', 'Geral', 'Push']);
  });

  it('validates required and maximum folder names', () => {
    expect(validateFolderName('   ')).toBe('empty');
    expect(validateFolderName('a'.repeat(51))).toBe('tooLong');
    expect(validateFolderName('Push')).toBeNull();
  });
});
