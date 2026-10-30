import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

interface PackageManifest {
  readonly name: string;
  readonly exports?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

function manifest(directory: string): PackageManifest {
  return JSON.parse(readFileSync(join(repositoryRoot, directory, 'package.json'), 'utf8'));
}

/** Repository path aliases from `tsconfig.base.json`; they are not workspace packages. */
const repositoryAliases = ['@run-planner/test-fixtures', '@run-planner/test-config'];

/**
 * The workspace packages each lane may import from its source: the catalog compiles into the
 * engine's contract, Draft consumes declared engine entries, the run import consumes those and
 * Draft's repairer, and the application composes all of them.
 */
const allowedSourcePackages: Readonly<Record<string, readonly string[]>> = {
  'packages/hades2-catalog': ['@run-planner/engine'],
  'packages/planner-engine': [],
  'packages/draft': ['@run-planner/engine'],
  'packages/run-import': ['@run-planner/engine', '@run-planner/draft'],
  'apps/planner': [
    '@run-planner/engine',
    '@run-planner/hades2-catalog',
    '@run-planner/draft',
    '@run-planner/run-import',
  ],
};
/** Tests may also construct inputs from the catalog. */
const allowedTestPackages: Readonly<Record<string, readonly string[]>> = {
  'packages/hades2-catalog': ['@run-planner/engine'],
  'packages/planner-engine': ['@run-planner/hades2-catalog'],
  'packages/draft': ['@run-planner/engine', '@run-planner/hades2-catalog'],
  'packages/run-import': [
    '@run-planner/engine',
    '@run-planner/draft',
    '@run-planner/hades2-catalog',
  ],
};
/** Packages that consume the engine only through its declared entries. */
const engineConsumers = ['packages/draft', 'packages/run-import', 'apps/planner'];
/**
 * Every lane's relative imports stay inside its own root, so a relative path cannot bypass the
 * dependency direction or the engine's declared entries.
 */
const relativeImportRoots = Object.keys(allowedSourcePackages);
/** Tests may run the repository's offline schema migration tool on legacy documents. */
const schemaMigrationTool = join(repositoryRoot, 'schema', 'migrate-project.js');

function sourceFiles(directory: string): readonly string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(entry.name) ? [path] : [];
    })
    .sort();
}

function moduleSpecifiers(path: string): readonly string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      specifiers.push(node.moduleSpecifier.text);
    else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    )
      specifiers.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

function workspacePackage(specifier: string): string | undefined {
  if (!specifier.startsWith('@run-planner/')) return undefined;
  if (repositoryAliases.some((alias) => specifier === alias || specifier.startsWith(`${alias}/`)))
    return undefined;
  return specifier.split('/').slice(0, 2).join('/');
}

function imports(directory: string, tree: 'src' | 'test') {
  return sourceFiles(join(repositoryRoot, directory, tree)).flatMap((path) =>
    moduleSpecifiers(path).map((specifier) => ({
      file: relative(repositoryRoot, path),
      path,
      specifier,
    })),
  );
}

describe('workspace package boundaries', () => {
  const engineEntries = Object.keys(manifest('packages/planner-engine').exports ?? {}).map(
    (entry) => `@run-planner/engine${entry.slice(1)}`,
  );

  it.each(engineConsumers)('%s imports the engine only through declared entries', (directory) => {
    const undeclared = [...imports(directory, 'src'), ...imports(directory, 'test')]
      .filter(({ specifier }) => workspacePackage(specifier) === '@run-planner/engine')
      .filter(({ specifier }) => !engineEntries.includes(specifier))
      .map(({ file, specifier }) => `${file}: ${specifier}`);

    expect(undeclared).toEqual([]);
  });

  it.each(relativeImportRoots)('keeps every %s relative import inside its package', (directory) => {
    const root = join(repositoryRoot, directory);
    const escapes = (tree: 'src' | 'test') =>
      imports(directory, tree)
        .filter(({ specifier }) => specifier.startsWith('.'))
        .map((entry) => ({ ...entry, target: resolve(dirname(entry.path), entry.specifier) }))
        .filter(({ target }) => !target.startsWith(root + sep));
    const escaping = [
      ...escapes('src'),
      ...escapes('test').filter(({ target }) => target !== schemaMigrationTool),
    ].map(({ file, specifier }) => `${file}: ${specifier}`);

    expect(escaping).toEqual([]);
  });

  it.each(Object.keys(allowedSourcePackages))(
    '%s follows the package dependency direction and declares what it imports',
    (directory) => {
      const own = manifest(directory);
      const declared = { ...own.dependencies, ...own.devDependencies };
      const used = (tree: 'src' | 'test') =>
        new Set(
          imports(directory, tree)
            .map(({ specifier }) => workspacePackage(specifier))
            .filter((name): name is string => name !== undefined && name !== own.name),
        );
      const source = [...used('src')].sort();
      const test = [...used('test')].sort();

      expect(source.filter((name) => !allowedSourcePackages[directory]!.includes(name))).toEqual(
        [],
      );
      if (directory in allowedTestPackages)
        expect(test.filter((name) => !allowedTestPackages[directory]!.includes(name))).toEqual([]);
      expect(source.filter((name) => own.dependencies?.[name] === undefined)).toEqual([]);
      expect(test.filter((name) => declared[name] === undefined)).toEqual([]);
    },
  );
});
