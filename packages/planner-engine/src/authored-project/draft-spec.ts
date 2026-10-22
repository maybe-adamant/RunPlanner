import type { Catalog } from '../catalog-schema';
import type { AuthoredDraftSpec, DraftRoomForcing } from './model';
import {
  expectArray,
  expectExactKeys,
  expectNonNegativeInteger,
  expectRecord,
  expectString,
  failProjectDocument as fail,
} from './validation';

/** A new route's draft settings: nothing selected and the first seed. */
export const EMPTY_DRAFT_SPEC: AuthoredDraftSpec = Object.freeze({
  godKeys: Object.freeze([]),
  storyNpcByBiome: Object.freeze({}),
  fieldNpcsByBiome: Object.freeze({}),
  basketTraitKeys: Object.freeze([]),
  rackKeepsakeByBiome: Object.freeze({}),
  seed: 1,
});

/** The largest seed; the generator reads it as an unsigned 32-bit value. */
export const MAX_DRAFT_SEED = 0xffff_ffff;

/** The range of one biome's planned god boons. */
export const DRAFT_GOD_BOONS_RANGE = Object.freeze({ min: 0, max: 10 });
/** The range of the per-god boon cap; ten is past any god's useful core and other boons. */
export const DRAFT_PER_GOD_CAP_RANGE = Object.freeze({ min: 1, max: 10 });
export const DEFAULT_DRAFT_PER_GOD_CAP = 5;

export const DRAFT_ROOM_FORCINGS: readonly DraftRoomForcing[] = Object.freeze([
  'deadline',
  'softened',
  'game',
]);
export const DEFAULT_DRAFT_ROOM_FORCING: DraftRoomForcing = 'softened';
/** Shop god boon purchases per planned biome; 0 never buys a god boon. */
export const DRAFT_PURCHASES_PER_BIOME_RANGE = Object.freeze({ min: 0, max: 4 });
export const DEFAULT_DRAFT_PURCHASES_PER_BIOME = 2;
/** Further attempts per biome after its first success. */
export const DRAFT_RETRIES_PER_BIOME_RANGE = Object.freeze({ min: 0, max: 10 });
export const DEFAULT_DRAFT_RETRIES_PER_BIOME = 3;
/** Percent chance a room rolls a resource point, in steps of five. */
export const DRAFT_RESOURCE_ROOM_CHANCE_RANGE = Object.freeze({ min: 0, max: 50, step: 5 });
export const DEFAULT_DRAFT_RESOURCE_ROOM_CHANCE = 10;

/**
 * Each biome's default planned god boons by biome key: the god boons a draft usually gains there,
 * counting the start boon, Devotion, cages and Shops.
 */
const DEFAULT_DRAFT_GOD_BOONS: Readonly<Record<string, number>> = Object.freeze({
  F: 6,
  G: 2,
  H: 2,
  I: 4,
  N: 6,
  O: 2,
  P: 3,
  Q: 3,
});

/** Routes whose biomes yield differently from the shared biome defaults, by route then biome key. */
const ROUTE_DEFAULT_DRAFT_GOD_BOONS: Readonly<Record<string, Readonly<Record<string, number>>>> =
  Object.freeze({
    FreshFile: Object.freeze({ F: 5, G: 3, H: 3, I: 3 }),
  });

export function defaultDraftGodBoons(routeKey: string, biomeKey: string): number {
  return (
    ROUTE_DEFAULT_DRAFT_GOD_BOONS[routeKey]?.[biomeKey] ?? DEFAULT_DRAFT_GOD_BOONS[biomeKey] ?? 3
  );
}

const clamp = (value: number, range: { readonly min: number; readonly max: number }) =>
  Math.min(Math.max(Math.round(value), range.min), range.max);

