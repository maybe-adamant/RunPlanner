import type { Catalog, RouteDeclaration } from '../catalog-schema';
import { decodeBiomeState } from './biomeState';
import { decodeBiomeTopology } from './topology/codec';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type AuthoredBiomePlan,
  type AuthoredRoutePlan,
  type ProjectDocument,
} from './model';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument as fail,
} from './validation';

export { ProjectDocumentContractError } from './validation';

function decodeBiomePlan(
  value: unknown,
  path: string,
  expectedBiomeKey: string,
  catalog: Catalog,
): AuthoredBiomePlan {
  const plan = expectRecord(value, path);

  const layout = catalog.biomeLayouts.byKey[expectedBiomeKey];
  if (layout === undefined) {
    fail(path, `catalog has no authored layout for ${expectedBiomeKey}`);
  }

  const biomeKey = expectString(plan.biomeKey, `${path}.biomeKey`);
  if (biomeKey !== expectedBiomeKey) {
    fail(`${path}.biomeKey`, `expected contiguous biome ${expectedBiomeKey}`);
  }

  expectExactKeys(plan, ['biomeKey', 'state', 'topology'], path);
  const topology =
    plan.topology === null
      ? null
      : decodeBiomeTopology(plan.topology, catalog, layout, `${path}.topology`);
  return Object.freeze({
    biomeKey,
    state: decodeBiomeState(plan.state, layout, `${path}.state`),
    topology,
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
  if (rawBiomes.length > route.biomeKeys.length) {
    fail(`${path}.biomes`, `exceeds the ${route.biomeKeys.length}-biome route`);
  }

  const biomes = rawBiomes.map((biome, index) => {
    const expectedBiomeKey = route.biomeKeys[index];
    if (expectedBiomeKey === undefined) {
      fail(`${path}.biomes[${index}]`, 'has no matching route biome');
    }
    return decodeBiomePlan(biome, `${path}.biomes[${index}]`, expectedBiomeKey, catalog);
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
