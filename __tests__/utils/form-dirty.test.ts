import { isFormDirty } from '@/src/utils/form-dirty';

describe('isFormDirty', () => {
  it('keeps an untouched form clean', () => {
    expect(isFormDirty(['', '6', null], ['', '6', null])).toBe(false);
  });

  it('detects a changed scalar field', () => {
    expect(isFormDirty(['Treino A', '6'], ['', '6'])).toBe(true);
  });

  it('detects a changed serialized collection or date', () => {
    expect(isFormDirty(['[{"id":1}]', 1788134400000], ['[]', 1788048000000])).toBe(true);
  });

  it('treats different snapshot lengths as dirty', () => {
    expect(isFormDirty(['name'], ['name', 'description'])).toBe(true);
  });
});