/** Sets one biome's planned god boons, clamped; its biome's default is not stored. */
export function withDraftGodBoons(
  draft: AuthoredDraftSpec,
  routeKey: string,
  biomeKey: string,
  value: number,
): AuthoredDraftSpec {
  const { [biomeKey]: _previous, ...others } = draft.godBoonsByBiome ?? {};
  void _previous;
  const clamped = clamp(value, DRAFT_GOD_BOONS_RANGE);
  const godBoonsByBiome =
    clamped === defaultDraftGodBoons(routeKey, biomeKey)
      ? others
      : { ...others, [biomeKey]: clamped };
  const { godBoonsByBiome: _old, ...rest } = draft;
  void _old;
  return Object.keys(godBoonsByBiome).length === 0 ? rest : { ...rest, godBoonsByBiome };
}

/**
 * Sets the per-god cap, clamped; the current default (5, or 4 under Denial) is not stored.
 * A stored value is absolute, so it holds when Denial is toggled later.
 */
export function withDraftPerGodCap(
  draft: AuthoredDraftSpec,
  value: number,
  defaultValue: number = DEFAULT_DRAFT_PER_GOD_CAP,
): AuthoredDraftSpec {
  const { perGodCap: _old, ...rest } = draft;
  void _old;
  const clamped = clamp(value, DRAFT_PER_GOD_CAP_RANGE);
  return clamped === defaultValue ? rest : { ...rest, perGodCap: clamped };
}

/** The Tartarus goal preference is stored only when on. */
export function withDraftPursueTartarusGoal(
  draft: AuthoredDraftSpec,
  on: boolean,
): AuthoredDraftSpec {
  const { pursueTartarusGoal: _pursueTartarusGoal, ...rest } = draft;
  void _pursueTartarusGoal;
  return on ? { ...rest, pursueTartarusGoal: true } : rest;
}

/** The room forcing is stored only when not the softened default. */
export function withDraftRoomForcing(
  draft: AuthoredDraftSpec,
  forcing: DraftRoomForcing,
): AuthoredDraftSpec {
  const { roomForcing: _old, ...rest } = draft;
  void _old;
  return forcing === DEFAULT_DRAFT_ROOM_FORCING ? rest : { ...rest, roomForcing: forcing };
}

/** Sets the Shop purchase pace, clamped; the default is not stored. */
export function withDraftPurchasesPerBiome(
  draft: AuthoredDraftSpec,
  value: number,
): AuthoredDraftSpec {
  const { purchasesPerBiome: _old, ...rest } = draft;
  void _old;
  const clamped = clamp(value, DRAFT_PURCHASES_PER_BIOME_RANGE);
  return clamped === DEFAULT_DRAFT_PURCHASES_PER_BIOME
    ? rest
    : { ...rest, purchasesPerBiome: clamped };
}

/** Sets the retries per biome, clamped; the default is not stored. */
export function withDraftRetriesPerBiome(
  draft: AuthoredDraftSpec,
  value: number,
): AuthoredDraftSpec {
  const { retriesPerBiome: _old, ...rest } = draft;
  void _old;
  const clamped = clamp(value, DRAFT_RETRIES_PER_BIOME_RANGE);
  return clamped === DEFAULT_DRAFT_RETRIES_PER_BIOME ? rest : { ...rest, retriesPerBiome: clamped };
}

/** Sets the resource room chance in percent, clamped to its steps; the default is not stored. */
export function withDraftResourceRoomChance(
  draft: AuthoredDraftSpec,
  value: number,
): AuthoredDraftSpec {
  const { resourceRoomChance: _old, ...rest } = draft;
  void _old;
  const { step } = DRAFT_RESOURCE_ROOM_CHANCE_RANGE;
  const clamped = clamp(Math.round(value / step) * step, DRAFT_RESOURCE_ROOM_CHANCE_RANGE);
  return clamped === DEFAULT_DRAFT_RESOURCE_ROOM_CHANCE
    ? rest
    : { ...rest, resourceRoomChance: clamped };
}

/** The Advanced options: every stored field the Advanced tab sets. */
const ADVANCED_KEYS = [
  'godBoonsByBiome',
  'perGodCap',
  'roomForcing',
  'resourceRoomChance',
  'purchasesPerBiome',
  'retriesPerBiome',
  'preferMidshops',
  'pursueTartarusGoal',
] as const satisfies readonly (keyof AuthoredDraftSpec)[];

