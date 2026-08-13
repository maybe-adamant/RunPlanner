import type { RawKeepsakeDeclaration } from './types';

/** Ordinary rack inventory, intentionally rank-III only. */
const entries: readonly (readonly [string, string, RawKeepsakeDeclaration['fatedDisposition']])[] =
  [
    ['ManaOverTimeRefundKeepsake', 'Silver Wheel', 'neutral'],
    ['BossPreDamageKeepsake', 'Knuckle Bones', 'neutral'],
    ['ReincarnationKeepsake', 'Luckier Tooth', 'neutral'],
    ['DoorHealReserveKeepsake', 'Ghost Onion', 'neutral'],
    ['DeathVengeanceKeepsake', 'Evil Eye', 'neutral'],
    ['BonusMoneyKeepsake', 'Gold Purse', 'neutral'],
    ['BlockDeathKeepsake', 'Engraved Pin', 'neutral'],
    ['EscalatingKeepsake', 'Discordant Bell', 'neutral'],
    ['TimedBuffKeepsake', 'Metallic Droplet', 'neutral'],
    ['LowHealthCritKeepsake', 'White Antler', 'neutral'],
    ['SpellTalentKeepsake', 'Moon Beam', 'neutral'],
    ['ForceZeusBoonKeepsake', 'Cloud Bangle', 'opposing'],
    ['ForceHeraBoonKeepsake', 'Iridescent Fan', 'opposing'],
    ['ForcePoseidonBoonKeepsake', 'Vivid Sea', 'opposing'],
    ['ForceDemeterBoonKeepsake', 'Barley Sheaf', 'opposing'],
    ['ForceApolloBoonKeepsake', 'Harmonic Photon', 'opposing'],
    ['ForceAphroditeBoonKeepsake', 'Beautiful Mirror', 'opposing'],
    ['ForceHephaestusBoonKeepsake', 'Adamant Shard', 'opposing'],
    ['ForceHestiaBoonKeepsake', 'Everlasting Ember', 'opposing'],
    ['ForceAresBoonKeepsake', 'Sword Hilt', 'opposing'],
    ['AthenaEncounterKeepsake', 'Gorgon Amulet', 'opposing'],
    ['SkipEncounterKeepsake', 'Fig Leaf', 'neutral'],
    ['ArmorGainKeepsake', 'Silken Sash', 'neutral'],
    ['FountainRarityKeepsake', 'Aromatic Phial', 'neutral'],
    ['UnpickedBoonKeepsake', 'Concave Stone', 'neutral'],
    ['DecayingBoostKeepsake', 'Lion Fang', 'neutral'],
    ['DamagedDamageBoostKeepsake', 'Blackened Fleece', 'neutral'],
    ['BossMetaUpgradeKeepsake', 'Crystal Figurine', 'neutral'],
    ['TempHammerKeepsake', 'Experimental Hammer', 'neutral'],
    ['HadesAndPersephoneKeepsake', 'Jeweled Pom', 'enabling'],
    ['RarifyKeepsake', 'Calling Card', 'enabling'],
    ['GoldifyKeepsake', 'Time Piece', 'enabling'],
    ['RandomBlessingKeepsake', 'Transcendent Embryo', 'neutral'],
  ];

export const keepsakes: readonly RawKeepsakeDeclaration[] = entries.map(
  ([key, label, fatedDisposition]) => ({
    key,
    label,
    rank: 'Epic' as const,
    fatedDisposition: fatedDisposition as RawKeepsakeDeclaration['fatedDisposition'],
    ...(key === 'HadesAndPersephoneKeepsake'
      ? {
          effect: {
            kind: 'jeweledPom' as const,
            giverKey: 'Hades',
            subsequentEligibleTraitLevels: 3 as const,
          },
        }
      : key === 'TempHammerKeepsake'
        ? {
            effect: {
              kind: 'experimentalHammer' as const,
              giverKey: 'WeaponUpgrade',
              qualifyingEncounterUses: 20 as const,
            },
          }
        : key === 'RarifyKeepsake'
          ? { effect: { kind: 'callingCard' as const, rarificationCharges: 6 as const } }
          : {}),
  }),
);
