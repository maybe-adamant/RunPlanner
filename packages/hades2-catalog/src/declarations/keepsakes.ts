import type { RawKeepsakeDeclaration } from './types';

const olympianProviderByKeepsake = {
  ForceZeusBoonKeepsake: 'Zeus',
  ForceHeraBoonKeepsake: 'Hera',
  ForcePoseidonBoonKeepsake: 'Poseidon',
  ForceDemeterBoonKeepsake: 'Demeter',
  ForceApolloBoonKeepsake: 'Apollo',
  ForceAphroditeBoonKeepsake: 'Aphrodite',
  ForceHephaestusBoonKeepsake: 'Hephaestus',
  ForceHestiaBoonKeepsake: 'Hestia',
  ForceAresBoonKeepsake: 'Ares',
} as const;

/** Ordinary rack inventory; player selection remains fixed at rank III. */
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
    echoGift:
      key === 'AthenaEncounterKeepsake' ||
      key === 'HadesAndPersephoneKeepsake' ||
      key === 'EscalatingKeepsake' ||
      key === 'FountainRarityKeepsake'
        ? ({ availability: 'excluded' } as const)
        : key === 'SkipEncounterKeepsake'
          ? ({
              availability: 'eligible',
              effect: { kind: 'figLeaf', schedule: 'oneShot' },
            } as const)
          : key === 'TempHammerKeepsake'
            ? ({
                availability: 'eligible',
                effect: { kind: 'experimentalHammer', schedule: 'oneShotAfterUnequipped' },
              } as const)
            : key === 'BossMetaUpgradeKeepsake'
              ? ({
                  availability: 'eligible',
                  effect: { kind: 'crystalFigurine', schedule: 'everyBiome' },
                } as const)
              : key === 'UnpickedBoonKeepsake'
                ? ({
                    availability: 'eligible',
                    effect: { kind: 'concaveStone', schedule: 'oneShot' },
                  } as const)
                : key === 'RandomBlessingKeepsake'
                  ? ({
                      availability: 'eligible',
                      effect: { kind: 'transcendentEmbryo', schedule: 'oneShot' },
                    } as const)
                  : key === 'RarifyKeepsake'
                    ? ({
                        availability: 'eligible',
                        effect: { kind: 'callingCard', schedule: 'everyBiome' },
                      } as const)
                    : key === 'GoldifyKeepsake'
                      ? ({
                          availability: 'eligible',
                          effect: { kind: 'timePiece', schedule: 'everyBiome' },
                        } as const)
                      : key in olympianProviderByKeepsake
                        ? ({
                            availability: 'eligible',
                            effect: { kind: 'olympianRewardPressure', schedule: 'everyBiome' },
                          } as const)
                        : key === 'SpellTalentKeepsake'
                          ? ({
                              availability: 'eligible',
                              effect: { kind: 'moonBeam', schedule: 'oneShotAfterUnequipped' },
                            } as const)
                          : ({
                              availability: 'eligible',
                              effect: { kind: 'modeledNeutral', schedule: 'noModeledEffect' },
                            } as const),
    ...(key === 'HadesAndPersephoneKeepsake'
      ? {
          effect: {
            kind: 'jeweledPom' as const,
            giverKey: 'Hades',
            subsequentEligibleTraitLevelsByRank: {
              Common: 1 as const,
              Rare: 2 as const,
              Epic: 3 as const,
              Heroic: 4 as const,
            },
          },
        }
      : key === 'TempHammerKeepsake'
        ? {
            effect: {
              kind: 'experimentalHammer' as const,
              giverKey: 'WeaponUpgrade',
              qualifyingEncounterUsesByRank: {
                Common: 10 as const,
                Rare: 15 as const,
                Epic: 20 as const,
                Heroic: 30 as const,
              },
            },
          }
        : key === 'RarifyKeepsake'
          ? {
              effect: {
                kind: 'callingCard' as const,
                rarificationChargesByRank: {
                  Common: 2 as const,
                  Rare: 4 as const,
                  Epic: 6 as const,
                  Heroic: 8 as const,
                },
              },
            }
          : key === 'GoldifyKeepsake'
            ? {
                effect: {
                  kind: 'timePiece' as const,
                  conversionChargesByRank: {
                    Common: 2 as const,
                    Rare: 3 as const,
                    Epic: 4 as const,
                    Heroic: 5 as const,
                  },
                },
              }
            : key === 'SkipEncounterKeepsake'
              ? {
                  effect: {
                    kind: 'figLeaf' as const,
                    biomeUsesByRank: {
                      Common: 1 as const,
                      Rare: 2 as const,
                      Epic: 3 as const,
                      Heroic: 4 as const,
                    },
                  },
                }
              : key === 'AthenaEncounterKeepsake'
                ? {
                    effect: {
                      kind: 'gorgonAmulet' as const,
                      uses: 1 as const,
                      minimumBiomeDepth: 2 as const,
                      providerKey: 'Athena' as const,
                      rarityLevelByRank: {
                        Common: 1 as const,
                        Rare: 2 as const,
                        Epic: 3 as const,
                        Heroic: 4 as const,
                      },
                      naturalEncounterKey: 'AthenaCombatP' as const,
                    },
                  }
                : key === 'FountainRarityKeepsake'
                  ? {
                      effect: {
                        kind: 'fountainRarity' as const,
                        uses: 1 as const,
                        targetRarityLevelByRank: {
                          Common: 2 as const,
                          Rare: 3 as const,
                          Epic: 4 as const,
                        },
                        sourceMaxRarityLevel: 1 as const,
                      },
                    }
                  : key === 'BossMetaUpgradeKeepsake'
                    ? {
                        effect: {
                          kind: 'crystalFigurine' as const,
                          uses: 1 as const,
                          requestedCards: 2 as const,
                          rarityLevelByRank: {
                            Common: 1 as const,
                            Rare: 2 as const,
                            Epic: 3 as const,
                            Heroic: 4 as const,
                          },
                        },
                      }
                    : key === 'UnpickedBoonKeepsake'
                      ? {
                          effect: {
                            kind: 'concaveStone' as const,
                            uses: 1 as const,
                            procSupportByRank: {
                              Common: 25 as const,
                              Rare: 50 as const,
                              Epic: 75 as const,
                              Heroic: 100 as const,
                            },
                          },
                        }
                      : key === 'RandomBlessingKeepsake'
                        ? {
                            effect: {
                              kind: 'transcendentEmbryo' as const,
                              source: 'Chaos' as const,
                              interval: 8 as const,
                              blessingRarityByRank: {
                                Common: 'Common' as const,
                                Rare: 'Rare' as const,
                                Epic: 'Epic' as const,
                                Heroic: 'Heroic' as const,
                              },
                            },
                          }
                        : key in olympianProviderByKeepsake
                          ? {
                              effect: {
                                kind: 'olympianRewardPressure' as const,
                                priorityRewardType: 'Boon' as const,
                                providerKey:
                                  olympianProviderByKeepsake[
                                    key as keyof typeof olympianProviderByKeepsake
                                  ],
                                providerForceUses: 1 as const,
                                providerRarificationUses: 1 as const,
                                maximumSourceRarityLevelByRank: {
                                  Common: 1 as const,
                                  Rare: 2 as const,
                                  Epic: 3 as const,
                                },
                              },
                            }
                          : key === 'SpellTalentKeepsake'
                            ? {
                                effect: {
                                  kind: 'moonBeam' as const,
                                  pathPointsByRank: {
                                    Common: 3 as const,
                                    Rare: 4 as const,
                                    Epic: 5 as const,
                                    Heroic: 7 as const,
                                  },
                                  priorityRewardTypes: [
                                    'SpellDrop' as const,
                                    'TalentDrop' as const,
                                    'TalentBigDrop' as const,
                                  ],
                                },
                              }
                            : {}),
  }),
);