/** Whether any Advanced option differs from its default; a default is never stored. */
export function draftAdvancedChanged(draft: AuthoredDraftSpec): boolean {
  return ADVANCED_KEYS.some((key) => draft[key] !== undefined);
}

/** Every Advanced option back to its default in one edit. */
export function withDraftAdvancedDefaults(draft: AuthoredDraftSpec): AuthoredDraftSpec {
  const advanced: ReadonlySet<string> = new Set(ADVANCED_KEYS);
  return Object.fromEntries(
    Object.entries(draft).filter(([key]) => !advanced.has(key)),
  ) as unknown as AuthoredDraftSpec;
}

/** The midshop preference is stored only when on. */
export function withDraftPreferMidshops(draft: AuthoredDraftSpec, on: boolean): AuthoredDraftSpec {
  const { preferMidshops: _preferMidshops, ...rest } = draft;
  void _preferMidshops;
  return on ? { ...rest, preferMidshops: true } : rest;
}

function expectInRange(
  value: unknown,
  path: string,
  range: { readonly min: number; readonly max: number },
): number {
  const number = expectNonNegativeInteger(value, path);
  if (number < range.min || number > range.max)
    fail(path, `must be from ${range.min} to ${range.max}`);
  return number;
}

function distinctKeys(
  value: unknown,
  path: string,
  known: (key: string) => boolean,
  what: string,
): readonly string[] {
  const keys = expectArray(value, path).map((entry, index) => {
    const key = expectString(entry, `${path}[${index}]`);
    if (!known(key)) fail(`${path}[${index}]`, `unknown ${what} ${key}`);
    return key;
  });
  if (new Set(keys).size !== keys.length) fail(path, `duplicates a ${what}`);
  return Object.freeze(keys);
}

function biomeRecord<T>(
  value: unknown,
  path: string,
  catalog: Catalog,
  decode: (entry: unknown, path: string) => T,
): Readonly<Record<string, T>> {
  const record = expectRecord(value, path);
  for (const biomeKey of Object.keys(record))
    if (catalog.biomes.byKey[biomeKey] === undefined)
      fail(`${path}.${biomeKey}`, `unknown biome ${biomeKey}`);
  // Catalog biome order keeps the saved record stable whatever order it was authored in.
  return Object.freeze(
    Object.fromEntries(
      catalog.biomes.values
        .filter((biome) => Object.hasOwn(record, biome.key))
        .map((biome) => [biome.key, decode(record[biome.key], `${path}.${biome.key}`)]),
    ),
  );
}

/** The gods and NPCs a draft spec may name, in catalog order; the draft world reads the same facts. */
export function draftSpecCatalogKeys(catalog: Catalog): {
  readonly godKeys: readonly string[];
  readonly storyNpcKeys: readonly string[];
  readonly fieldNpcKeys: readonly string[];
} {
  const distinct = (keys: readonly string[]) => Object.freeze([...new Set(keys)]);
  return Object.freeze({
    godKeys: distinct(
      catalog.traitGivers.values.filter((g) => g.providerKind === 'olympian').map((g) => g.key),
    ),
    storyNpcKeys: distinct(
      catalog.encounterDefinitions.values.flatMap((definition) =>
        definition.kind === 'story' && definition.traitOfferProducer !== undefined
          ? [definition.traitOfferProducer.giverKey]
          : [],
      ),
    ),
    fieldNpcKeys: distinct(
      catalog.encounterDefinitions.values.flatMap((definition) =>
        definition.kind === 'combat' &&
        definition.npcPresentationKey !== undefined &&
        catalog.fieldNpcEncounterKeys.includes(definition.key)
          ? [definition.npcPresentationKey]
          : [],
      ),
    ),
  });
}

