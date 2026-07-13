import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function collectUiFiles(): string[] {
  const files: string[] = [];
  const visit = (relativeDir: string) => {
    for (const entry of fs.readdirSync(path.join(projectRoot, relativeDir), { withFileTypes: true })) {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) visit(relativePath);
      else if (/\.(tsx|ts)$/.test(entry.name)) files.push(relativePath);
    }
  };
  ['app', 'components'].forEach(visit);
  return files;
}

describe('NativeWind utility contract', () => {
  it('does not ship undefined or web-only utilities in native UI source', () => {
    const forbidden = [
      { pattern: /\bfont-display\b/g, reason: 'undefined font family; Iron Log uses the system font' },
      { pattern: /\btext-3xs\b/g, reason: 'undefined size; text-2xs is the supported 10px floor' },
      { pattern: /\btransition-colors\b/g, reason: 'web transition utility has no native behavior' },
      { pattern: /\bselect-text\b/g, reason: 'web text-selection utility has no native behavior' },
    ];

    const violations = collectUiFiles().flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
      return forbidden.flatMap(({ pattern, reason }) => [...source.matchAll(pattern)].map((match) => {
        const line = source.slice(0, match.index).split('\n').length;
        return `${relativePath}:${line} ${match[0]} — ${reason}`;
      }));
    });

    expect(violations).toEqual([]);
  });

  it('keeps text-2xs explicitly defined as the minimum supported text size', () => {
    // Tailwind config is CommonJS; loading it verifies the runtime export used by NativeWind.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tailwindConfig = require('../../tailwind.config.js');
    expect(tailwindConfig.theme.extend.fontSize['2xs'][0]).toBe('10px');
  });
});
