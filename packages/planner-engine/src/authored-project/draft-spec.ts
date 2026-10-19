import type { Catalog } from '../catalog-schema';
import type { AuthoredDraftSpec } from './model';
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

/** Strict on keys and catalog references; biomes off the itinerary are kept. */
export function decodeDraftSpec(value: unknown, path: string, catalog: Catalog): AuthoredDraftSpec {
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
    ],
    path,
  );
  // The same catalog facts the draft world reads its gods and NPCs from.
  const godKeys = new Set(
    catalog.traitGivers.values.filter((g) => g.providerKind === 'olympian').map((g) => g.key),
  );
  const storyNpcKeys = new Set(
    catalog.encounterDefinitions.values.flatMap((definition) =>
      definition.kind === 'story' && definition.traitOfferProducer !== undefined
        ? [definition.traitOfferProducer.giverKey]
        : [],
    ),
  );
  const fieldNpcKeys = new Set(
    catalog.encounterDefinitions.values.flatMap((definition) =>
      definition.kind === 'combat' &&
      definition.npcPresentationKey !== undefined &&
      catalog.fieldNpcEncounterKeys.includes(definition.key)
        ? [definition.npcPresentationKey]
        : [],
    ),
  );
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
  });
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
    sameKeys(left.godKeys, right.godKeys) &&
    sameKeys(left.basketTraitKeys, right.basketTraitKeys) &&
    sameRecord(left.storyNpcByBiome, right.storyNpcByBiome, same) &&
    sameRecord(left.fieldNpcsByBiome, right.fieldNpcsByBiome, sameKeys) &&
    sameRecord(left.rackKeepsakeByBiome, right.rackKeepsakeByBiome, same)
  );
}