/**
 * Strict on keys and catalog references; biomes off the itinerary are kept, and a planned god
 * boon count equal to its route's default is dropped, as the setter never stores one.
 */
export function decodeDraftSpec(
  value: unknown,
  path: string,
  catalog: Catalog,
  routeKey: string,
): AuthoredDraftSpec {
  const raw = expectRecord(value, path);
  expectExactKeys(
    raw,
    [
      'godKeys',
      'storyNpcByBiome',
      'fieldNpcsByBiome',
      'basketTraitKeys',
      'rackKeepsakeByBiome',
      'seed',
      'preferMidshops',
      'godBoonsByBiome',
      'perGodCap',
      'pursueTartarusGoal',
      'roomForcing',
      'purchasesPerBiome',
      'retriesPerBiome',
      'resourceRoomChance',
    ],
    path,
  );
  for (const flag of ['preferMidshops', 'pursueTartarusGoal'])
    if (Object.hasOwn(raw, flag) && raw[flag] !== true)
      fail(`${path}.${flag}`, 'must be true when present');
  const keys = draftSpecCatalogKeys(catalog);
  const godKeys = new Set(keys.godKeys);
  const storyNpcKeys = new Set(keys.storyNpcKeys);
  const fieldNpcKeys = new Set(keys.fieldNpcKeys);
  const seed = expectNonNegativeInteger(raw.seed, `${path}.seed`);
  if (seed > MAX_DRAFT_SEED) fail(`${path}.seed`, `exceeds ${MAX_DRAFT_SEED}`);
  return Object.freeze({
    godKeys: distinctKeys(raw.godKeys, `${path}.godKeys`, (key) => godKeys.has(key), 'god'),
    storyNpcByBiome: biomeRecord(
      raw.storyNpcByBiome,
      `${path}.storyNpcByBiome`,
      catalog,
      (e, p) => {
        const key = expectString(e, p);
        if (!storyNpcKeys.has(key)) fail(p, `unknown story NPC ${key}`);
        return key;
      },
    ),
    fieldNpcsByBiome: biomeRecord(
      raw.fieldNpcsByBiome,
      `${path}.fieldNpcsByBiome`,
      catalog,
      (e, p) => distinctKeys(e, p, (key) => fieldNpcKeys.has(key), 'field NPC'),
    ),
    basketTraitKeys: distinctKeys(
      raw.basketTraitKeys,
      `${path}.basketTraitKeys`,
      (key) => catalog.traits.byKey[key] !== undefined,
      'trait',
    ),
    rackKeepsakeByBiome: biomeRecord(
      raw.rackKeepsakeByBiome,
      `${path}.rackKeepsakeByBiome`,
      catalog,
      (e, p) => {
        const key = expectString(e, p);
        if (catalog.keepsakes.byKey[key] === undefined) fail(p, `unknown keepsake ${key}`);
        return key;
      },
    ),
    seed,
    ...(raw.preferMidshops === true ? { preferMidshops: true as const } : {}),
    ...(raw.pursueTartarusGoal === true ? { pursueTartarusGoal: true as const } : {}),
    ...godBoonOverrides(raw.godBoonsByBiome, `${path}.godBoonsByBiome`, catalog, routeKey),
    ...(raw.perGodCap === undefined
      ? {}
      : { perGodCap: expectInRange(raw.perGodCap, `${path}.perGodCap`, DRAFT_PER_GOD_CAP_RANGE) }),
    ...nonDefault(
      'roomForcing',
      raw.roomForcing === undefined ? undefined : roomForcing(raw.roomForcing, path),
      DEFAULT_DRAFT_ROOM_FORCING,
    ),
    ...nonDefault(
      'purchasesPerBiome',
      raw.purchasesPerBiome === undefined
        ? undefined
        : expectInRange(
            raw.purchasesPerBiome,
            `${path}.purchasesPerBiome`,
            DRAFT_PURCHASES_PER_BIOME_RANGE,
          ),
      DEFAULT_DRAFT_PURCHASES_PER_BIOME,
    ),
    ...nonDefault(
      'retriesPerBiome',
      raw.retriesPerBiome === undefined
        ? undefined
        : expectInRange(
            raw.retriesPerBiome,
            `${path}.retriesPerBiome`,
            DRAFT_RETRIES_PER_BIOME_RANGE,
          ),
      DEFAULT_DRAFT_RETRIES_PER_BIOME,
    ),
    ...nonDefault(
      'resourceRoomChance',
      raw.resourceRoomChance === undefined
        ? undefined
        : resourceRoomChance(raw.resourceRoomChance, `${path}.resourceRoomChance`),
      DEFAULT_DRAFT_RESOURCE_ROOM_CHANCE,
    ),
  });
}

