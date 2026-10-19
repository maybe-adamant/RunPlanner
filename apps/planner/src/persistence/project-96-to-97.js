export const SOURCE_SCHEMA_VERSION = 96;
export const OUTPUT_SCHEMA_VERSION = 97;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

// Postboss rooms with a keepsake rack, and the routes on which each has none, as the catalog declares them.
const RACK_EXCLUDED_ROUTES = Object.freeze({
  F_PostBoss01: ['FreshFile'],
  G_PostBoss01: ['FreshFile'],
  H_PostBoss01: ['FreshFile'],
  N_PostBoss01: [],
  O_PostBoss01: [],
  P_PostBoss01: [],
  Dream_PostBoss01: [],
  Dream_PostBoss02: [],
  Dream_PostBoss03: [],
});

const EMPTY_DRAFT = () => ({
  godKeys: [],
  storyNpcByBiome: {},
  fieldNpcsByBiome: {},
  basketTraitKeys: [],
  rackKeepsakeByBiome: {},
  seed: 1,
});

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function list(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

// Every rack is present and ranked; an unchanged rack has a null keepsake.
function completeRack(occurrence, routeKey, label) {
  const excluded = RACK_EXCLUDED_ROUTES[occurrence.gameName];
  if (excluded === undefined) return;
  const order = list(record(occurrence.roomActions, `${label}.roomActions`).order, label);
  const rackActions = (reference) => reference?.kind === 'interactKeepsakeRack';
  if (excluded.includes(routeKey)) {
    // A rack retained where the route has none never equipped anything.
    delete occurrence.keepsakeRack;
    occurrence.roomActions.order = order.filter((reference) => !rackActions(reference));
    return;
  }
  if (occurrence.keepsakeRack === undefined) occurrence.keepsakeRack = { keepsakeKey: null };
  if (order.some(rackActions)) return;
  // Right after the fountain, where a new room's rack starts.
  const fountain = order.findIndex((reference) => reference?.kind === 'useFountain');
  order.splice(fountain < 0 ? order.length : fountain + 1, 0, { kind: 'interactKeepsakeRack' });
}

// Browser-safe transform: adds the empty draft, ranks every rack (null when unchanged)
// and moves the Practice start out of the run modifiers.
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 96 -> 97 migration expects schema 96, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 96 -> 97 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = JSON.parse(JSON.stringify(source));
  delete migrated.schemaRevision;
  const route = record(migrated.route, 'route');
  list(route.biomes, 'route.biomes').forEach((biome, biomeIndex) => {
    const topology = record(biome, `route.biomes[${biomeIndex}]`).topology;
    if (topology === null || topology === undefined) return;
    list(topology.occurrences, `route.biomes[${biomeIndex}].topology.occurrences`).forEach(
      (occurrence, index) => {
        const label = `route.biomes[${biomeIndex}].topology.occurrences[${index}]`;
        completeRack(record(occurrence, label), route.routeKey, label);
      },
    );
  });
  const runModifiers = record(route.loadout, 'route.loadout').runModifiers;
  const { biomes, ...head } = route;
  const practiceStart =
    runModifiers !== null && typeof runModifiers === 'object' ? runModifiers.startPoint : undefined;
  if (practiceStart !== undefined) {
    delete runModifiers.startPoint;
    if (Object.keys(runModifiers).length === 0) delete route.loadout.runModifiers;
  }
  migrated.route = {
    ...head,
    ...(practiceStart === undefined ? {} : { practiceStart }),
    draft: EMPTY_DRAFT(),
    biomes,
  };
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}
