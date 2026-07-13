import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');
const unsupportedColorOpacity = /\b(?:bg|border|text|fill|stroke|divide|outline|ring(?:-offset)?|shadow|accent|caret|decoration|placeholder|from|via|to)-[A-Za-z][\w-]*\/(?:3|8)\b/g;

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
      { pattern: /\btext-\[10px\]/g, reason: 'use the configured text-2xs role for the 10px floor' },
      { pattern: unsupportedColorOpacity, reason: 'opacity modifier is absent from the configured Tailwind scale' },
      { pattern: /\b(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]+)?\b/g, reason: 'use an Iron Log semantic color role instead of the default Tailwind palette' },
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

  it('covers every Tailwind color namespace without matching layout fractions', () => {
    const fixture = 'bg-primary/3 shadow-primary/3 ring-primary/8 ring-offset-primary/3 divide-primary/8 decoration-primary/3 from-primary/8 via-primary/3 to-primary/8';
    expect([...fixture.matchAll(unsupportedColorOpacity)].map((match) => match[0])).toEqual(fixture.split(' '));
    expect([...('w-1/3 basis-1/3 text-2xl/8').matchAll(unsupportedColorOpacity)]).toEqual([]);
  });

  it('keeps text-2xs explicitly defined as the minimum supported text size', () => {
    // Tailwind config is CommonJS; loading it verifies the runtime export used by NativeWind.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tailwindConfig = require('../../tailwind.config.js');
    expect(tailwindConfig.theme.extend.fontSize['2xs'][0]).toBe('10px');
  });
});