/** A decoded option equal to its default is dropped, as its setter never stores one. */
function nonDefault<K extends string, T>(
  key: K,
  value: T | undefined,
  defaultValue: T,
): { readonly [P in K]?: T } {
  return (value === undefined || value === defaultValue ? {} : { [key]: value }) as {
    readonly [P in K]?: T;
  };
}

function roomForcing(value: unknown, path: string): DraftRoomForcing {
  const forcing = expectString(value, `${path}.roomForcing`);
  if (!(DRAFT_ROOM_FORCINGS as readonly string[]).includes(forcing))
    fail(`${path}.roomForcing`, `unknown room forcing ${forcing}`);
  return forcing as DraftRoomForcing;
}

function resourceRoomChance(value: unknown, path: string): number {
  const chance = expectInRange(value, path, DRAFT_RESOURCE_ROOM_CHANCE_RANGE);
  if (chance % DRAFT_RESOURCE_ROOM_CHANCE_RANGE.step !== 0)
    fail(path, `must be a multiple of ${DRAFT_RESOURCE_ROOM_CHANCE_RANGE.step}`);
  return chance;
}

function godBoonOverrides(
  value: unknown,
  path: string,
  catalog: Catalog,
  routeKey: string,
): { readonly godBoonsByBiome?: Readonly<Record<string, number>> } {
  if (value === undefined) return {};
  const decoded = biomeRecord(value, path, catalog, (e, p) =>
    expectInRange(e, p, DRAFT_GOD_BOONS_RANGE),
  );
  const overrides = Object.entries(decoded).filter(
    ([biomeKey, count]) => count !== defaultDraftGodBoons(routeKey, biomeKey),
  );
  return overrides.length === 0
    ? {}
    : { godBoonsByBiome: Object.freeze(Object.fromEntries(overrides)) };
}

function sameKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function sameRecord<T>(
  left: Readonly<Record<string, T>>,
  right: Readonly<Record<string, T>>,
  same: (left: T, right: T) => boolean,
): boolean {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && same(left[key]!, right[key]!))
  );
}

/** Structural equality; record key order is not meaning. */
export function sameDraftSpec(left: AuthoredDraftSpec, right: AuthoredDraftSpec): boolean {
  const same = (a: string, b: string) => a === b;
  return (
    left.seed === right.seed &&
    left.preferMidshops === right.preferMidshops &&
    left.pursueTartarusGoal === right.pursueTartarusGoal &&
    left.perGodCap === right.perGodCap &&
    left.roomForcing === right.roomForcing &&
    left.purchasesPerBiome === right.purchasesPerBiome &&
    left.retriesPerBiome === right.retriesPerBiome &&
    left.resourceRoomChance === right.resourceRoomChance &&
    sameRecord(left.godBoonsByBiome ?? {}, right.godBoonsByBiome ?? {}, (a, b) => a === b) &&
    sameKeys(left.godKeys, right.godKeys) &&
    sameKeys(left.basketTraitKeys, right.basketTraitKeys) &&
    sameRecord(left.storyNpcByBiome, right.storyNpcByBiome, same) &&
    sameRecord(left.fieldNpcsByBiome, right.fieldNpcsByBiome, sameKeys) &&
    sameRecord(left.rackKeepsakeByBiome, right.rackKeepsakeByBiome, same)
  );
}
