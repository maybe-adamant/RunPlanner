import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

function testFilesUnder(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...testFilesUnder(path));
    } else if (/\.test\.(?:ts|tsx|js)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

const vitestTestNames = new Set(['it', 'test']);
const vitestSuiteNames = new Set(['describe', 'suite']);
const vitestHookNamespaceNames = new Set(['ctx', 'suite', 'test']);
const vitestHookNames = new Set([
  'beforeAll',
  'afterAll',
  'beforeEach',
  'afterEach',
  'aroundAll',
  'aroundEach',
  'onTestFailed',
  'onTestFinished',
]);

interface LocalTimeoutViolation {
  readonly kind:
    | 'test-third-argument'
    | 'test-timeout-option'
    | 'test-retry-option'
    | 'suite-third-argument'
    | 'suite-timeout-option'
    | 'suite-retry-option'
    | 'hook-second-argument';
  readonly line: number;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function callableName(expression: ts.Expression): string | undefined {
  const unwrapped = unwrapExpression(expression);
  if (ts.isIdentifier(unwrapped)) return unwrapped.text;
  if (ts.isPropertyAccessExpression(unwrapped)) {
    const owner = callableName(unwrapped.expression);
    return owner === undefined ? undefined : `${owner}.${unwrapped.name.text}`;
  }
  if (ts.isCallExpression(unwrapped)) return callableName(unwrapped.expression);
  return undefined;
}

function hasOption(
  expression: ts.Expression | undefined,
  optionName: 'retry' | 'timeout',
): boolean {
  if (expression === undefined) return false;
  const unwrapped = unwrapExpression(expression);
  if (!ts.isObjectLiteralExpression(unwrapped)) return false;
  return unwrapped.properties.some((property) => {
    if (
      !ts.isPropertyAssignment(property) &&
      !ts.isShorthandPropertyAssignment(property) &&
      !ts.isMethodDeclaration(property)
    ) {
      return false;
    }
    if (property.name === undefined) return false;
    if (ts.isIdentifier(property.name)) return property.name.text === optionName;
    if (ts.isStringLiteral(property.name)) return property.name.text === optionName;
    return ts.isNoSubstitutionTemplateLiteral(property.name) && property.name.text === optionName;
  });
}

function isObjectOptions(expression: ts.Expression | undefined): boolean {
  return expression !== undefined && ts.isObjectLiteralExpression(unwrapExpression(expression));
}

function localTimeoutViolations(
  source: string,
  fileName = 'policy-mutation.ts',
): LocalTimeoutViolation[] {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const violations: LocalTimeoutViolation[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const name = callableName(node.expression);
      const finalName = name?.split('.').at(-1);
      const rootName = name?.split('.')[0];
      const isVitestHook =
        finalName !== undefined &&
        vitestHookNames.has(finalName) &&
        (name === finalName || (rootName !== undefined && vitestHookNamespaceNames.has(rootName)));
      if (isVitestHook) {
        if (node.arguments.length >= 2) {
          violations.push({
            kind: 'hook-second-argument',
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          });
        }
      } else {
        const owner =
          rootName !== undefined && vitestTestNames.has(rootName)
            ? 'test'
            : rootName !== undefined && vitestSuiteNames.has(rootName)
              ? 'suite'
              : undefined;
        const kind = hasOption(node.arguments[1], 'timeout')
          ? owner === 'suite'
            ? 'suite-timeout-option'
            : owner === 'test'
              ? 'test-timeout-option'
              : undefined
          : hasOption(node.arguments[1], 'retry')
            ? owner === 'suite'
              ? 'suite-retry-option'
              : owner === 'test'
                ? 'test-retry-option'
                : undefined
            : node.arguments.length >= 3 && !isObjectOptions(node.arguments[1])
              ? owner === 'suite'
                ? 'suite-third-argument'
                : owner === 'test'
                  ? 'test-third-argument'
                  : undefined
              : undefined;
        if (kind !== undefined) {
          violations.push({
            kind,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

describe('repository test execution policy', () => {
  it('uses one correctness entry point and retires regular/heavy lane machinery', () => {
    const packageJson = JSON.parse(readFileSync(`${repositoryRoot}/package.json`, 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts['test:correctness']).toBe('vitest run --config vitest.config.ts');
    expect(packageJson.scripts['test']).toBe(
      'npm run test:correctness && npm run test:performance',
    );
    expect(packageJson.scripts['test:regular']).toBeUndefined();
    expect(packageJson.scripts['test:heavy']).toBeUndefined();
    expect(existsSync(`${repositoryRoot}/vitest.regular.config.ts`)).toBe(false);
    expect(existsSync(`${repositoryRoot}/vitest.heavy.config.ts`)).toBe(false);
    expect(existsSync(`${repositoryRoot}/vitest.test-lanes.ts`)).toBe(false);
  });

  it('keeps watchdogs and worker ownership in the shared configuration', () => {
    const sharedConfig = readFileSync(`${repositoryRoot}/vitest.shared.ts`, 'utf8');
    expect(sharedConfig).toContain('testTimeout: correctnessTestTimeoutMs');
    expect(sharedConfig).toContain('hookTimeout: correctnessHookTimeoutMs');
    expect(sharedConfig).toContain('teardownTimeout: correctnessTeardownTimeoutMs');
    expect(sharedConfig).toContain('retry: 0');
    expect(sharedConfig).toContain('correctnessTestTimeoutMs = 120_000');
    expect(sharedConfig).toContain('correctnessHookTimeoutMs = 120_000');
    expect(sharedConfig).toContain('correctnessTeardownTimeoutMs = 30_000');
    expect(sharedConfig).toContain('correctnessMaxWorkers = 8');
  });

  it('keeps correctness, performance, and fixture selection closed', () => {
    const correctnessConfig = readFileSync(`${repositoryRoot}/vitest.config.ts`, 'utf8');
    const performanceConfig = readFileSync(
      `${repositoryRoot}/vitest.performance.config.ts`,
      'utf8',
    );
    const fixtureConfig = readFileSync(`${repositoryRoot}/vitest.fixtures.config.ts`, 'utf8');

    expect(correctnessConfig).toContain("'packages/*/test/**/*.test.ts'");
    expect(correctnessConfig).toContain("'apps/*/src/**/*.test.{ts,tsx}'");
    expect(correctnessConfig).toContain("'apps/*/test/**/*.test.{ts,tsx}'");
    expect(correctnessConfig).toContain('exclude: [performanceTestFile]');
    expect(correctnessConfig).not.toContain('vitest.test-lanes');
    expect(performanceConfig).toContain('include: [performanceTestFile]');
    expect(performanceConfig).toContain('maxWorkers: 1');
    expect(fixtureConfig).toContain('maxWorkers: 1');

    const appAndPackageTests = [
      ...testFilesUnder(`${repositoryRoot}/apps`),
      ...testFilesUnder(`${repositoryRoot}/packages`),
    ];
    const performanceFile = `${repositoryRoot}/apps/planner/test/product-loops/UnifiedBiomePerformance.test.ts`;
    expect(appAndPackageTests).toContain(performanceFile);
    const outsideCorrectnessGlobs = appAndPackageTests
      .map((path) => relative(repositoryRoot, path).replaceAll('\\', '/'))
      .filter(
        (path) =>
          !/^packages\/[^/]+\/test\/.+\.test\.ts$/.test(path) &&
          !/^apps\/[^/]+\/(?:src|test)\/.+\.test\.(?:ts|tsx)$/.test(path),
      );
    expect(outsideCorrectnessGlobs).toEqual([]);

    for (const fixtureTest of testFilesUnder(`${repositoryRoot}/test`).map((path) =>
      relative(repositoryRoot, path),
    )) {
      expect(fixtureConfig).toContain(fixtureTest);
    }
  });

  it('has no local correctness timeout overrides', () => {
    const sourceFiles = [
      ...testFilesUnder(`${repositoryRoot}/apps`),
      ...testFilesUnder(`${repositoryRoot}/packages`),
      ...testFilesUnder(`${repositoryRoot}/test`),
    ];
    const offenders = sourceFiles.flatMap((path) =>
      localTimeoutViolations(readFileSync(path, 'utf8'), path).map((violation) => ({
        path: relative(repositoryRoot, path),
        ...violation,
      })),
    );
    expect(offenders).toEqual([]);
  });

  const timeoutMutationCases = [
    ['numeric third test argument', "it('numeric', () => {}, 30_000);", 'test-third-argument'],
    [
      'named third test argument',
      "const timeoutMs = namedTimeout; it('named', () => {}, timeoutMs);",
      'test-third-argument',
    ],
    ['hook second argument', 'beforeAll(() => {}, timeoutMs);', 'hook-second-argument'],
    [
      'test timeout option',
      "it('options', { timeout: timeoutMs }, () => {});",
      'test-timeout-option',
    ],
    [
      'each test third argument',
      "it.each([1])('each', () => {}, timeoutMs);",
      'test-third-argument',
    ],
    [
      'hook reached through test namespace',
      'test.beforeAll(() => {}, timeoutMs);',
      'hook-second-argument',
    ],
    ['suite third argument', "suite('suite', () => {}, timeoutMs);", 'suite-third-argument'],
    [
      'suite string timeout option',
      'describe(\'suite\', { "timeout": timeoutMs }, () => {});',
      'suite-timeout-option',
    ],
    ['test retry option', "test('retry', { retry: 1 }, () => {});", 'test-retry-option'],
    ['suite retry option', 'suite(\'retry\', { "retry": 1 }, () => {});', 'suite-retry-option'],
  ] as const;

  it.each(timeoutMutationCases)('rejects a %s structurally', (_label, source, kind) => {
    expect(localTimeoutViolations(source)).toEqual([expect.objectContaining({ kind })]);
  });

  it('allows ordinary test data containing timeout-like numbers', () => {
    expect(
      localTimeoutViolations(`
        const values = { timeout: 30_000, retries: 2 };
        expect(values.timeout).toBe(30_000);
        fixture.beforeAll(() => {}, timeoutMs);
      `),
    ).toEqual([]);
  });

  it('allows non-timeout options on test and for calls', () => {
    expect(
      localTimeoutViolations(`
        test('other options', { repeats: 0 }, () => {});
        test.for([1])('other options', { repeats: 0 }, () => {});
      `),
    ).toEqual([]);
  });

  it('rejects timeout arguments on test-context hooks', () => {
    expect(
      localTimeoutViolations(`
        ctx.onTestFailed(() => {}, timeoutMs);
        ctx.onTestFinished(() => {}, timeoutMs);
      `),
    ).toEqual([
      expect.objectContaining({ kind: 'hook-second-argument' }),
      expect.objectContaining({ kind: 'hook-second-argument' }),
    ]);
  });
});
