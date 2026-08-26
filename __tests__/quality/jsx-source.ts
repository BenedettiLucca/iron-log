import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(__dirname, '../..');

export function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

export function jsxElements(relativePath: string, tagName: string): ts.JsxOpeningLikeElement[] {
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

export function propNames(element: ts.JsxOpeningLikeElement): string[] {
  return element.attributes.properties
    .filter(ts.isJsxAttribute)
    .map((attribute) => attribute.name.getText());
}
