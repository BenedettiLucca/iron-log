import fs from 'fs';
import path from 'path';

describe('dependency runtime compatibility', () => {
  it('keeps minimatch 3 compatible with the overridden brace-expansion API', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const minimatch = require('minimatch') as (value: string, pattern: string) => boolean;

    expect(minimatch('a.ts', '*.{js,ts}')).toBe(true);
  });

  it('pins brace-expansion overrides to patched releases', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    ) as {
      overrides: Record<string, { 'brace-expansion': string }>;
    };

    expect(packageJson.overrides).toMatchObject({
      'minimatch@3.1.5': { 'brace-expansion': '1.1.18' },
      'minimatch@9.0.9': { 'brace-expansion': '2.1.4' },
      'minimatch@10.2.5': { 'brace-expansion': '5.0.9' },
    });
  });
});