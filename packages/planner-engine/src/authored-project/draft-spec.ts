import type { Catalog } from '../catalog-schema';
import type { AuthoredDraftSpec } from './model';

/** A new route's draft settings: nothing selected and the first seed. */
export const EMPTY_DRAFT_SPEC: AuthoredDraftSpec = Object.freeze({
  godKeys: Object.freeze([]),
  storyNpcByBiome: Object.freeze({}),
  fieldNpcsByBiome: Object.freeze({}),
  basketByGiver: Object.freeze({}),
  rackKeepsakeByBiome: Object.freeze({}),
  seed: 1,
});

/** The largest seed; the generator reads it as an unsigned 32-bit value. */
export const MAX_DRAFT_SEED = 0xffff_ffff;

/** A whole number from `min` to `max`, in steps of `step` when given. */
export interface IntegerDraftOptionDeclaration {
  readonly kind: 'integer';
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly default: number;
  /** The default moves with the loadout, so a stored value is absolute and kept on decode. */
  readonly contextualDefault?: true;
  readonly tag: number;
}

/** Off by default; stored as `true` only when on. */
export interface FlagDraftOptionDeclaration {
  readonly kind: 'flag';
  readonly tag: number;
}

/** One of `choices`; share codes carry its index, so choices only append. */
export interface ChoiceDraftOptionDeclaration {
  readonly kind: 'choice';
  readonly choices: readonly string[];
  readonly default: string;
  readonly tag: number;
}

/** A whole number per biome; each biome's default comes from `defaultDraftGodBoons`. */
export interface PerBiomeDraftOptionDeclaration {
  readonly kind: 'perBiome';
  readonly min: number;
  readonly max: number;
  readonly tag: number;
}

/**
 * An ordered subset of `choices`, empty by default, each with an optional amount in its range;
 * share codes carry indexes, so choices only append.
 */
export interface RankingDraftOptionDeclaration {
  readonly kind: 'ranking';
  readonly choices: readonly string[];
  readonly amount: { readonly min: number; readonly max: number };
  readonly tag: number;
}

export type DraftOptionDeclaration =
  | IntegerDraftOptionDeclaration
  | FlagDraftOptionDeclaration
  | ChoiceDraftOptionDeclaration
  | PerBiomeDraftOptionDeclaration
  | RankingDraftOptionDeclaration;

type DraftWorldKey =
  | 'godKeys'
  | 'storyNpcByBiome'
  | 'fieldNpcsByBiome'
  | 'basketByGiver'
  | 'rackKeepsakeByBiome'
  | 'seed';

/** Every optional spec field: the Advanced options, saved only when they differ from defaults. */
export type DraftOptionKey = Exclude<keyof AuthoredDraftSpec, DraftWorldKey>;

/** The Advanced options in saved key order. A tag names the option in a share code; never reuse one. */
export const DRAFT_OPTIONS = deepFreeze({
  preferMidshops: { kind: 'flag', tag: 0 },
  pursueTartarusGoal: { kind: 'flag', tag: 1 },
  godBoonsByBiome: { kind: 'perBiome', min: 0, max: 10, tag: 2 },
  // Ten is past any god's useful core and other boons; under Denial the default is 4.
  perGodCap: { kind: 'integer', min: 1, max: 10, default: 5, contextualDefault: true, tag: 3 },
  roomForcing: {
    kind: 'choice',
    choices: ['deadline', 'softened', 'game'],
    default: 'softened',
    tag: 4,
  },
  // Shop god boon purchases per planned biome; 0 never buys a god boon.
  purchasesPerBiome: { kind: 'integer', min: 0, max: 4, default: 2, tag: 5 },
  // Further attempts per biome after its first success.
  retriesPerBiome: { kind: 'integer', min: 0, max: 10, default: 3, tag: 6 },
  // Percent chance a room rolls a resource point.
  resourceRoomChance: { kind: 'integer', min: 0, max: 50, step: 5, default: 10, tag: 7 },
  // Filler kinds favoured at doors and bought with spare Shop purchases, highest first, each
  // until its pickups per run reach its amount.
  fillerPriority: {
    kind: 'ranking',
    choices: ['maxHealth', 'maxMagick', 'gold', 'pom'],
    amount: { min: 1, max: 10 },
    tag: 8,
  },
} as const satisfies { readonly [K in DraftOptionKey]: DraftOptionDeclaration });

