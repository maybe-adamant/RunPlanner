import type {
  CatalogCollection,
  EncounterDefinition,
  KeepsakeDeclaration,
  TraitDeclaration,
  TraitGiverDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawKeepsakeDeclaration } from '../declarations';
import { createCollection, requireNonEmpty } from './common';
import { fail } from './errors';

const keepsakeRanks = ['Common', 'Rare', 'Epic', 'Heroic'] as const;
const giftSchedulesByKind = {
  figLeaf: 'oneShot',
  experimentalHammer: 'oneShotAfterUnequipped',
  crystalFigurine: 'everyBiome',
  concaveStone: 'oneShot',
  transcendentEmbryo: 'oneShot',
  callingCard: 'everyBiome',
  timePiece: 'everyBiome',
  olympianRewardPressure: 'everyBiome',
  moonBeam: 'oneShotAfterUnequipped',
  modeledNeutral: 'noModeledEffect',
} as const;
const inRunTraitRarities = ['Common', 'Rare', 'Epic', 'Heroic'] as const;

function requireExactObjectKeys(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail(path, 'must be an object');
  const actualKeys = Object.keys(value);
  const missing = expectedKeys.find((key) => !actualKeys.includes(key));
  if (missing !== undefined) fail(`${path}.${missing}`, 'is required');
  const extra = actualKeys.find((key) => !expectedKeys.includes(key));
  if (extra !== undefined) fail(`${path}.${extra}`, 'is not supported');
}

function requireClosedValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value))
    fail(path, `must be one of ${values.join(', ')}`);
  return value as Values[number];
}

function requirePositiveInteger(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  )
    fail(path, 'must be a positive integer');
  return value;
}

function requireNonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0)
    fail(path, 'must be a non-negative integer');
  return value;
}

function requireExactOne(value: unknown, path: string): 1 {
  if (value !== 1) fail(path, 'must be 1');
  return 1;
}

function requireExactEight(value: unknown, path: string): 8 {
  if (value !== 8) fail(path, 'must be 8');
  return 8;
}

function normalizeNumericRankProfile(
  value: unknown,
  path: string,
): Readonly<Record<(typeof keepsakeRanks)[number], number>> {
  requireExactObjectKeys(value, path, keepsakeRanks);
  return Object.freeze(
    Object.fromEntries(
      keepsakeRanks.map((rank) => [rank, requirePositiveInteger(value[rank], `${path}.${rank}`)]),
    ),
  ) as Readonly<Record<(typeof keepsakeRanks)[number], number>>;
}

function normalizeRarityLevelProfile(
  value: unknown,
  path: string,
): Readonly<Record<(typeof keepsakeRanks)[number], 1 | 2 | 3 | 4>> {
  requireExactObjectKeys(value, path, keepsakeRanks);
  const profile = Object.fromEntries(
    keepsakeRanks.map((rank) => {
      const level = requirePositiveInteger(value[rank], `${path}.${rank}`);
      if (level > 4) fail(`${path}.${rank}`, 'must be a supported trait rarity level');
      return [rank, level as 1 | 2 | 3 | 4];
    }),
  );
  return Object.freeze(profile) as Readonly<Record<(typeof keepsakeRanks)[number], 1 | 2 | 3 | 4>>;
}

function normalizeInRunRarityProfile(
  value: unknown,
  path: string,
): Readonly<Record<(typeof keepsakeRanks)[number], (typeof inRunTraitRarities)[number]>> {
  requireExactObjectKeys(value, path, keepsakeRanks);
  return Object.freeze(
    Object.fromEntries(
      keepsakeRanks.map((rank) => [
        rank,
        requireClosedValue(value[rank], inRunTraitRarities, `${path}.${rank}`),
      ]),
    ),
  ) as Readonly<Record<(typeof keepsakeRanks)[number], (typeof inRunTraitRarities)[number]>>;
}

function normalizeOlympianRarityProfile(
  value: unknown,
  path: string,
): Readonly<Record<'Common' | 'Rare' | 'Epic', 1 | 2 | 3>> {
  const ranks = ['Common', 'Rare', 'Epic'] as const;
  requireExactObjectKeys(value, path, ranks);
  const profile = Object.fromEntries(
    ranks.map((rank) => {
      const level = requirePositiveInteger(value[rank], `${path}.${rank}`);
      if (level > 3) fail(`${path}.${rank}`, 'must be a supported Olympian source rarity level');
      return [rank, level as 1 | 2 | 3];
    }),
  );
  return Object.freeze(profile) as Readonly<Record<'Common' | 'Rare' | 'Epic', 1 | 2 | 3>>;
}

