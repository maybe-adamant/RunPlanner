import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const uiRoot = join(repositoryRoot, 'apps/planner/src/ui');

function productionSources(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });
}

describe('editor button classification boundary', () => {
  it('requires every production button to declare an explicit class', () => {
    const unclassified: string[] = [];

    for (const path of productionSources(uiRoot)) {
      const source = readFileSync(path, 'utf8');
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node): void => {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          node.tagName.getText(file) === 'button' &&
          !node.attributes.properties.some(
            (attribute) =>
              ts.isJsxAttribute(attribute) && attribute.name.getText(file) === 'className',
          )
        ) {
          const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
          unclassified.push(`${relative(uiRoot, path)}:${line}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
    }

    expect(unclassified).toEqual([]);
  });
});
