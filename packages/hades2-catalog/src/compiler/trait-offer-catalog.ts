import type {
  CatalogCollection,
  EchoLastRunBoonCatalog,
  TraitCatalog,
  TraitDeclaration,
  TraitGiverDeclaration,
  TraitOfferContextDeclaration,
} from '@run-planner/engine/catalog-schema';

import {
  createCollection,
  freezeUniqueStrings,
  requireArray,
  requireNonEmpty,
  requireObject,
} from './common';
import { fail } from './errors';
import type { RawTraitCatalogInput } from '../declarations/traits';

const RARITIES = ['Common', 'Rare', 'Epic', 'Heroic', 'Legendary', 'Duo'] as const;
const CONTEXTS = ['devotionNoDuo', 'blockGiftBoons', 'circeRemovableFearVow'] as const;
const BOON_RARITY_PROVIDER_KINDS = ['olympian', 'hermes'] as const;
const BOON_RARITY_CHECKS = ['Rare', 'Epic', 'Duo', 'Legendary'] as const;

function closedValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    fail(path, `must be one of ${values.join(', ')}`);
  }
  return value as Values[number];
}

export function normalizeBoonRarityBases(
  raw: RawTraitCatalogInput['boonRarityBases'],
): TraitCatalog['boonRarityBases'] {
  const bases = requireObject(raw, 'boonRarityBases');
  if (
    Object.keys(bases).length !== BOON_RARITY_PROVIDER_KINDS.length ||
    BOON_RARITY_PROVIDER_KINDS.some((providerKind) => bases[providerKind] === undefined)
  )
    fail('boonRarityBases', 'must declare exactly olympian and hermes provider bases');
  const normalized = Object.fromEntries(
    BOON_RARITY_PROVIDER_KINDS.map((providerKind) => {
      const value = requireObject(bases[providerKind], `boonRarityBases.${providerKind}`);
      if (
        Object.keys(value).length !== BOON_RARITY_CHECKS.length ||
        BOON_RARITY_CHECKS.some((check) => value[check] === undefined)
      )
        fail(
          `boonRarityBases.${providerKind}`,
          'must declare exact Rare, Epic, Duo, and Legendary checks',
        );
      const checks = Object.fromEntries(
        BOON_RARITY_CHECKS.map((check) => {
          const chance = value[check];
          if (typeof chance !== 'number' || !Number.isFinite(chance))
            fail(`boonRarityBases.${providerKind}.${check}`, 'must be a finite number');
          return [check, chance];
        }),
      );
      return [providerKind, Object.freeze(checks)];
    }),
  );
  return Object.freeze(normalized) as TraitCatalog['boonRarityBases'];
}

export function normalizeBoonReplacementChance(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 1)
    fail('boonReplacementChance', 'must be a finite probability from 0 through 1');
  return raw;
}

export function normalizeContexts(
  raw: RawTraitCatalogInput['offerContexts'],
): CatalogCollection<TraitOfferContextDeclaration> {
  const declarations = requireArray(raw, 'offerContexts').map(
    (value, index) =>
      requireObject(
        value,
        `offerContexts[${index}]`,
      ) as unknown as RawTraitCatalogInput['offerContexts'][number],
  );
  const values = declarations.map((context, index) => {
    const path = `offerContexts[${index}]`;
    const key = closedValue(context.key, CONTEXTS, `${path}.key`);
    if (
      key === 'devotionNoDuo' &&
      (context.kind !== 'rewardRarityBlock' || context.blockedRarity !== 'Duo')
    )
      fail(path, 'must block Duo rarity');
    if (
      key === 'blockGiftBoons' &&
      (context.kind !== 'roomFlag' || context.roomFlag !== 'BlockGiftBoons')
    )
      fail(path, 'must reference BlockGiftBoons');
    if (
      key === 'circeRemovableFearVow' &&
      (context.kind !== 'authoredCondition' ||
        context.authoredCondition !== 'circeRemovableFearVow')
    )
      fail(path, 'must be the Circe removable-Fear context');
    return Object.freeze({
      key,
      kind: context.kind,
      ...(context.blockedRarity === undefined
        ? {}
        : { blockedRarity: closedValue(context.blockedRarity, RARITIES, `${path}.blockedRarity`) }),
      ...(context.roomFlag === undefined ? {} : { roomFlag: context.roomFlag }),
      ...(context.authoredCondition === undefined
        ? {}
        : { authoredCondition: context.authoredCondition }),
    });
  });
  const collection = createCollection(values, 'offerContexts', (context) => context.key);
  for (const key of CONTEXTS)
    if (collection.byKey[key] === undefined) fail('offerContexts', `missing ${key}`);
  return collection;
}

