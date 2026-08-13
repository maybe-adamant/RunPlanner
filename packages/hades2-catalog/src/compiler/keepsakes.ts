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
    if (keepsake.key === 'HadesAndPersephoneKeepsake') {
      if (
        keepsake.effect?.kind !== 'jeweledPom' ||
        keepsake.effect.giverKey !== 'Hades' ||
        keepsake.effect.subsequentEligibleTraitLevels !== 3
      )
        fail(`${path}.effect`, 'must declare Jeweled Pom fixed +3 eligible-trait levels');
    } else if (keepsake.key === 'TempHammerKeepsake') {
      if (
        keepsake.effect?.kind !== 'experimentalHammer' ||
        keepsake.effect.giverKey !== 'WeaponUpgrade' ||
        keepsake.effect.qualifyingEncounterUses !== 20
      )
        fail(
          `${path}.effect`,
          'must declare Experimental Hammer giver and fixed 20 qualifying encounter uses',
        );
    } else if (keepsake.key === 'RarifyKeepsake') {
      if (keepsake.effect?.kind !== 'callingCard' || keepsake.effect.rarificationCharges !== 6)
        fail(`${path}.effect`, 'must declare Calling Card fixed six rarification charges');
    } else if (keepsake.key === 'GoldifyKeepsake') {
      if (keepsake.effect?.kind !== 'timePiece' || keepsake.effect.conversionCharges !== 4)
        fail(`${path}.effect`, 'must declare Time Piece fixed four conversion charges');
    } else if (keepsake.effect !== undefined)
      fail(`${path}.effect`, 'is not supported by this keepsake');
    return Object.freeze({
      ...keepsake,
      ...(keepsake.effect === undefined ? {} : { effect: Object.freeze({ ...keepsake.effect }) }),
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
