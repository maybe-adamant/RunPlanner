import type { Catalog, RouteDeclaration } from '../catalog-schema';
import { decodeBiomeState } from './biomeState';
import { assessStartingArcanaGrasp } from './loadout';
import { normalizeAuthoredHexTree } from './hex-tree';
import { decodeBiomeTopology } from './topology/codec';
import { decodeKeepsakeEquipResults } from './keepsake-equip-codec';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type AuthoredBiomePlan,
  type AuthoredRoutePlan,
  type ProjectDocument,
} from './model';
import {
  expectArray,
  expectExactKeys,
  expectRecord,
  expectNonBlankString,
  expectString,
  failProjectDocument as fail,
} from './validation';

function decodeHexTree(
  value: unknown,
  catalog: Catalog,
  spellTraitKey: string,
  path: string,
): import('./traits').AuthoredHexTreeConfiguration {
  const raw = expectRecord(value, path);
  expectExactKeys(raw, ['layoutKey', 'rareTalentKeys', 'epicTalentKeys'], path);
  const rareTalentKeys = expectArray(raw.rareTalentKeys, `${path}.rareTalentKeys`).map(
    (entry, index) => expectString(entry, `${path}.rareTalentKeys[${index}]`),
  );
  const epicTalentKeys = expectArray(raw.epicTalentKeys, `${path}.epicTalentKeys`).map(
    (entry, index) => expectString(entry, `${path}.epicTalentKeys[${index}]`),
  );
  try {
    return normalizeAuthoredHexTree(catalog, spellTraitKey, {
      layoutKey: expectString(
        raw.layoutKey,
        `${path}.layoutKey`,
      ) as import('../catalog-schema').HexLayoutKey,
      rareTalentKeys,
      epicTalentKeys,
    });
  } catch (error) {
    fail(path, error instanceof Error ? error.message : 'invalid Hex tree');
  }
}

export { ProjectDocumentContractError } from './validation';

