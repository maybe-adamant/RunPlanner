import type { CatalogCollection, KeepsakeDeclaration } from '@run-planner/engine/catalog-schema';
import type { RawKeepsakeDeclaration } from '../declarations';
import { createCollection, requireNonEmpty } from './common';
import { fail } from './errors';

const enabling = new Set(['HadesAndPersephoneKeepsake', 'RarifyKeepsake', 'GoldifyKeepsake']);
const opposing = new Set([
  'ForceZeusBoonKeepsake',
  'ForceHeraBoonKeepsake',
  'ForcePoseidonBoonKeepsake',
  'ForceDemeterBoonKeepsake',
  'ForceApolloBoonKeepsake',
  'ForceAphroditeBoonKeepsake',
  'ForceHephaestusBoonKeepsake',
  'ForceHestiaBoonKeepsake',
  'ForceAresBoonKeepsake',
  'AthenaEncounterKeepsake',
]);

const authoritativeKeys = new Set([
  'ManaOverTimeRefundKeepsake',
  'BossPreDamageKeepsake',
  'ReincarnationKeepsake',
  'DoorHealReserveKeepsake',
  'DeathVengeanceKeepsake',
  'BonusMoneyKeepsake',
  'BlockDeathKeepsake',
  'EscalatingKeepsake',
  'TimedBuffKeepsake',
  'LowHealthCritKeepsake',
  'SpellTalentKeepsake',
  'ForceZeusBoonKeepsake',
  'ForceHeraBoonKeepsake',
  'ForcePoseidonBoonKeepsake',
  'ForceDemeterBoonKeepsake',
  'ForceApolloBoonKeepsake',
  'ForceAphroditeBoonKeepsake',
  'ForceHephaestusBoonKeepsake',
  'ForceHestiaBoonKeepsake',
  'ForceAresBoonKeepsake',
  'AthenaEncounterKeepsake',
  'SkipEncounterKeepsake',
  'ArmorGainKeepsake',
  'FountainRarityKeepsake',
  'UnpickedBoonKeepsake',
  'DecayingBoostKeepsake',
  'DamagedDamageBoostKeepsake',
  'BossMetaUpgradeKeepsake',
  'TempHammerKeepsake',
  'HadesAndPersephoneKeepsake',
  'RarifyKeepsake',
  'GoldifyKeepsake',
  'RandomBlessingKeepsake',
]);

const keepsakeRanks = ['Common', 'Rare', 'Epic', 'Heroic'] as const;
type KeepsakeRank = (typeof keepsakeRanks)[number];
type NumericRankProfile = Readonly<Record<KeepsakeRank, number>>;

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

function normalizeRankProfile<const T extends NumericRankProfile>(
  value: unknown,
  path: string,
  expected: T,
): T {
  requireExactObjectKeys(value, path, keepsakeRanks);
  for (const rank of keepsakeRanks) {
    if (typeof value[rank] !== 'number' || !Number.isFinite(value[rank]))
      fail(`${path}.${rank}`, 'must be numeric');
    if (value[rank] !== expected[rank]) fail(`${path}.${rank}`, `must equal ${expected[rank]}`);
  }
  return Object.freeze({
    Common: expected.Common,
    Rare: expected.Rare,
    Epic: expected.Epic,
    Heroic: expected.Heroic,
  }) as T;
}

