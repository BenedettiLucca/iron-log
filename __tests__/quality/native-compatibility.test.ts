import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');
const sourceRoots = ['app', 'components', 'hooks', 'services', 'src'];

function collectSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(projectRoot, relativeDir);

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(relativePath);
    return /\.(ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
}

const sourceFiles = sourceRoots.flatMap(collectSourceFiles);

describe('React Native compatibility guards', () => {
  it('uses react-native-svg components instead of lowercase SVG host elements', () => {
    const invalidElements = /<(line|polyline|polygon|path|circle|ellipse|rect|g)\b/g;
    const violations = sourceFiles.flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
      return [...source.matchAll(invalidElements)].map(
        (match) => `${relativePath}:${source.slice(0, match.index).split('\n').length} <${match[1]}>`
      );
    });

    expect(violations).toEqual([]);
  });

  it('does not load expo-notifications at module initialization time', () => {
    const staticRuntimeImport = /^import\s+(?!type\b).*?from\s+['"]expo-notifications['"];?$/gm;
    const violations = sourceFiles.flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
      return [...source.matchAll(staticRuntimeImport)].map(
        (match) => `${relativePath}:${source.slice(0, match.index).split('\n').length}`
      );
    });

    expect(violations).toEqual([]);
  });

  it('does not wrap the root layout when Sentry may be uninitialized', () => {
    const rootLayout = fs.readFileSync(path.join(projectRoot, 'app/_layout.tsx'), 'utf8');

    expect(rootLayout).not.toContain('export default Sentry.wrap(Layout)');
  });
});
