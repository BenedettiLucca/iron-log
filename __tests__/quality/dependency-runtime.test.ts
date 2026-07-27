describe('dependency runtime compatibility', () => {
  it('keeps minimatch 3 compatible with the overridden brace-expansion API', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const minimatch = require('minimatch') as (value: string, pattern: string) => boolean;

    expect(minimatch('a.ts', '*.{js,ts}')).toBe(true);
  });
});