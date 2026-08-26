import { source } from './jsx-source';

describe('Sprint 7 type-safety contracts', () => {
  it('does not suppress Expo Router validation with as any', () => {
    for (const file of [
      'app/programs/index.tsx',
      'app/programs/create.tsx',
      'app/programs/detail.tsx',
      'app/(tabs)/index.tsx',
      'app/(tabs)/bio.tsx',
      'app/session/finish.tsx',
      'app/bio/evolution.tsx',
    ]) {
      expect(source(file)).not.toContain('as any');
    }
  });

  it('uses concrete types for audited event handlers and helper props', () => {
    expect(source('app/(tabs)/history.tsx')).not.toContain('(day: any)');
    expect(source('app/supplements/index.tsx')).not.toContain('(event: any');
    expect(source('components/PhotoComparison.tsx')).not.toContain('(event: any)');
    expect(source('src/i18n/index.tsx')).not.toContain('obj: any');
    expect(source('app/session/[routineId].tsx')).not.toContain('}: any)');
    expect(source('app/session/[routineId].tsx')).not.toContain('routineExs: any[]');
  });
});
