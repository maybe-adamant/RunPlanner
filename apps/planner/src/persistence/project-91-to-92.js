export const SOURCE_SCHEMA_VERSION = 91;
export const OUTPUT_SCHEMA_VERSION = 92;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';

// ChaosWeaponUpgrade's single acquisition role carries the Anvil pickup effect.
const ANVIL_REWARD_TYPE = 'ChaosWeaponUpgrade';
const ANVIL_ROLE = 'self';

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function isAnvilReward(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.offer?.rewardType === ANVIL_REWARD_TYPE &&
    Object.hasOwn(value, 'dispositionByAcquisitionRole')
  );
}

/** Rebuilds the reward with its Anvil result keyed by role, before its dispositions. */
function withAnvilResult(reward, result) {
  const { dispositionByAcquisitionRole, ...rest } = reward;
  delete rest.anvilResultsByAcquisitionRole;
  return {
    ...rest,
    anvilResultsByAcquisitionRole: { [ANVIL_ROLE]: result },
    dispositionByAcquisitionRole,
  };
}

/** Moves a Shop slot's Anvil result onto the reward it settles. */
function moveShopAnvilResult(offer, label) {
  if (offer === null || typeof offer !== 'object' || !Object.hasOwn(offer, 'anvilResult')) return;
  const { anvilResult } = offer;
  delete offer.anvilResult;
  if (!isAnvilReward(offer.reward))
    throw new Error(`${label}.anvilResult requires an Anvil reward`);
  offer.reward = withAnvilResult(offer.reward, anvilResult);
}

/** Every other reward carrying an Anvil, such as a Gold Gold Gold duplicate, starts unauthored. */
function addMissingAnvilResults(value) {
  if (Array.isArray(value)) return value.map(addMissingAnvilResults);
  if (value === null || typeof value !== 'object') return value;
  const next = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, addMissingAnvilResults(child)]),
  );
  return isAnvilReward(next) && !Object.hasOwn(next, 'anvilResultsByAcquisitionRole')
    ? withAnvilResult(next, null)
    : next;
}

/** Browser-safe schema transform; the CLI supplies only file I/O. */
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 91 -> 92 migration expects schema 91, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 91 -> 92 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = JSON.parse(JSON.stringify(source));
  const route = record(migrated.route, 'route');
  for (const biome of route.biomes ?? [])
    for (const occurrence of biome.topology?.occurrences ?? []) {
      const shop = occurrence.state?.shop;
      if (shop === undefined) continue;
      for (const [offerKey, offer] of Object.entries(shop.offers ?? {}))
        moveShopAnvilResult(offer, `${occurrence.occurrenceId}.shop.offers.${offerKey}`);
      moveShopAnvilResult(
        shop.travelDealRefill,
        `${occurrence.occurrenceId}.shop.travelDealRefill`,
      );
    }
  migrated.route = addMissingAnvilResults(route);
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}