function normalizeFountainRarityProfile(
  value: unknown,
  path: string,
): Readonly<Record<'Common' | 'Rare' | 'Epic', 1 | 2 | 3 | 4>> {
  const ranks = ['Common', 'Rare', 'Epic'] as const;
  requireExactObjectKeys(value, path, ranks);
  return Object.freeze(
    Object.fromEntries(
      ranks.map((rank) => {
        const level = requirePositiveInteger(value[rank], `${path}.${rank}`);
        if (level > 4) fail(`${path}.${rank}`, 'must be a supported trait rarity level');
        return [rank, level as 1 | 2 | 3 | 4];
      }),
    ),
  ) as Readonly<Record<'Common' | 'Rare' | 'Epic', 1 | 2 | 3 | 4>>;
}

function normalizePercentageRankProfile(
  value: unknown,
  path: string,
): Readonly<Record<string, number>> {
  requireExactObjectKeys(value, path, keepsakeRanks);
  const profile = Object.fromEntries(
    keepsakeRanks.map((rank) => {
      const percentage = requireNonNegativeInteger(value[rank], `${path}.${rank}`);
      if (percentage > 100) fail(`${path}.${rank}`, 'must be at most 100');
      return [rank, percentage];
    }),
  );
  return Object.freeze(profile);
}

function validateGiftEffectAgreement(
  gift: KeepsakeDeclaration['echoGift'],
  effect: KeepsakeDeclaration['effect'],
  path: string,
): void {
  if (gift.availability === 'excluded') return;
  if (gift.effect.kind === 'modeledNeutral') {
    if (effect !== undefined)
      fail(`${path}.effect.kind`, 'modeledNeutral requires no effect descriptor');
    return;
  }
  if (effect?.kind !== gift.effect.kind)
    fail(`${path}.effect.kind`, 'must match the keepsake effect descriptor');
}

function normalizeGift(
  raw: RawKeepsakeDeclaration['echoGift'],
  path: string,
): KeepsakeDeclaration['echoGift'] {
  requireExactObjectKeys(
    raw,
    path,
    raw.availability === 'excluded' ? ['availability'] : ['availability', 'effect'],
  );
  if (raw.availability === 'excluded') return Object.freeze({ availability: 'excluded' });
  if (raw.availability !== 'eligible') fail(`${path}.availability`, 'must be excluded or eligible');
  requireExactObjectKeys(raw.effect, `${path}.effect`, ['kind', 'schedule']);
  const kind = requireClosedValue(
    raw.effect.kind,
    Object.keys(giftSchedulesByKind),
    `${path}.effect.kind`,
  ) as keyof typeof giftSchedulesByKind;
  const schedule = requireClosedValue(
    raw.effect.schedule,
    [...new Set(Object.values(giftSchedulesByKind))],
    `${path}.effect.schedule`,
  );
  if (schedule !== giftSchedulesByKind[kind])
    fail(`${path}.effect.schedule`, `must be ${giftSchedulesByKind[kind]} for ${kind}`);
  return Object.freeze({
    availability: 'eligible',
    effect: Object.freeze({
      kind,
      schedule,
    }),
  }) as KeepsakeDeclaration['echoGift'];
}