function decodeBiomePlan(
  value: unknown,
  path: string,
  routeKey: string,
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

  expectExactKeys(plan, ['biomeKey', 'state', 'topology', 'echoKeepsakeReplayResults'], path);
  const topology =
    plan.topology === null
      ? null
      : decodeBiomeTopology(plan.topology, catalog, layout, routeKey, `${path}.topology`);
  return Object.freeze({
    biomeKey,
    state: decodeBiomeState(plan.state, layout, `${path}.state`),
    topology,
    ...(plan.echoKeepsakeReplayResults === undefined
      ? {}
      : {
          echoKeepsakeReplayResults: (() => {
            const results = decodeKeepsakeEquipResults(
              plan.echoKeepsakeReplayResults,
              `${path}.echoKeepsakeReplayResults`,
              catalog,
            );
            if ('jeweledPom' in results && results.jeweledPom !== undefined)
              fail(`${path}.echoKeepsakeReplayResults.jeweledPom`, 'is not supported');
            return results;
          })(),
        }),
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
  expectExactKeys(plan, ['routeKey', 'loadout', 'resourcePlacements', 'biomes'], path);

  const routeKey = expectString(plan.routeKey, `${path}.routeKey`);
  if (routeKey !== route.key) {
    fail(`${path}.routeKey`, `expected ${route.key}, received ${routeKey}`);
  }
  const rawResources = expectRecord(plan.resourcePlacements, `${path}.resourcePlacements`);
  expectExactKeys(
    rawResources,
    ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'],
    `${path}.resourcePlacements`,
  );

  const loadout = expectRecord(plan.loadout, `${path}.loadout`);
  expectExactKeys(
    loadout,
    [
      'weaponKey',
      'aspectKey',
      'manualArcanaKeys',
      'fearRanks',
      'startingKeepsakeKey',
      'keepsakeEquipResults',
      ...(loadout.aspectHexTree === undefined ? [] : ['aspectHexTree']),
    ],
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
  const grasp = assessStartingArcanaGrasp(catalog, canonicalManualArcanaKeys, fearRanks);
  if (!grasp.legal) {
    fail(
      `${path}.loadout.manualArcanaKeys`,
      `cost ${grasp.cost} exceeds starting Grasp capacity ${grasp.capacity}`,
    );
  }

  const isSeleneAspect =
    catalog.aspects.byKey[aspectKey]?.startingTrait?.traitKey === 'SpellMoonBeamTrait';
  const hasAspectHexTree = 'aspectHexTree' in loadout;
  const aspectHexTree = isSeleneAspect
    ? hasAspectHexTree
      ? decodeHexTree(
          loadout.aspectHexTree,
          catalog,
          'SpellMoonBeamTrait',
          `${path}.loadout.aspectHexTree`,
        )
      : fail(`${path}.loadout.aspectHexTree`, 'is required for Aspect of Selene')
    : hasAspectHexTree
      ? fail(`${path}.loadout.aspectHexTree`, 'is supported only for Aspect of Selene')
      : undefined;

  const rawBiomes = expectArray(plan.biomes, `${path}.biomes`);
  if (rawBiomes.length > route.biomeKeys.length) {
    fail(`${path}.biomes`, `exceeds the ${route.biomeKeys.length}-biome route`);
  }

  const biomes = rawBiomes.map((biome, index) => {
    const expectedBiomeKey = route.biomeKeys[index];
    if (expectedBiomeKey === undefined) {
      fail(`${path}.biomes[${index}]`, 'has no matching route biome');
    }
    return decodeBiomePlan(biome, `${path}.biomes[${index}]`, routeKey, expectedBiomeKey, catalog);
  });
  const resourcePlacements = Object.freeze(
    Object.fromEntries(
      (['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const).map((family) => {
        const value = rawResources[family];
        if (value === null) return [family, null];
        const placement = expectRecord(value, `${path}.resourcePlacements.${family}`);
        expectExactKeys(
          placement,
          ['biomeKey', 'occurrenceId'],
          `${path}.resourcePlacements.${family}`,
        );
        const biomeKey = expectString(
          placement.biomeKey,
          `${path}.resourcePlacements.${family}.biomeKey`,
        );
        const occurrenceId = expectString(
          placement.occurrenceId,
          `${path}.resourcePlacements.${family}.occurrenceId`,
        ) as import('./model').OccurrenceId;
        const biome = biomes.find((candidate) => candidate.biomeKey === biomeKey);
        if (
          biome === undefined ||
          !(biome.topology?.occurrences ?? []).some(
            (candidate) => candidate.occurrenceId === occurrenceId,
          )
        )
          fail(`${path}.resourcePlacements.${family}`, 'must target an existing occurrence');
        return [family, Object.freeze({ biomeKey, occurrenceId })];
      }),
    ) as import('./model').ResourcePlacements,
  );

  return Object.freeze({
    routeKey,
    resourcePlacements,
    loadout: Object.freeze({
      weaponKey,
      aspectKey,
      manualArcanaKeys: Object.freeze(canonicalManualArcanaKeys),
      fearRanks: Object.freeze(fearRanks),
      startingKeepsakeKey,
      ...(loadout.keepsakeEquipResults === undefined
        ? {}
        : {
            keepsakeEquipResults: decodeKeepsakeEquipResults(
              loadout.keepsakeEquipResults,
              `${path}.loadout.keepsakeEquipResults`,
              catalog,
            ),
          }),
      ...(aspectHexTree === undefined ? {} : { aspectHexTree }),
    }),
    biomes: Object.freeze(biomes),
  });
}

export function decodeProjectDocument(value: unknown, catalog: Catalog): ProjectDocument {
  const document = expectRecord(value, '$');
  expectExactKeys(document, ['schemaVersion', 'projectId', 'catalogVersion', 'routes'], '$');

  if (document.schemaVersion !== PROJECT_DOCUMENT_SCHEMA_VERSION) {
    fail(
      '$.schemaVersion',
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received ${String(document.schemaVersion)}`,
    );
  }

  const projectId = expectNonBlankString(document.projectId, '$.projectId');
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
