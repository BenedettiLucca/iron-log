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

describe('Sprint 6 programs/routines/supplements residual accessibility', () => {
  it('marks all supplement decorative SVGs as accessible={false}', () => {
    const svgs = jsxElements('app/supplements/index.tsx', 'Svg');
    const visible = svgs.filter(
      (element) => !element.getText().includes('accessible={false}'),
    );
    expect({
      total: svgs.length,
      visible: visible.map((element) => element.getText().slice(0, 80)),
    }).toEqual({ total: svgs.length, visible: [] });
  });

  it('gives the supplements reminder-time trigger button semantics', () => {
    const touchables = jsxElements('app/supplements/index.tsx', 'TouchableOpacity');
    const reminderTrigger = touchables.find((element) => {
      const text = element.getText();
      return text.includes('reminderTime') && text.includes('onPress');
    });
    expect(reminderTrigger).toBeDefined();
    const props = propNames(reminderTrigger!);
    expect(props).toContain('accessibilityRole');
  });

  it('gives templates back button accessibilityRole and accessibilityLabel', () => {
    const touchables = jsxElements('app/routines/templates.tsx', 'TouchableOpacity');
    const backBtn = touchables.find(
      (element) => element.getText().includes('router.back()') && !element.getText().includes('onLongPress'),
    );
    expect(backBtn).toBeDefined();
    const props = propNames(backBtn!);
    expect(props).toContain('accessibilityRole');
    expect(props).toContain('accessibilityLabel');
  });
});