function normalizeEffect(
  raw: RawKeepsakeDeclaration['effect'],
  path: string,
): KeepsakeDeclaration['effect'] {
  if (raw === undefined) return undefined;
  switch (raw.kind) {
    case 'jeweledPom': {
      requireExactObjectKeys(raw, path, [
        'kind',
        'giverKey',
        'subsequentEligibleTraitLevelsByRank',
      ]);
      return Object.freeze({
        kind: raw.kind,
        giverKey: requireNonEmpty(raw.giverKey, `${path}.giverKey`),
        subsequentEligibleTraitLevelsByRank: normalizeNumericRankProfile(
          raw.subsequentEligibleTraitLevelsByRank,
          `${path}.subsequentEligibleTraitLevelsByRank`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'experimentalHammer': {
      requireExactObjectKeys(raw, path, ['kind', 'giverKey', 'qualifyingEncounterUsesByRank']);
      return Object.freeze({
        kind: raw.kind,
        giverKey: requireNonEmpty(raw.giverKey, `${path}.giverKey`),
        qualifyingEncounterUsesByRank: normalizeNumericRankProfile(
          raw.qualifyingEncounterUsesByRank,
          `${path}.qualifyingEncounterUsesByRank`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'callingCard': {
      requireExactObjectKeys(raw, path, ['kind', 'rarificationChargesByRank']);
      return Object.freeze({
        kind: raw.kind,
        rarificationChargesByRank: normalizeNumericRankProfile(
          raw.rarificationChargesByRank,
          `${path}.rarificationChargesByRank`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'timePiece': {
      requireExactObjectKeys(raw, path, ['kind', 'conversionChargesByRank']);
      return Object.freeze({
        kind: raw.kind,
        conversionChargesByRank: normalizeNumericRankProfile(
          raw.conversionChargesByRank,
          `${path}.conversionChargesByRank`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'figLeaf': {
      requireExactObjectKeys(raw, path, ['kind', 'biomeUsesByRank']);
      return Object.freeze({
        kind: raw.kind,
        biomeUsesByRank: normalizeNumericRankProfile(
          raw.biomeUsesByRank,
          `${path}.biomeUsesByRank`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'gorgonAmulet': {
      requireExactObjectKeys(raw, path, [
        'kind',
        'uses',
        'minimumBiomeDepth',
        'providerKey',
        'rarityLevelByRank',
        'naturalEncounterKey',
      ]);
      return Object.freeze({
        kind: raw.kind,
        uses: requireExactOne(raw.uses, `${path}.uses`),
        minimumBiomeDepth: requireNonNegativeInteger(
          raw.minimumBiomeDepth,
          `${path}.minimumBiomeDepth`,
        ),
        providerKey: requireNonEmpty(raw.providerKey, `${path}.providerKey`),
        rarityLevelByRank: normalizeRarityLevelProfile(
          raw.rarityLevelByRank,
          `${path}.rarityLevelByRank`,
        ),
        naturalEncounterKey: requireNonEmpty(
          raw.naturalEncounterKey,
          `${path}.naturalEncounterKey`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'fountainRarity': {
      requireExactObjectKeys(raw, path, [
        'kind',
        'uses',
        'targetRarityLevelByRank',
        'sourceMaxRarityLevel',
      ]);
      return Object.freeze({
        kind: raw.kind,
        uses: requireExactOne(raw.uses, `${path}.uses`),
        targetRarityLevelByRank: normalizeFountainRarityProfile(
          raw.targetRarityLevelByRank,
          `${path}.targetRarityLevelByRank`,
        ),
        sourceMaxRarityLevel: requireExactOne(
          raw.sourceMaxRarityLevel,
          `${path}.sourceMaxRarityLevel`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'crystalFigurine': {
      requireExactObjectKeys(raw, path, ['kind', 'uses', 'requestedCards', 'rarityLevelByRank']);
      return Object.freeze({
        kind: raw.kind,
        uses: requireExactOne(raw.uses, `${path}.uses`),
        requestedCards: requirePositiveInteger(raw.requestedCards, `${path}.requestedCards`),
        rarityLevelByRank: normalizeRarityLevelProfile(
          raw.rarityLevelByRank,
          `${path}.rarityLevelByRank`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'concaveStone': {
      requireExactObjectKeys(raw, path, ['kind', 'uses', 'procSupportByRank']);
      return Object.freeze({
        kind: raw.kind,
        uses: requireExactOne(raw.uses, `${path}.uses`),
        procSupportByRank: normalizePercentageRankProfile(
          raw.procSupportByRank,
          `${path}.procSupportByRank`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'transcendentEmbryo': {
      requireExactObjectKeys(raw, path, ['kind', 'source', 'interval', 'blessingRarityByRank']);
      if (raw.source !== 'Chaos') fail(`${path}.source`, 'must be Chaos');
      return Object.freeze({
        kind: raw.kind,
        source: 'Chaos',
        interval: requireExactEight(raw.interval, `${path}.interval`),
        blessingRarityByRank: normalizeInRunRarityProfile(
          raw.blessingRarityByRank,
          `${path}.blessingRarityByRank`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'olympianRewardPressure': {
      requireExactObjectKeys(raw, path, [
        'kind',
        'priorityRewardType',
        'providerKey',
        'providerForceUses',
        'providerRarificationUses',
        'maximumSourceRarityLevelByRank',
      ]);
      if (raw.providerForceUses !== 1 || raw.providerRarificationUses !== 1)
        fail(path, 'requires one force use and one rarification use');
      return Object.freeze({
        kind: raw.kind,
        priorityRewardType: requireNonEmpty(raw.priorityRewardType, `${path}.priorityRewardType`),
        providerKey: requireNonEmpty(raw.providerKey, `${path}.providerKey`),
        providerForceUses: 1,
        providerRarificationUses: 1,
        maximumSourceRarityLevelByRank: normalizeOlympianRarityProfile(
          raw.maximumSourceRarityLevelByRank,
          `${path}.maximumSourceRarityLevelByRank`,
        ),
      }) as KeepsakeDeclaration['effect'];
    }
    case 'moonBeam': {
      requireExactObjectKeys(raw, path, ['kind', 'pathPointsByRank', 'priorityRewardTypes']);
      if (!Array.isArray(raw.priorityRewardTypes) || raw.priorityRewardTypes.length !== 3)
        fail(`${path}.priorityRewardTypes`, 'must contain exactly three reward types');
      const priorityRewardTypes = raw.priorityRewardTypes.map((rewardType, index) =>
        requireNonEmpty(rewardType, `${path}.priorityRewardTypes[${index}]`),
      ) as [string, string, string];
      if (new Set(priorityRewardTypes).size !== priorityRewardTypes.length)
        fail(`${path}.priorityRewardTypes`, 'must be unique');
      return Object.freeze({
        kind: raw.kind,
        pathPointsByRank: normalizeNumericRankProfile(
          raw.pathPointsByRank,
          `${path}.pathPointsByRank`,
        ),
        priorityRewardTypes: Object.freeze(priorityRewardTypes),
      }) as KeepsakeDeclaration['effect'];
    }
    default:
      fail(
        `${path}.kind`,
        `unknown keepsake effect ${String((raw as { readonly kind?: unknown }).kind)}`,
      );
  }
}

export function normalizeKeepsakes(
  raw: readonly RawKeepsakeDeclaration[],
): CatalogCollection<KeepsakeDeclaration> {
  const values = raw.map((keepsake, index): KeepsakeDeclaration => {
    const path = `keepsakes[${index}]`;
    const key = requireNonEmpty(keepsake.key, `${path}.key`);
    const label = requireNonEmpty(keepsake.label, `${path}.label`);
    if (keepsake.rank !== 'Epic') fail(`${path}.rank`, 'must be fixed rank III (Epic)');
    const fatedDisposition = requireClosedValue(
      keepsake.fatedDisposition,
      ['neutral', 'enabling', 'opposing'] as const,
      `${path}.fatedDisposition`,
    );
    const echoGift = normalizeGift(keepsake.echoGift, `${path}.echoGift`);
    const effect = normalizeEffect(keepsake.effect, `${path}.effect`);
    validateGiftEffectAgreement(echoGift, effect, `${path}.echoGift`);
    return Object.freeze({
      key,
      label,
      rank: 'Epic',
      fatedDisposition,
      echoGift,
      ...(effect === undefined ? {} : { effect }),
    });
  });
  return createCollection(values, 'keepsakes', (keepsake) => keepsake.key);
}

export function validateKeepsakeReferences(input: {
  readonly keepsakes: CatalogCollection<KeepsakeDeclaration>;
  readonly givers: CatalogCollection<TraitGiverDeclaration>;
  readonly rewards: RewardKernelCatalog;
  readonly encounters: CatalogCollection<EncounterDefinition>;
}): void {
  for (const keepsake of input.keepsakes.values) {
    const effect = keepsake.effect;
    if (effect === undefined) continue;
    const path = `keepsakes.${keepsake.key}.effect`;
    switch (effect.kind) {
      case 'jeweledPom':
        if (input.givers.byKey[effect.giverKey] === undefined)
          fail(`${path}.giverKey`, 'references an unknown trait giver');
        break;
      case 'experimentalHammer':
        if (input.givers.byKey[effect.giverKey]?.providerKind !== 'hammer')
          fail(`${path}.giverKey`, 'must reference a Hammer trait giver');
        break;
      case 'gorgonAmulet':
        if (input.givers.byKey[effect.providerKey] === undefined)
          fail(`${path}.providerKey`, 'references an unknown trait giver');
        if (input.encounters.byKey[effect.naturalEncounterKey] === undefined)
          fail(`${path}.naturalEncounterKey`, 'references an unknown encounter');
        break;
      case 'olympianRewardPressure':
        if (input.givers.byKey[effect.providerKey]?.providerKind !== 'olympian')
          fail(`${path}.providerKey`, 'must reference an Olympian trait giver');
        if (input.rewards.rewardTypes.byKey[effect.priorityRewardType] === undefined)
          fail(`${path}.priorityRewardType`, 'references an unknown reward type');
        break;
      case 'moonBeam':
        for (const rewardType of effect.priorityRewardTypes)
          if (input.rewards.rewardTypes.byKey[rewardType] === undefined)
            fail(`${path}.priorityRewardTypes`, `references an unknown reward type ${rewardType}`);
        break;
      default:
        break;
    }
  }
}

export function validateEchoGiftBindings(
  keepsakes: CatalogCollection<KeepsakeDeclaration>,
  traits: CatalogCollection<TraitDeclaration>,
): void {
  const gift = traits.byKey.EchoRepeatKeepsakeBoon?.selectedDisposition;
  if (gift?.kind !== 'echo' || gift.effect !== 'repeatKeepsake')
    fail('traits.EchoRepeatKeepsakeBoon', 'must declare Echo keepsake replay');
  const excluded = keepsakes.values
    .filter((keepsake) => keepsake.echoGift.availability === 'excluded')
    .map((keepsake) => keepsake.key);
  if (
    excluded.length !== gift.excludedKeepsakeKeys.length ||
    excluded.some((key) => !gift.excludedKeepsakeKeys.includes(key))
  )
    fail('traits.EchoRepeatKeepsakeBoon.selectedDisposition', 'must match keepsake exclusions');
}
