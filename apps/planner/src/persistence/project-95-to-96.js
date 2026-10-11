export const SOURCE_SCHEMA_VERSION = 95;
export const OUTPUT_SCHEMA_VERSION = 96;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

// The N Hub's completed exit and its fixed completion rooms, as the catalog declares them.
const HUB_EXIT_KEY = 'preboss';
const HUB_PREBOSS_GAME_NAME = 'N_PreBoss01';
const HUB_BOSS_GAME_NAME = 'N_Boss01';
const HUB_RIVALS_BOSS_GAME_NAME = 'N_Boss02';
const POSTBOSS_GAME_NAMES_BY_ROUTE = Object.freeze({
  Surface: ['N_PostBoss01', 'O_PostBoss01', 'P_PostBoss01', null],
  Dream: ['Dream_PostBoss01', 'Dream_PostBoss02', 'Dream_PostBoss03', null],
});

const encounters = () => ({
  encounterKeyByPhase: {},
  figLeafSkipByPhase: { Encounter: false },
  gorgonResultByPhase: {},
});
const emptyShopOffer = () => ({ optionKey: null, reward: null });

// Declaration-owned default occurrences, exactly as the engine creates them.
const DEFAULT_OCCURRENCES = Object.freeze({
  N_PreBoss01: () => ({
    gameName: 'N_PreBoss01',
    state: {
      kind: 'shop',
      shop: {
        profileKey: 'WorldShop',
        offers: {
          Boon: emptyShopOffer(),
          MajorNonBoon: emptyShopOffer(),
          Minor: emptyShopOffer(),
          infernalContractReward: emptyShopOffer(),
        },
      },
    },
    acquisitionSites: { roomExit: {} },
    encounters: encounters(),
    roomActions: { order: [] },
    additionalExits: [],
  }),
  N_Boss01: () => boss('N_Boss01'),
  N_Boss02: () => boss('N_Boss02'),
  N_PostBoss01: () => ({
    ...postboss('N_PostBoss01'),
    hermesShrine: { offerBySlot: { first: null, secondLeft: null, secondRight: null } },
  }),
  Dream_PostBoss01: () => dreamPostboss('Dream_PostBoss01'),
  Dream_PostBoss02: () => dreamPostboss('Dream_PostBoss02'),
  Dream_PostBoss03: () => dreamPostboss('Dream_PostBoss03'),
});

function boss(gameName) {
  return {
    gameName,
    state: { kind: 'none' },
    encounters: encounters(),
    roomActions: { order: [{ kind: 'collectRequiredReward' }] },
    additionalExits: [],
  };
}

function postboss(gameName) {
  return {
    gameName,
    state: { kind: 'none' },
    encounters: encounters(),
    roomActions: { order: [{ kind: 'useFountain' }] },
    additionalExits: [],
  };
}

function dreamPostboss(gameName) {
  return {
    ...postboss(gameName),
    stygianWell: {
      interacted: false,
      offerKeyBySlot: { healing: null, secondLeft: null, secondRight: null },
    },
  };
}

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function list(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function occurrence(gameName, occurrenceId, label) {
  const create = DEFAULT_OCCURRENCES[gameName];
  if (create === undefined) throw new Error(`${label} has no default ${gameName} occurrence`);
  return { occurrenceId, ...create() };
}

// A new biome-scoped identity that no existing occurrence uses, with its chain.
function prebossOccurrenceId(biomeKey, topology) {
  const used = new Set(topology.occurrences.map((entry) => entry.occurrenceId));
  for (let suffix = 1; ; suffix += 1) {
    const id = suffix === 1 ? `${biomeKey}:preboss` : `${biomeKey}:preboss-${suffix}`;
    if (![id, `${id}:boss`, `${id}:postboss`].some((candidate) => used.has(candidate))) return id;
  }
}

function addCompletedHubChain(route, biome, label) {
  const topology = biome.topology;
  if (topology === null || topology === undefined) return;
  record(topology, `${label}.topology`);
  const decisions = list(topology.decisions, `${label}.topology.decisions`);
  list(topology.occurrences, `${label}.topology.occurrences`);
  const fixedRoomLinks = list(topology.fixedRoomLinks, `${label}.topology.fixedRoomLinks`);
  for (const hub of decisions.filter((decision) => decision?.kind === 'hub')) {
    const owned = decisions.some(
      (decision) =>
        decision?.kind === 'exit' &&
        decision.source?.kind === 'hubDecision' &&
        decision.source.decisionKey === hub.hubKey,
    );
    if (owned) continue;
    if (fixedRoomLinks.length !== 0)
      throw new Error(`${label} has fixed room links without a selected Preboss`);
    const itinerary = list(route.itineraryBiomeKeys, 'route.itineraryBiomeKeys');
    const ordinal = itinerary.indexOf(biome.biomeKey) + 1;
    const postbossNames = POSTBOSS_GAME_NAMES_BY_ROUTE[route.routeKey];
    if (ordinal < 1 || postbossNames === undefined)
      throw new Error(`${label} has no Hub completion for route ${String(route.routeKey)}`);
    const postbossGameName = ordinal === itinerary.length ? null : postbossNames[ordinal - 1];
    const rivalsRank = route.loadout?.fearRanks?.BossDifficultyShrineUpgrade ?? 0;
    const bossGameName = rivalsRank >= ordinal ? HUB_RIVALS_BOSS_GAME_NAME : HUB_BOSS_GAME_NAME;
    const prebossId = prebossOccurrenceId(biome.biomeKey, topology);
    const bossId = `${prebossId}:boss`;
    const postbossId = `${prebossId}:postboss`;
    topology.occurrences.push(occurrence(HUB_PREBOSS_GAME_NAME, prebossId, label));
    decisions.push({
      kind: 'exit',
      source: { kind: 'hubDecision', decisionKey: hub.hubKey },
      normal: {
        kind: 'batch',
        rewardStore: { kind: 'none' },
        batchState: null,
        targets: [{ exitKey: HUB_EXIT_KEY, occurrenceId: prebossId }],
      },
      selection: { kind: 'derived' },
    });
    topology.occurrences.push(occurrence(bossGameName, bossId, label));
    fixedRoomLinks.push({ sourceOccurrenceId: prebossId, targetOccurrenceId: bossId });
    if (postbossGameName !== null) {
      topology.occurrences.push(occurrence(postbossGameName, postbossId, label));
      fixedRoomLinks.push({ sourceOccurrenceId: bossId, targetOccurrenceId: postbossId });
    }
  }
}

/**
 * Browser-safe schema transform; the CLI supplies only file I/O. Every Hub owns
 * its completed-Hub Preboss chain; a Hub without one gains it with default room
 * state and new identities, and every existing identity is kept.
 */
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 95 -> 96 migration expects schema 95, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 95 -> 96 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = JSON.parse(JSON.stringify(source));
  const route = record(migrated.route, 'route');
  list(route.biomes, 'route.biomes').forEach((biome, index) =>
    addCompletedHubChain(route, record(biome, `route.biomes[${index}]`), `route.biomes[${index}]`),
  );
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}