export function normalizeEchoLastRunBoon(
  raw: RawTraitCatalogInput['echoLastRunBoon'],
  traits: CatalogCollection<TraitDeclaration>,
  givers: CatalogCollection<TraitGiverDeclaration>,
): EchoLastRunBoonCatalog {
  const value = requireObject(
    raw,
    'echoLastRunBoon',
  ) as unknown as RawTraitCatalogInput['echoLastRunBoon'];
  const actualKeys = Object.keys(value).sort();
  if (
    actualKeys.length !== 2 ||
    actualKeys[0] !== 'excludedTraitKeys' ||
    actualKeys[1] !== 'sources'
  )
    fail('echoLastRunBoon', 'must contain exactly excludedTraitKeys and sources');
  const excludedTraitKeys = freezeUniqueStrings(
    requireArray(value.excludedTraitKeys, 'echoLastRunBoon.excludedTraitKeys') as readonly string[],
    'echoLastRunBoon.excludedTraitKeys',
  );
  for (const [index, traitKey] of excludedTraitKeys.entries()) {
    if (traits.byKey[traitKey] === undefined)
      fail(`echoLastRunBoon.excludedTraitKeys[${index}]`, `unknown trait ${traitKey}`);
  }
  const sources = requireArray(value.sources, 'echoLastRunBoon.sources').map((entry, index) => {
    const path = `echoLastRunBoon.sources[${index}]`;
    const source = requireObject(entry, path) as {
      readonly giverKey?: unknown;
      readonly lootHistorySource?: unknown;
    };
    const expectedKeys =
      source.lootHistorySource === undefined ? ['giverKey'] : ['giverKey', 'lootHistorySource'];
    const keys = Object.keys(source).sort();
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key, keyIndex) => key !== [...expectedKeys].sort()[keyIndex])
    )
      fail(path, `must contain exactly ${expectedKeys.join(' and ')}`);
    if (typeof source.giverKey !== 'string') fail(`${path}.giverKey`, 'must be a string');
    const giverKey = requireNonEmpty(source.giverKey, `${path}.giverKey`);
    const giver = givers.byKey[giverKey];
    if (giver === undefined) fail(`${path}.giverKey`, `unknown giver ${giverKey}`);
    if (giver.providerKind === 'hammer' || giver.rarityPolicy.kind === 'none')
      fail(`${path}.giverKey`, `${giverKey} cannot participate in Echo's last-run domain`);
    return Object.freeze({
      giver,
      ...(source.lootHistorySource === undefined
        ? {}
        : typeof source.lootHistorySource !== 'string'
          ? fail(`${path}.lootHistorySource`, 'must be a string')
          : {
              lootHistorySource: requireNonEmpty(
                source.lootHistorySource,
                `${path}.lootHistorySource`,
              ),
            }),
    });
  });
  if (
    sources.length === 0 ||
    new Set(sources.map((source) => source.giver.key)).size !== sources.length
  )
    fail('echoLastRunBoon.sources', 'must contain distinct participating givers');
  const participantTraitKeys = new Set(sources.flatMap((source) => [...source.giver.traitKeys]));
  for (const traitKey of excludedTraitKeys) {
    if (!participantTraitKeys.has(traitKey))
      fail('echoLastRunBoon.excludedTraitKeys', `${traitKey} is not in a participating giver`);
  }
  const variants = sources.flatMap(({ giver, lootHistorySource }) =>
    giver.traitKeys.flatMap((traitKey) => {
      if (excludedTraitKeys.includes(traitKey)) return [];
      const trait = traits.byKey[traitKey];
      if (trait?.rarityDomain.kind !== 'ranked')
        fail(
          'echoLastRunBoon.sources',
          `${giver.key}.${traitKey} must have a ranked rarity domain`,
        );
      return [
        Object.freeze({
          key: `${giver.key}:${traitKey}`,
          giverKey: giver.key,
          traitKey,
          ...(lootHistorySource === undefined ? {} : { lootHistorySource }),
        }),
      ];
    }),
  );
  return Object.freeze({
    variants: createCollection(variants, 'echoLastRunBoon.variants', (variant) => variant.key),
  });
}
