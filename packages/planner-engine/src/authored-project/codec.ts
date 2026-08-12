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

  // This dormant child is optional in the authored model. Encoding can omit
  // it, so decoding must accept that exact persisted representation too.
  expectExactKeys(
    plan,
    ['biomeKey', 'state', 'topology', 'bossCompletionArcanaKeys', 'postbossKeepsakeDisposition'],
    path,
  );
  const rawBossKeys =
    plan.bossCompletionArcanaKeys === undefined
      ? []
      : expectArray(plan.bossCompletionArcanaKeys, `${path}.bossCompletionArcanaKeys`);
  if (rawBossKeys.length > catalog.arcanaCards.values.length) {
    fail(`${path}.bossCompletionArcanaKeys`, 'exceeds Arcana card count');
  }
  const bossCompletionArcanaKeys = rawBossKeys.map((entry, index) =>
    expectString(entry, `${path}.bossCompletionArcanaKeys[${index}]`),
  );
  const bossSet = new Set<string>();
  for (const [index, key] of bossCompletionArcanaKeys.entries()) {
    if (catalog.arcanaCards.byKey[key] === undefined)
      fail(`${path}.bossCompletionArcanaKeys[${index}]`, `unknown Arcana ${key}`);
    if (bossSet.has(key)) fail(`${path}.bossCompletionArcanaKeys[${index}]`, `duplicates ${key}`);
    bossSet.add(key);
  }
  const topology =
    plan.topology === null
      ? null
      : decodeBiomeTopology(plan.topology, catalog, layout, `${path}.topology`);
  const canOwnPostbossKeepsake = catalog.biomes.byKey[biomeKey]?.hasPostbossKeepsakeRack === true;
  const rawDisposition = plan.postbossKeepsakeDisposition;
  if (canOwnPostbossKeepsake !== (rawDisposition !== undefined))
    fail(
      `${path}.postbossKeepsakeDisposition`,
      canOwnPostbossKeepsake ? 'is required' : 'is not supported',
    );
  let postbossKeepsakeDisposition: AuthoredBiomePlan['postbossKeepsakeDisposition'];
  if (rawDisposition !== undefined) {
    const disposition = expectRecord(rawDisposition, `${path}.postbossKeepsakeDisposition`);
    const kind = expectString(disposition.kind, `${path}.postbossKeepsakeDisposition.kind`);
    if (kind === 'retain') {
      expectExactKeys(disposition, ['kind'], `${path}.postbossKeepsakeDisposition`);
      postbossKeepsakeDisposition = Object.freeze({ kind: 'retain' });
    } else if (kind === 'replace') {
      expectExactKeys(disposition, ['kind', 'keepsakeKey'], `${path}.postbossKeepsakeDisposition`);
      const keepsakeKey = expectString(
        disposition.keepsakeKey,
        `${path}.postbossKeepsakeDisposition.keepsakeKey`,
      );
      if (catalog.keepsakes.byKey[keepsakeKey] === undefined)
        fail(`${path}.postbossKeepsakeDisposition.keepsakeKey`, `unknown keepsake ${keepsakeKey}`);
      postbossKeepsakeDisposition = Object.freeze({ kind: 'replace', keepsakeKey });
    } else fail(`${path}.postbossKeepsakeDisposition.kind`, 'must be retain or replace');
  }
  return Object.freeze({
    biomeKey,
    state: decodeBiomeState(plan.state, layout, `${path}.state`),
    topology,
    ...(plan.bossCompletionArcanaKeys === undefined
      ? {}
      : {
          bossCompletionArcanaKeys: Object.freeze(
            catalog.arcanaCards.values
              .filter((card) => bossSet.has(card.key))
              .map((card) => card.key),
          ),
        }),
    ...(postbossKeepsakeDisposition === undefined ? {} : { postbossKeepsakeDisposition }),
  });
}

function decodeRoutePlan(
  value: unknown,
  path: string,
  route: RouteDeclaration,
  catalog: Catalog,
): AuthoredRoutePlan {
  const arcanaCards = catalog.arcanaCards;
  const fearVows = catalog.fearVows;
  const plan = expectRecord(value, path);
  expectExactKeys(plan, ['routeKey', 'loadout', 'biomes'], path);

  const routeKey = expectString(plan.routeKey, `${path}.routeKey`);
  if (routeKey !== route.key) {
    fail(`${path}.routeKey`, `expected ${route.key}, received ${routeKey}`);
  }

  const loadout = expectRecord(plan.loadout, `${path}.loadout`);
  expectExactKeys(
    loadout,
    ['weaponKey', 'aspectKey', 'manualArcanaKeys', 'fearRanks', 'startingKeepsakeKey'],
    `${path}.loadout`,
  );
  const weaponKey = expectString(loadout.weaponKey, `${path}.loadout.weaponKey`);
  const aspectKey = expectString(loadout.aspectKey, `${path}.loadout.aspectKey`);
  const startingKeepsakeKey = expectString(
    loadout.startingKeepsakeKey,
    `${path}.loadout.startingKeepsakeKey`,
  );
  if (catalog.keepsakes.byKey[startingKeepsakeKey] === undefined)
    fail(`${path}.loadout.startingKeepsakeKey`, `unknown keepsake ${startingKeepsakeKey}`);
  const weapon = catalog.weapons.byKey[weaponKey];
  if (weapon === undefined) fail(`${path}.loadout.weaponKey`, `unknown weapon ${weaponKey}`);
  if (!weapon.aspectKeys.includes(aspectKey)) {
    fail(`${path}.loadout.aspectKey`, `${aspectKey} does not belong to ${weaponKey}`);
  }
  const manualArcanaKeys = expectArray(
    loadout.manualArcanaKeys,
    `${path}.loadout.manualArcanaKeys`,
  ).map((value, index) => expectString(value, `${path}.loadout.manualArcanaKeys[${index}]`));
  const manualSet = new Set<string>();
  for (const [index, key] of manualArcanaKeys.entries()) {
    const card = arcanaCards.byKey[key];
    if (card === undefined)
      fail(`${path}.loadout.manualArcanaKeys[${index}]`, `unknown Arcana ${key}`);
    if (card.activation.kind !== 'manual')
      fail(`${path}.loadout.manualArcanaKeys[${index}]`, `${key} is automatic`);
    if (manualSet.has(key)) fail(`${path}.loadout.manualArcanaKeys[${index}]`, `duplicates ${key}`);
    manualSet.add(key);
  }
  const canonicalManualArcanaKeys = arcanaCards.values
    .filter((card) => manualSet.has(card.key))
    .map((card) => card.key);
  const fearRanksRecord = expectRecord(loadout.fearRanks, `${path}.loadout.fearRanks`);
  expectExactKeys(
    fearRanksRecord,
    fearVows.values.map((vow) => vow.key),
    `${path}.loadout.fearRanks`,
  );
  const fearRanks: Record<string, number> = {};
  for (const vow of fearVows.values) {
    const rank = fearRanksRecord[vow.key];
    if (
      !Number.isInteger(rank) ||
      typeof rank !== 'number' ||
      rank < 0 ||
      rank > vow.incrementalFear.length
    )
      fail(
        `${path}.loadout.fearRanks.${vow.key}`,
        `must be an integer from 0 through ${vow.incrementalFear.length}`,
      );
    fearRanks[vow.key] = rank;
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
    loadout: Object.freeze({
      weaponKey,
      aspectKey,
      manualArcanaKeys: Object.freeze(canonicalManualArcanaKeys),
      fearRanks: Object.freeze(fearRanks),
      startingKeepsakeKey,
    }),
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