export const DRAFT_OPTION_KEYS = Object.freeze(Object.keys(DRAFT_OPTIONS) as DraftOptionKey[]);

function deepFreeze<T extends object>(value: T): T {
  for (const entry of Object.values(value))
    if (typeof entry === 'object' && entry !== null) deepFreeze(entry);
  return Object.freeze(value);
}

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

/** The options a single setter edits; `godBoonsByBiome` is set per biome. */
export type ScalarDraftOptionKey = Exclude<DraftOptionKey, 'godBoonsByBiome'>;

/** A flag is set on or off; other options take their stored value. */
export type DraftOptionValue<K extends ScalarDraftOptionKey> =
  (typeof DRAFT_OPTIONS)[K] extends FlagDraftOptionDeclaration
    ? boolean
    : NonNullable<AuthoredDraftSpec[K]>;

function clampToStep(
  value: number,
  range: { readonly min: number; readonly max: number; readonly step?: number },
): number {
  const step = range.step ?? 1;
  return Math.min(Math.max(Math.round(value / step) * step, range.min), range.max);
}

/** An option's value as saved, or undefined for a value of the wrong type or an off flag. */
function normalizedOption(
  declaration: Exclude<DraftOptionDeclaration, PerBiomeDraftOptionDeclaration>,
  value: unknown,
): unknown {
  switch (declaration.kind) {
    case 'flag':
      return value === true ? true : undefined;
    case 'integer':
      return typeof value === 'number' && Number.isFinite(value)
        ? clampToStep(value, declaration)
        : undefined;
    case 'choice':
      return typeof value === 'string' && declaration.choices.includes(value) ? value : undefined;
    case 'ranking': {
      const ranked = rankedEntries(value, declaration);
      return ranked.length === 0 ? undefined : ranked;
    }
  }
}

/**
 * Known choices in order, each at its first occurrence; a bare choice is an entry without an
 * amount, and an amount that is no whole number drops while one out of range clamps.
 */
function rankedEntries(
  value: unknown,
  declaration: RankingDraftOptionDeclaration,
): readonly { readonly kind: string; readonly amount?: number }[] {
  const seen = new Set<string>();
  return Object.freeze(
    asArray(value).flatMap((entry) => {
      const raw = typeof entry === 'string' ? { kind: entry } : asRecord(entry);
      const kind = raw.kind;
      if (typeof kind !== 'string' || !declaration.choices.includes(kind) || seen.has(kind))
        return [];
      seen.add(kind);
      const amount = Number.isInteger(raw.amount)
        ? clampToStep(raw.amount as number, declaration.amount)
        : undefined;
      return [Object.freeze(amount === undefined ? { kind } : { kind, amount })];
    }),
  );
}

function withoutKey(draft: AuthoredDraftSpec, key: DraftOptionKey): AuthoredDraftSpec {
  const { [key]: _old, ...rest } = draft;
  void _old;
  return rest;
}

/**
 * Sets one option, clamped to its range and steps; a value equal to the default is not stored.
 * `defaultValue` overrides a contextual default (the per-god cap is 4 under Denial).
 */
export function withDraftOption<K extends ScalarDraftOptionKey>(
  draft: AuthoredDraftSpec,
  key: K,
  value: DraftOptionValue<K>,
  defaultValue?: DraftOptionValue<K>,
): AuthoredDraftSpec {
  const declaration: Exclude<DraftOptionDeclaration, PerBiomeDraftOptionDeclaration> =
    DRAFT_OPTIONS[key];
  const stored = normalizedOption(declaration, value);
  const rest = withoutKey(draft, key);
  const unstored =
    defaultValue ??
    (declaration.kind === 'flag' || declaration.kind === 'ranking'
      ? undefined
      : declaration.default);
  return stored === undefined || stored === unstored ? rest : { ...rest, [key]: stored };
}

