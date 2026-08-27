import { jsxElements, source } from './jsx-source';
import ts from 'typescript';

describe('Sprint 11 Routines Tab Strip quality contract', () => {
  const file = 'app/(tabs)/routines.tsx';

  it('uses contentContainerStyle or contentContainerClassName on top horizontal ScrollView for RN flex gap application', () => {
    const scrollViews = jsxElements(file, 'ScrollView');
    expect(scrollViews.length).toBeGreaterThan(0);

    const topScrollView = scrollViews[0];
    const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const text = topScrollView.getText(ast);

    // React Native requires contentContainerStyle or contentContainerClassName to apply horizontal gap/padding
    expect(text).toMatch(/contentContainerClassName|contentContainerStyle/);
  });

  it('applies consistent uppercase capitalization treatment across routine tab strip labels', () => {
    const content = source(file);

    // Locate top ScrollView section
    const scrollIdx = content.indexOf('<ScrollView');
    const scrollEndIdx = content.indexOf('</ScrollView>');
    expect(scrollIdx).toBeGreaterThanOrEqual(0);
    expect(scrollEndIdx).toBeGreaterThan(scrollIdx);

    const tabStripSection = content.slice(scrollIdx, scrollEndIdx);

    // All Text elements within the tab strip must include uppercase class for consistent label treatment
    const textMatches = tabStripSection.match(/<Text[^>]*>/g) || [];
    expect(textMatches.length).toBeGreaterThanOrEqual(3);

    for (const textTag of textMatches) {
      expect(textTag).toMatch(/\buppercase\b/);
    }
  });

  it('provides comfortable vertical spacing around tab strip container', () => {
    const content = source(file);
    const scrollIdx = content.indexOf('<ScrollView');
    const containerSnippet = content.slice(Math.max(0, scrollIdx - 150), scrollIdx);

    // Outer container should not collapse bottom padding to 0
    expect(containerSnippet).not.toContain('pb-0');
  });

  it('explicitly centers content and prevents shrinking on all tab strip controls', () => {
    const scrollViews = jsxElements(file, 'ScrollView');
    expect(scrollViews.length).toBeGreaterThan(0);

    const topScrollView = scrollViews[0];
    const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const touchables: ts.JsxOpeningLikeElement[] = [];

    function findTouchables(node: ts.Node) {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(ast) === 'TouchableOpacity'
      ) {
        touchables.push(node);
      }
      ts.forEachChild(node, findTouchables);
    }

    findTouchables(topScrollView.parent);

    expect(touchables.length).toBeGreaterThanOrEqual(4);
    for (const touchable of touchables) {
      const text = touchable.getText(ast);
      expect(text).toMatch(/\bitems-center\b/);
      expect(text).toMatch(/\bjustify-center\b/);
      expect(text).toMatch(/\b(shrink-0|flex-shrink-0)\b/);
      expect(text).toMatch(/\bmin-h-\[44px\]/);
    }
  });

  it('renders the add-folder action as a pill-styled chip matching tab controls without generic Button', () => {
    const content = source(file);
    const scrollIdx = content.indexOf('<ScrollView');
    const scrollEndIdx = content.indexOf('</ScrollView>');
    expect(scrollIdx).toBeGreaterThanOrEqual(0);
    expect(scrollEndIdx).toBeGreaterThan(scrollIdx);

    const tabStripSection = content.slice(scrollIdx, scrollEndIdx);

    // Should not use generic secondary Button in the tab strip
    expect(tabStripSection).not.toContain('<Button');

    // Should include newFolder action styled with rounded-full pill treatment
    expect(tabStripSection).toContain('newFolder');
    expect(tabStripSection).toMatch(/rounded-full/);
  });
});