export function normalizeKeepsakes(
  raw: readonly RawKeepsakeDeclaration[],
): CatalogCollection<KeepsakeDeclaration> {
  if (raw.length !== 33) fail('keepsakes', 'must declare exactly 33 ordinary keepsakes');
  const values = raw.map((keepsake, index) => {
    const path = `keepsakes[${index}]`;
    requireNonEmpty(keepsake.key, `${path}.key`);
    requireNonEmpty(keepsake.label, `${path}.label`);
    if (keepsake.rank !== 'Epic') fail(`${path}.rank`, 'must be fixed rank III (Epic)');
    const expected = enabling.has(keepsake.key)
      ? 'enabling'
      : opposing.has(keepsake.key)
        ? 'opposing'
        : 'neutral';
    if (keepsake.fatedDisposition !== expected)
      fail(`${path}.fatedDisposition`, `expected ${expected}`);
    let effect: KeepsakeDeclaration['effect'];
    if (keepsake.key === 'HadesAndPersephoneKeepsake') {
      requireExactObjectKeys(keepsake.effect, `${path}.effect`, [
        'kind',
        'giverKey',
        'subsequentEligibleTraitLevelsByRank',
      ]);
      if (keepsake.effect.kind !== 'jeweledPom' || keepsake.effect.giverKey !== 'Hades')
        fail(`${path}.effect`, 'must declare the Jeweled Pom rank profile and Hades giver');
      effect = Object.freeze({
        kind: 'jeweledPom',
        giverKey: 'Hades',
        subsequentEligibleTraitLevelsByRank: normalizeRankProfile(
          keepsake.effect.subsequentEligibleTraitLevelsByRank,
          `${path}.effect.subsequentEligibleTraitLevelsByRank`,
          { Common: 1, Rare: 2, Epic: 3, Heroic: 4 } as const,
        ),
      });
    } else if (keepsake.key === 'TempHammerKeepsake') {
      requireExactObjectKeys(keepsake.effect, `${path}.effect`, [
        'kind',
        'giverKey',
        'qualifyingEncounterUsesByRank',
      ]);
      if (
        keepsake.effect.kind !== 'experimentalHammer' ||
        keepsake.effect.giverKey !== 'WeaponUpgrade'
      )
        fail(`${path}.effect`, 'must declare the Experimental Hammer rank profile and giver');
      effect = Object.freeze({
        kind: 'experimentalHammer',
        giverKey: 'WeaponUpgrade',
        qualifyingEncounterUsesByRank: normalizeRankProfile(
          keepsake.effect.qualifyingEncounterUsesByRank,
          `${path}.effect.qualifyingEncounterUsesByRank`,
          { Common: 10, Rare: 15, Epic: 20, Heroic: 30 } as const,
        ),
      });
    } else if (keepsake.key === 'RarifyKeepsake') {
      requireExactObjectKeys(keepsake.effect, `${path}.effect`, [
        'kind',
        'rarificationChargesByRank',
      ]);
      if (keepsake.effect.kind !== 'callingCard')
        fail(`${path}.effect`, 'must declare the Calling Card rank profile');
      effect = Object.freeze({
        kind: 'callingCard',
        rarificationChargesByRank: normalizeRankProfile(
          keepsake.effect.rarificationChargesByRank,
          `${path}.effect.rarificationChargesByRank`,
          { Common: 2, Rare: 4, Epic: 6, Heroic: 8 } as const,
        ),
      });
    } else if (keepsake.key === 'GoldifyKeepsake') {
      requireExactObjectKeys(keepsake.effect, `${path}.effect`, [
        'kind',
        'conversionChargesByRank',
      ]);
      if (keepsake.effect.kind !== 'timePiece')
        fail(`${path}.effect`, 'must declare the Time Piece rank profile');
      effect = Object.freeze({
        kind: 'timePiece',
        conversionChargesByRank: normalizeRankProfile(
          keepsake.effect.conversionChargesByRank,
          `${path}.effect.conversionChargesByRank`,
          { Common: 2, Rare: 3, Epic: 4, Heroic: 5 } as const,
        ),
      });
    } else if (keepsake.key === 'SkipEncounterKeepsake') {
      requireExactObjectKeys(keepsake.effect, `${path}.effect`, ['kind', 'biomeUsesByRank']);
      if (keepsake.effect.kind !== 'figLeaf')
        fail(`${path}.effect`, 'must declare the Fig Leaf rank profile');
      effect = Object.freeze({
        kind: 'figLeaf',
        biomeUsesByRank: normalizeRankProfile(
          keepsake.effect.biomeUsesByRank,
          `${path}.effect.biomeUsesByRank`,
          { Common: 1, Rare: 2, Epic: 3, Heroic: 4 } as const,
        ),
      });
    } else if (keepsake.key === 'AthenaEncounterKeepsake') {
      requireExactObjectKeys(keepsake.effect, `${path}.effect`, [
        'kind',
        'uses',
        'minimumBiomeDepth',
        'providerKey',
        'rarityLevelByRank',
        'naturalEncounterKey',
      ]);
      if (
        keepsake.effect.kind !== 'gorgonAmulet' ||
        keepsake.effect.uses !== 1 ||
        keepsake.effect.minimumBiomeDepth !== 2 ||
        keepsake.effect.providerKey !== 'Athena' ||
        keepsake.effect.naturalEncounterKey !== 'AthenaCombatP'
      )
        fail(
          `${path}.effect`,
          'must declare Gorgon Amulet one use, depth two, Athena provider, and natural encounter',
        );
      effect = Object.freeze({
        kind: 'gorgonAmulet',
        uses: 1,
        minimumBiomeDepth: 2,
        providerKey: 'Athena',
        rarityLevelByRank: normalizeRankProfile(
          keepsake.effect.rarityLevelByRank,
          `${path}.effect.rarityLevelByRank`,
          { Common: 1, Rare: 2, Epic: 3, Heroic: 4 } as const,
        ),
        naturalEncounterKey: 'AthenaCombatP',
      });
    } else if (keepsake.effect !== undefined)
      fail(`${path}.effect`, 'is not supported by this keepsake');
    return Object.freeze({
      key: keepsake.key,
      label: keepsake.label,
      rank: keepsake.rank,
      fatedDisposition: keepsake.fatedDisposition,
      ...(effect === undefined ? {} : { effect }),
    });
  });
  const collection = createCollection(values, 'keepsakes', (keepsake) => keepsake.key);
  const declaredKeys = new Set(values.map((keepsake) => keepsake.key));
  if (
    declaredKeys.size !== authoritativeKeys.size ||
    [...authoritativeKeys].some((key) => !declaredKeys.has(key)) ||
    [...declaredKeys].some((key) => !authoritativeKeys.has(key))
  )
    fail('keepsakes', 'must declare the exact authoritative ordinary keepsake inventory');
  return collection;
}
