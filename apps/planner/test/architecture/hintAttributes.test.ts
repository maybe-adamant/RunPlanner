import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const sourceRoot = join(repositoryRoot, 'apps/planner/src');

function productionSources(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

function hasTitleKey(expression: ts.Node, file: ts.SourceFile): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isObjectLiteralExpression(node) &&
      node.properties.some((property) => property.name?.getText(file) === 'title')
    )
      found = true;
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
}

describe('hint attribute boundary', () => {
  it('renders hover text through data-hint rather than a native title on DOM elements', () => {
    const nativeTitles: string[] = [];

    for (const path of productionSources(sourceRoot)) {
      const file = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node: ts.Node): void => {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          /^[a-z]/.test(node.tagName.getText(file)) &&
          node.attributes.properties.some((attribute) =>
            ts.isJsxAttribute(attribute)
              ? attribute.name.getText(file) === 'title'
              : hasTitleKey(attribute.expression, file),
          )
        ) {
          const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
          nativeTitles.push(`${relative(sourceRoot, path)}:${line}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
    }

    expect(nativeTitles).toEqual([]);
  });
});
