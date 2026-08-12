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
    return Object.freeze({ ...keepsake });
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
