import type { Catalog, RouteDeclaration } from '../catalog';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type AuthoredBiomePlan,
  type AuthoredRoutePlan,
  type ProjectDocument,
} from './model';

type UnknownRecord = Record<string, unknown>;

export class ProjectDocumentContractError extends Error {
  readonly path: string;
  readonly detail: string;

  constructor(path: string, detail: string) {
    super(`${path}: ${detail}`);
    this.name = 'ProjectDocumentContractError';
    this.path = path;
    this.detail = detail;
  }
}

function fail(path: string, detail: string): never {
  throw new ProjectDocumentContractError(path, detail);
}

function expectRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as UnknownRecord;
}

function expectExactKeys(value: UnknownRecord, keys: readonly string[], path: string): void {
  const allowedKeys = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      fail(`${path}.${key}`, 'is not a project document field');
    }
  }
}

function expectArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    fail(path, 'must be an array');
  }
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    fail(path, 'must be a string');
  }
  return value;
}

function expectNonBlankString(value: unknown, path: string): string {
  const stringValue = expectString(value, path);
  if (stringValue.trim().length === 0) {
    fail(path, 'must not be blank');
  }
  return stringValue;
}

function decodeBiomePlan(
  value: unknown,
  path: string,
  expectedBiomeStepKey: string,
  catalog: Catalog,
): AuthoredBiomePlan {
  const plan = expectRecord(value, path);
  expectExactKeys(plan, ['kind', 'biomeStepKey', 'topology'], path);

  const layout = catalog.biomeLayouts.byKey[expectedBiomeStepKey];
  if (layout === undefined) {
    fail(path, `catalog has no authored layout for ${expectedBiomeStepKey}`);
  }

  const kind = expectString(plan.kind, `${path}.kind`);
  if (kind !== layout.kind) {
    fail(`${path}.kind`, `expected ${layout.kind}, received ${kind}`);
  }

  const biomeStepKey = expectString(plan.biomeStepKey, `${path}.biomeStepKey`);
  if (biomeStepKey !== expectedBiomeStepKey) {
    fail(`${path}.biomeStepKey`, `expected contiguous step ${expectedBiomeStepKey}`);
  }

  if (plan.topology !== null) {
    fail(`${path}.topology`, 'must be null until authored topology is created');
  }

  return Object.freeze({
    kind: 'LinearBiome',
    biomeStepKey,
    topology: null,
  });
}

function decodeRoutePlan(
  value: unknown,
  path: string,
  route: RouteDeclaration,
  catalog: Catalog,
): AuthoredRoutePlan {
  const plan = expectRecord(value, path);
  expectExactKeys(plan, ['routeKey', 'biomes'], path);

  const routeKey = expectString(plan.routeKey, `${path}.routeKey`);
  if (routeKey !== route.key) {
    fail(`${path}.routeKey`, `expected ${route.key}, received ${routeKey}`);
  }

  const rawBiomes = expectArray(plan.biomes, `${path}.biomes`);
  if (rawBiomes.length > route.biomeSteps.length) {
    fail(`${path}.biomes`, `exceeds the ${route.biomeSteps.length}-step route`);
  }

  const biomes = rawBiomes.map((biome, index) => {
    const expectedStep = route.biomeSteps[index];
    if (expectedStep === undefined) {
      fail(`${path}.biomes[${index}]`, 'has no matching route step');
    }
    return decodeBiomePlan(biome, `${path}.biomes[${index}]`, expectedStep.key, catalog);
  });

  return Object.freeze({
    routeKey,
    biomes: Object.freeze(biomes),
  });
}

export function decodeProjectDocument(value: unknown, catalog: Catalog): ProjectDocument {
  const document = expectRecord(value, '$');
  expectExactKeys(
    document,
    ['schemaVersion', 'projectId', 'name', 'catalogVersion', 'routes'],
    '$',
  );

  if (document.schemaVersion !== PROJECT_DOCUMENT_SCHEMA_VERSION) {
    fail(
      '$.schemaVersion',
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received ${String(document.schemaVersion)}`,
    );
  }

  const projectId = expectNonBlankString(document.projectId, '$.projectId');
  const name = expectNonBlankString(document.name, '$.name');
  const catalogVersion = expectString(document.catalogVersion, '$.catalogVersion');
  if (catalogVersion !== catalog.version) {
    fail(
      '$.catalogVersion',
      `expected compatible catalog ${catalog.version}, received ${catalogVersion}`,
    );
  }

  const rawRoutes = expectArray(document.routes, '$.routes');
  const routesByKey = new Map<string, AuthoredRoutePlan>();

  for (const [index, rawRoute] of rawRoutes.entries()) {
    const path = `$.routes[${index}]`;
    const routeRecord = expectRecord(rawRoute, path);
    const routeKey = expectString(routeRecord.routeKey, `${path}.routeKey`);
    const route = catalog.routes.byKey[routeKey];
    if (route === undefined) {
      fail(`${path}.routeKey`, `unknown route ${routeKey}`);
    }
    if (routesByKey.has(routeKey)) {
      fail(`${path}.routeKey`, `duplicates route ${routeKey}`);
    }
    routesByKey.set(routeKey, decodeRoutePlan(routeRecord, path, route, catalog));
  }

  const routes = catalog.routes.values.map((route) => {
    const plan = routesByKey.get(route.key);
    if (plan === undefined) {
      fail('$.routes', `missing route ${route.key}`);
    }
    return plan;
  });

  if (routesByKey.size !== catalog.routes.values.length) {
    fail('$.routes', `must contain exactly ${catalog.routes.values.length} routes`);
  }

  return Object.freeze({
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    projectId,
    name,
    catalogVersion,
    routes: Object.freeze(routes),
  });
}

export function parseProjectDocument(json: string, catalog: Catalog): ProjectDocument {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    fail('$', 'must be valid JSON');
  }
  return decodeProjectDocument(value, catalog);
}

export function encodeProjectDocument(document: ProjectDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