/** Sets one biome's planned god boons, clamped; its biome's default is not stored. */
export function withDraftGodBoons(
  draft: AuthoredDraftSpec,
  routeKey: string,
  biomeKey: string,
  value: number,
): AuthoredDraftSpec {
  const { [biomeKey]: _previous, ...others } = draft.godBoonsByBiome ?? {};
  void _previous;
  const clamped = clampToStep(value, DRAFT_OPTIONS.godBoonsByBiome);
  const godBoonsByBiome =
    clamped === defaultDraftGodBoons(routeKey, biomeKey)
      ? others
      : { ...others, [biomeKey]: clamped };
  const rest = withoutKey(draft, 'godBoonsByBiome');
  return Object.keys(godBoonsByBiome).length === 0 ? rest : { ...rest, godBoonsByBiome };
}

/** Whether any Advanced option differs from its default; a default is never stored. */
export function draftAdvancedChanged(draft: AuthoredDraftSpec): boolean {
  return DRAFT_OPTION_KEYS.some((key) => draft[key] !== undefined);
}

/** Every Advanced option back to its default in one edit. */
export function withDraftAdvancedDefaults(draft: AuthoredDraftSpec): AuthoredDraftSpec {
  return DRAFT_OPTION_KEYS.reduce(withoutKey, draft);
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

const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Known string keys in order, each at its first occurrence. */
function knownKeys(value: unknown, known: (key: string) => boolean): readonly string[] {
  return Object.freeze([
    ...new Set(
      asArray(value).filter((key): key is string => typeof key === 'string' && known(key)),
    ),
  ]);
}

/** Entries under catalog biomes, in catalog biome order; an entry that decodes to undefined drops. */
function biomeRecord<T>(
  value: unknown,
  catalog: Catalog,
  decode: (entry: unknown, biomeKey: string) => T | undefined,
): Readonly<Record<string, T>> {
  const record = asRecord(value);
  return Object.freeze(
    Object.fromEntries(
      catalog.biomes.values.flatMap((biome) => {
        if (!Object.hasOwn(record, biome.key)) return [];
        const decoded = decode(record[biome.key], biome.key);
        return decoded === undefined ? [] : [[biome.key, decoded]];
      }),
    ),
  );
}

const knownKey = (known: (key: string) => boolean) => (entry: unknown) =>
  typeof entry === 'string' && known(entry) ? entry : undefined;

/**
 * Tolerant: the spec is a recipe, not plan legality. Unknown keys, references and biomes drop,
 * duplicates keep their first occurrence, a value of the wrong type takes its default, a number
 * clamps to its range and steps, and a value equal to its default is not stored. Biomes off the
 * itinerary are kept.
 */
export function decodeDraftSpec(
  value: unknown,
  catalog: Catalog,
  routeKey: string,
): AuthoredDraftSpec {
  const raw = asRecord(value);
  const keys = draftSpecCatalogKeys(catalog);
  const godKeys = new Set(keys.godKeys);
  const storyNpcKeys = new Set(keys.storyNpcKeys);
  const fieldNpcKeys = new Set(keys.fieldNpcKeys);
  const seed =
    Number.isInteger(raw.seed) &&
    (raw.seed as number) >= 0 &&
    (raw.seed as number) <= MAX_DRAFT_SEED
      ? (raw.seed as number)
      : EMPTY_DRAFT_SPEC.seed;
  const options = Object.fromEntries(
    DRAFT_OPTION_KEYS.flatMap((key) => {
      const declaration: DraftOptionDeclaration = DRAFT_OPTIONS[key];
      const stored =
        declaration.kind === 'perBiome'
          ? godBoonOverrides(raw[key], declaration, catalog, routeKey)
          : normalizedOption(declaration, raw[key]);
      const defaultValue =
        declaration.kind === 'choice' ||
        (declaration.kind === 'integer' && declaration.contextualDefault !== true)
          ? declaration.default
          : undefined;
      return stored === undefined || stored === defaultValue ? [] : [[key, stored]];
    }),
  );
  const pool = knownKeys(raw.godKeys, (key) => godKeys.has(key));
  return Object.freeze({
    godKeys: pool,
    storyNpcByBiome: biomeRecord(
      raw.storyNpcByBiome,
      catalog,
      knownKey((key) => storyNpcKeys.has(key)),
    ),
    fieldNpcsByBiome: biomeRecord(raw.fieldNpcsByBiome, catalog, (entry) =>
      Array.isArray(entry) ? knownKeys(entry, (key) => fieldNpcKeys.has(key)) : undefined,
    ),
    basketByGiver: basketByGiver(raw.basketByGiver, catalog, pool),
    rackKeepsakeByBiome: biomeRecord(
      raw.rackKeepsakeByBiome,
      catalog,
      knownKey((key) => catalog.keepsakes.byKey[key] !== undefined),
    ),
    seed,
    ...options,
  });
}

/**
 * Each known giver's list of traits it offers, in catalog giver order; a trait listed twice keeps
 * its first list, pool gods in pool order first, and an empty list drops.
 */
function basketByGiver(
  value: unknown,
  catalog: Catalog,
  pool: readonly string[],
): Readonly<Record<string, readonly string[]>> {
  const record = asRecord(value);
  const givers = catalog.traitGivers.values.filter((giver) => Object.hasOwn(record, giver.key));
  const precedence = [
    ...pool.flatMap((key) => givers.filter((giver) => giver.key === key)),
    ...givers.filter((giver) => !pool.includes(giver.key)),
  ];
  const taken = new Set<string>();
  const lists = new Map<string, readonly string[]>();
  for (const giver of precedence) {
    const traitKeys = knownKeys(
      record[giver.key],
      (key) => giver.traitKeys.includes(key) && !taken.has(key),
    );
    for (const key of traitKeys) taken.add(key);
    if (traitKeys.length > 0) lists.set(giver.key, traitKeys);
  }
  return Object.freeze(
    Object.fromEntries(
      givers.flatMap((giver) => {
        const traitKeys = lists.get(giver.key);
        return traitKeys === undefined ? [] : [[giver.key, traitKeys]];
      }),
    ),
  );
}

/** Planned god boons that differ from their biome's default, or undefined when none do. */
function godBoonOverrides(
  value: unknown,
  declaration: PerBiomeDraftOptionDeclaration,
  catalog: Catalog,
  routeKey: string,
): Readonly<Record<string, number>> | undefined {
  const overrides = biomeRecord(value, catalog, (entry, biomeKey) => {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) return undefined;
    const count = clampToStep(entry, declaration);
    return count === defaultDraftGodBoons(routeKey, biomeKey) ? undefined : count;
  });
  return Object.keys(overrides).length === 0 ? undefined : overrides;
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
  const same = (a: unknown, b: unknown) => a === b;
  return (
    left.seed === right.seed &&
    DRAFT_OPTION_KEYS.every((key) => {
      const kind = DRAFT_OPTIONS[key].kind;
      if (kind === 'perBiome') return sameRecord(asRecord(left[key]), asRecord(right[key]), same);
      if (kind === 'ranking') {
        const ranks = (spec: AuthoredDraftSpec) =>
          (spec.fillerPriority ?? []).map((entry) => `${entry.kind}:${entry.amount ?? ''}`);
        return sameKeys(ranks(left), ranks(right));
      }
      return left[key] === right[key];
    }) &&
    sameKeys(left.godKeys, right.godKeys) &&
    sameRecord(left.basketByGiver, right.basketByGiver, sameKeys) &&
    sameRecord(left.storyNpcByBiome, right.storyNpcByBiome, same) &&
    sameRecord(left.fieldNpcsByBiome, right.fieldNpcsByBiome, sameKeys) &&
    sameRecord(left.rackKeepsakeByBiome, right.rackKeepsakeByBiome, same)
  );
}
