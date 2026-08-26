import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(__dirname, '../..');

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function jsxElements(relativePath: string, tagName: string): ts.JsxOpeningLikeElement[] {
  const contents = source(relativePath);
  const ast = ts.createSourceFile(relativePath, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches: ts.JsxOpeningLikeElement[] = [];

  function visit(node: ts.Node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && node.tagName.getText(ast) === tagName
    ) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return matches;
}

function propNames(element: ts.JsxOpeningLikeElement): string[] {
  return element.attributes.properties
    .filter(ts.isJsxAttribute)
    .map((attribute) => attribute.name.getText());
}

function hasA11yHiding(props: string[]): boolean {
  return props.includes('accessible') || props.includes('importantForAccessibility');
}

describe('Sprint 6 tabs & goals accessibility contracts', () => {
  it('hides all decorative home tab SVGs from screen readers', () => {
    const file = 'app/(tabs)/index.tsx';
    const svgs = jsxElements(file, 'Svg');
    const unhidden = svgs.filter((el) => !hasA11yHiding(propNames(el)));
    expect({ file, unhidden: unhidden.map((el) => el.getText()) }).toEqual({ file, unhidden: [] });
  });

  it('hides decorative routines tab play SVG from screen readers', () => {
    const file = 'app/(tabs)/routines.tsx';
    const svgs = jsxElements(file, 'Svg');
    const unhidden = svgs.filter((el) => !hasA11yHiding(propNames(el)));
    expect({ file, unhidden: unhidden.map((el) => el.getText()) }).toEqual({ file, unhidden: [] });
  });

  it('hides decorative tab emojis from screen readers', () => {
    const bioSource = source('app/(tabs)/bio.tsx');
    const bioLines = bioSource.split('\n');
    for (const keyword of ['{item.icon}', '📷']) {
      const lineIdx = bioLines.findIndex((l) => l.includes(keyword));
      expect(lineIdx).toBeGreaterThanOrEqual(0);
      const nearby = bioLines.slice(lineIdx, lineIdx + 2).join('\n');
      expect(nearby).toMatch(/accessible=\{false\}|importantForAccessibility/);
    }

    const historySource = source('app/(tabs)/history.tsx');
    const historyLines = historySource.split('\n');
    const errorLine = historyLines.findIndex((l) => l.includes('⚠️'));
    expect(errorLine).toBeGreaterThanOrEqual(0);
    expect(historyLines[errorLine]).toMatch(/accessible=\{false\}|importantForAccessibility/);

    const goalsSource = source('app/bio/goals.tsx');
    const goalsLines = goalsSource.split('\n');
    const goalEmojiLine = goalsLines.findIndex((l) => l.includes('🎯'));
    expect(goalEmojiLine).toBeGreaterThanOrEqual(0);
    expect(goalsLines[goalEmojiLine]).toMatch(/accessible=\{false\}|importantForAccessibility/);
  });

  it('provides concise accessibilityLabel for home program stats summary', () => {
    const contents = source('app/(tabs)/index.tsx');
    const statsIdx = contents.indexOf('border-t border-b border-border/60');
    expect(statsIdx).toBeGreaterThanOrEqual(0);
    const section = contents.slice(statsIdx, statsIdx + 800);
    expect(section).toMatch(/accessibilityLabel/);
    expect(section).toMatch(/programs\.dashboard\.volume/);
  });

  it('uses list/listitem roles for home key lifts collection', () => {
    const contents = source('app/(tabs)/index.tsx');
    expect(contents).toContain('role="list"');
    expect(contents).toContain('role="listitem"');
  });

  it('provides concise accessibilityLabel for last-session pressable Card', () => {
    const contents = source('app/(tabs)/index.tsx');
    const lastSessionIdx = contents.indexOf('lastSession ?');
    expect(lastSessionIdx).toBeGreaterThanOrEqual(0);
    const section = contents.slice(lastSessionIdx, lastSessionIdx + 600);
    expect(section).toMatch(/accessibilityLabel/);
  });
});
