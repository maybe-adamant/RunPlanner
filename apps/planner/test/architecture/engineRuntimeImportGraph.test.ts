import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const engineSourceRoot = join(repositoryRoot, 'packages/planner-engine/src');

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? sourceFiles(path)
        : /\.ts$/.test(entry.name) && !entry.name.endsWith('.test.ts')
          ? [path]
          : [];
    })
    .sort();
}

function hasRuntimeImport(clause: ts.ImportClause | undefined): boolean {
  if (clause === undefined) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name !== undefined || clause.namedBindings === undefined) return true;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function hasRuntimeExport(declaration: ts.ExportDeclaration): boolean {
  if (declaration.isTypeOnly) return false;
  if (declaration.exportClause === undefined || ts.isNamespaceExport(declaration.exportClause))
    return true;
  return declaration.exportClause.elements.some((element) => !element.isTypeOnly);
}

function resolveRelativeImport(from: string, specifier: string): string {
  const base = join(dirname(from), specifier.replace(/\.js$/, ''));
  const candidates = [base, `${base}.ts`, join(base, 'index.ts')];
  const resolved = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  if (resolved === undefined)
    throw new Error(
      `unresolved relative import ${specifier} from ${relative(engineSourceRoot, from)}`,
    );
  return resolved;
}

function runtimeRelativeSpecifiers(sourceText: string): readonly string[] {
  const source = ts.createSourceFile('source.ts', sourceText, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    const specifier =
      ts.isImportDeclaration(statement) && hasRuntimeImport(statement.importClause)
        ? statement.moduleSpecifier
        : ts.isExportDeclaration(statement) && hasRuntimeExport(statement)
          ? statement.moduleSpecifier
          : undefined;
    if (
      specifier === undefined ||
      !ts.isStringLiteral(specifier) ||
      !specifier.text.startsWith('.')
    )
      continue;
    specifiers.push(specifier.text);
  }
  return specifiers.sort();
}

function runtimeRelativeImports(path: string): readonly string[] {
  return runtimeRelativeSpecifiers(readFileSync(path, 'utf8'))
    .map((specifier) => resolveRelativeImport(path, specifier))
    .sort();
}

function runtimeCycles(graph: ReadonlyMap<string, readonly string[]>): readonly string[] {
  const status = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];
  const cycles: string[] = [];
  const visit = (path: string) => {
    status.set(path, 'visiting');
    stack.push(path);
    for (const dependency of graph.get(path) ?? []) {
      if (!graph.has(dependency)) continue;
      if (status.get(dependency) === 'visiting') {
        const start = stack.indexOf(dependency);
        cycles.push(
          [...stack.slice(start), dependency]
            .map((entry) => relative(engineSourceRoot, entry))
            .join(' -> '),
        );
      } else if (status.get(dependency) !== 'visited') {
        visit(dependency);
      }
    }
    stack.pop();
    status.set(path, 'visited');
  };
  for (const path of [...graph.keys()].sort()) {
    if (status.get(path) === undefined) visit(path);
  }
  return cycles;
}

describe('planner-engine runtime import graph', () => {
  it('has no relative runtime import cycles', () => {
    const paths = sourceFiles(engineSourceRoot);
    const graph = new Map(paths.map((path) => [path, runtimeRelativeImports(path)]));

    expect(runtimeCycles(graph)).toEqual([]);
  });

  it('detects a runtime barrel cycle while ignoring type-only imports', () => {
    const structural = join(engineSourceRoot, 'fixture/structural.ts');
    const barrel = join(engineSourceRoot, 'fixture/index.ts');
    const batch = join(engineSourceRoot, 'fixture/batch.ts');
    const typeOnly = join(engineSourceRoot, 'fixture/model.ts');
    const graph = new Map<string, readonly string[]>([
      [structural, [barrel]],
      [barrel, [batch]],
      [batch, [structural]],
      [typeOnly, []],
    ]);

    expect(runtimeCycles(graph)).toHaveLength(1);
    expect(
      runtimeCycles(
        new Map([
          [structural, []],
          [typeOnly, []],
        ]),
      ),
    ).toEqual([]);
    expect(
      runtimeRelativeSpecifiers(
        "import type { Model } from './model'; export type { Model } from './model';",
      ),
    ).toEqual([]);
    expect(runtimeRelativeSpecifiers("export { value } from './barrel';")).toEqual(['./barrel']);
  });
});
