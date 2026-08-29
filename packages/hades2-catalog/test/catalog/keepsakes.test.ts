import { describe, expect, it } from 'vitest';

import { keepsakes } from '../../src/declarations/keepsakes';
import { normalizeKeepsakes } from '../../src/compiler/keepsakes';
import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';

const supportedEffects = [
  {
    key: 'AthenaEncounterKeepsake',
    profileKey: 'rarityLevelByRank',
    legacyField: 'rarity',
    effect: {
      kind: 'gorgonAmulet',
      uses: 1,
      minimumBiomeDepth: 2,
      providerKey: 'Athena',
      rarityLevelByRank: { Common: 1, Rare: 2, Epic: 3, Heroic: 4 },
      naturalEncounterKey: 'AthenaCombatP',
    },
  },
  {
    key: 'SkipEncounterKeepsake',
    profileKey: 'biomeUsesByRank',
    legacyField: 'biomeUses',
    effect: {
      kind: 'figLeaf',
      biomeUsesByRank: { Common: 1, Rare: 2, Epic: 3, Heroic: 4 },
    },
  },
  {
    key: 'FountainRarityKeepsake',
    profileKey: 'targetRarityLevelByRank',
    legacyField: 'rarity',
    effect: {
      kind: 'fountainRarity',
      uses: 1,
      targetRarityLevelByRank: { Common: 2, Rare: 3, Epic: 4 },
      sourceMaxRarityLevel: 1,
    },
  },
  {
    key: 'UnpickedBoonKeepsake',
    profileKey: 'procSupportByRank',
    legacyField: 'rarity',
    effect: {
      kind: 'concaveStone',
      uses: 1,
      procSupportByRank: { Common: 25, Rare: 50, Epic: 75, Heroic: 100 },
    },
  },
  {
    key: 'BossMetaUpgradeKeepsake',
    profileKey: 'rarityLevelByRank',
    legacyField: 'rarity',
    effect: {
      kind: 'crystalFigurine',
      uses: 1,
      requestedCards: 2,
      rarityLevelByRank: { Common: 1, Rare: 2, Epic: 3, Heroic: 4 },
    },
  },
  {
    key: 'TempHammerKeepsake',
    profileKey: 'qualifyingEncounterUsesByRank',
    legacyField: 'qualifyingEncounterUses',
    effect: {
      kind: 'experimentalHammer',
      giverKey: 'WeaponUpgrade',
      qualifyingEncounterUsesByRank: { Common: 10, Rare: 15, Epic: 20, Heroic: 30 },
    },
  },
  {
    key: 'HadesAndPersephoneKeepsake',
    profileKey: 'subsequentEligibleTraitLevelsByRank',
    legacyField: 'subsequentEligibleTraitLevels',
    effect: {
      kind: 'jeweledPom',
      giverKey: 'Hades',
      subsequentEligibleTraitLevelsByRank: { Common: 1, Rare: 2, Epic: 3, Heroic: 4 },
    },
  },
  {
    key: 'RarifyKeepsake',
    profileKey: 'rarificationChargesByRank',
    legacyField: 'rarificationCharges',
    effect: {
      kind: 'callingCard',
      rarificationChargesByRank: { Common: 2, Rare: 4, Epic: 6, Heroic: 8 },
    },
  },
  {
    key: 'GoldifyKeepsake',
    profileKey: 'conversionChargesByRank',
    legacyField: 'conversionCharges',
    effect: {
      kind: 'timePiece',
      conversionChargesByRank: { Common: 2, Rare: 3, Epic: 4, Heroic: 5 },
    },
  },
  {
    key: 'RandomBlessingKeepsake',
    profileKey: 'blessingRarityByRank',
    legacyField: 'rarity',
    effect: {
      kind: 'transcendentEmbryo',
      source: 'Chaos',
      interval: 8,
      blessingRarityByRank: { Common: 'Common', Rare: 'Rare', Epic: 'Epic', Heroic: 'Heroic' },
    },
  },
] as const;

function replaceSupportedEffect(
  key: string,
  replace: (effect: Record<string, unknown>) => unknown,
): Parameters<typeof normalizeKeepsakes>[0] {
  return keepsakes.map((keepsake) =>
    keepsake.key === key
      ? { ...keepsake, effect: replace(keepsake.effect as unknown as Record<string, unknown>) }
      : keepsake,
  ) as never;
}

describe('keepsake normalization', () => {
  it('normalizes Gift Gift Gift exclusions and supported replay schedules exactly', () => {
    const normalized = normalizeKeepsakes(keepsakes);
    expect(
      normalized.values
        .filter((keepsake) => keepsake.echoGift.availability === 'excluded')
        .map((keepsake) => keepsake.key),
    ).toEqual([
      'EscalatingKeepsake',
      'AthenaEncounterKeepsake',
      'FountainRarityKeepsake',
      'HadesAndPersephoneKeepsake',
    ]);
    expect(normalized.byKey.SkipEncounterKeepsake?.echoGift).toEqual({
      availability: 'eligible',
      effect: { kind: 'figLeaf', schedule: 'oneShot' },
    });
    expect(normalized.byKey.TempHammerKeepsake?.echoGift).toEqual({
      availability: 'eligible',
      effect: { kind: 'experimentalHammer', schedule: 'oneShotAfterUnequipped' },
    });
    expect(normalized.byKey.UnpickedBoonKeepsake?.echoGift).toEqual({
      availability: 'eligible',
      effect: { kind: 'concaveStone', schedule: 'oneShot' },
    });
    expect(normalized.byKey.RarifyKeepsake?.echoGift).toEqual({
      availability: 'eligible',
      effect: { kind: 'callingCard', schedule: 'everyBiome' },
    });
    expect(normalized.byKey.GoldifyKeepsake?.echoGift).toEqual({
      availability: 'eligible',
      effect: { kind: 'timePiece', schedule: 'everyBiome' },
    });
    expect(normalized.byKey.ManaOverTimeRefundKeepsake?.echoGift).toEqual({
      availability: 'eligible',
      effect: { kind: 'modeledNeutral', schedule: 'noModeledEffect' },
    });

    const malformed = keepsakes.map((keepsake) =>
      keepsake.key === 'SkipEncounterKeepsake'
        ? {
            ...keepsake,
            echoGift: {
              availability: 'eligible' as const,
              effect: { kind: 'figLeaf' as const, schedule: 'everyBiome' as never },
            },
          }
        : keepsake,
    );
    expect(() => normalizeKeepsakes(malformed)).toThrow('must declare figLeaf/oneShot');
  });
  it('normalizes Calling Card only for the exact admitted trait-provider set', () => {
    const admitted = [
      'Zeus',
      'Hera',
      'Poseidon',
      'Demeter',
      'Apollo',
      'Aphrodite',
      'Hephaestus',
      'Hestia',
      'Ares',
      'Hermes',
      'Artemis',
      'Athena',
      'Dionysus',
    ];
    expect(
      catalog.traitGivers.values
        .filter((giver) => giver.callingCardMenu)
        .map((giver) => giver.key)
        .sort(),
    ).toEqual([...admitted].sort());
    for (const excluded of [
      'Hades',
      'WeaponUpgrade',
      'Icarus',
      'Circe',
      'Medea',
      'Narcissus',
      'Arachne',
    ]) {
      expect(catalog.traitGivers.byKey[excluded]?.callingCardMenu).toBe(false);
    }
  });

  it('rejects malformed rank and Fated inventory facts before catalog construction', () => {
    const wrongRank = keepsakes.map((keepsake) => ({ ...keepsake }));
    wrongRank[0] = { ...wrongRank[0]!, rank: 'Rare' as never };
    expect(() => normalizeKeepsakes(wrongRank)).toThrow('must be fixed rank III (Epic)');

    const wrongDisposition = keepsakes.map((keepsake) => ({ ...keepsake }));
    wrongDisposition[29] = { ...wrongDisposition[29]!, fatedDisposition: 'neutral' };
    expect(() => normalizeKeepsakes(wrongDisposition)).toThrow('expected enabling');

    expect(
      normalizeKeepsakes([...keepsakes].reverse()).values.map((keepsake) => keepsake.key),
    ).toEqual([...keepsakes].reverse().map((keepsake) => keepsake.key));

    const replaced = keepsakes.map((keepsake) => ({ ...keepsake }));
    replaced[0] = { ...replaced[0]!, key: 'UnknownKeepsake' };
    expect(() => normalizeKeepsakes(replaced)).toThrow(
      'must declare the exact authoritative ordinary keepsake inventory',
    );
  });

  it('normalizes the exact immutable supported rank matrix at fixed Epic selection', () => {
    const source = JSON.parse(JSON.stringify(keepsakes)) as Parameters<
      typeof normalizeKeepsakes
    >[0];
    const normalized = normalizeKeepsakes(source);
    expect(normalized.values.every((keepsake) => keepsake.rank === 'Epic')).toBe(true);
    expect(
      normalized.values
        .filter(
          (keepsake) =>
            keepsake.effect !== undefined &&
            keepsake.effect.kind !== 'olympianRewardPressure' &&
            keepsake.effect.kind !== 'moonBeam',
        )
        .map((keepsake) => keepsake.key),
    ).toEqual(supportedEffects.map((row) => row.key));

    const olympians = normalized.values.filter(
      (keepsake) => keepsake.effect?.kind === 'olympianRewardPressure',
    );
    expect(olympians).toHaveLength(9);
    expect(
      Object.fromEntries(
        olympians.map((keepsake) => [
          keepsake.key,
          keepsake.effect?.kind === 'olympianRewardPressure'
            ? keepsake.effect.providerKey
            : undefined,
        ]),
      ),
    ).toEqual({
      ForceZeusBoonKeepsake: 'Zeus',
      ForceHeraBoonKeepsake: 'Hera',
      ForcePoseidonBoonKeepsake: 'Poseidon',
      ForceDemeterBoonKeepsake: 'Demeter',
      ForceApolloBoonKeepsake: 'Apollo',
      ForceAphroditeBoonKeepsake: 'Aphrodite',
      ForceHephaestusBoonKeepsake: 'Hephaestus',
      ForceHestiaBoonKeepsake: 'Hestia',
      ForceAresBoonKeepsake: 'Ares',
    });
    for (const keepsake of olympians) {
      expect(keepsake.effect).toEqual(
        expect.objectContaining({
          priorityRewardType: 'Boon',
          providerForceUses: 1,
          providerRarificationUses: 1,
          maximumSourceRarityLevelByRank: { Common: 1, Rare: 2, Epic: 3 },
        }),
      );
      expect(keepsake.echoGift).toEqual({
        availability: 'eligible',
        effect: { kind: 'olympianRewardPressure', schedule: 'everyBiome' },
      });
    }

    expect(normalized.byKey.SpellTalentKeepsake?.effect).toEqual({
      kind: 'moonBeam',
      pathPointsByRank: { Common: 3, Rare: 4, Epic: 5, Heroic: 7 },
      priorityRewardTypes: ['SpellDrop', 'TalentDrop', 'TalentBigDrop'],
    });
    expect(normalized.byKey.SpellTalentKeepsake?.echoGift).toEqual({
      availability: 'eligible',
      effect: { kind: 'moonBeam', schedule: 'oneShotAfterUnequipped' },
    });

    for (const row of supportedEffects) {
      const declaration = normalized.byKey[row.key];
      const effect = declaration?.effect;
      const profile = (effect as unknown as Record<string, unknown> | undefined)?.[row.profileKey];
      expect(effect).toEqual(row.effect);
      expect(Object.isFrozen(declaration)).toBe(true);
      expect(Object.isFrozen(effect)).toBe(true);
      expect(Object.isFrozen(profile)).toBe(true);

      const sourceEffect = source.find((keepsake) => keepsake.key === row.key)
        ?.effect as unknown as Record<string, unknown> | undefined;
      const sourceProfile = sourceEffect?.[row.profileKey] as Record<string, unknown> | undefined;
      if (sourceProfile === undefined) throw new Error(`missing source profile for ${row.key}`);
      sourceProfile.Epic = 999;
      expect(profile).toEqual((row.effect as unknown as Record<string, unknown>)[row.profileKey]);
    }
  });

  it('rejects every wrong supported rank cell', () => {
    for (const row of supportedEffects) {
      const ranks =
        row.key === 'FountainRarityKeepsake'
          ? (['Common', 'Rare', 'Epic'] as const)
          : (['Common', 'Rare', 'Epic', 'Heroic'] as const);
      for (const rank of ranks) {
        const malformed = replaceSupportedEffect(row.key, (effect) => ({
          ...effect,
          [row.profileKey]: {
            ...(effect[row.profileKey] as Record<string, unknown>),
            [rank]: 999,
          },
        }));
        expect(() => normalizeKeepsakes(malformed), `${row.key}.${row.profileKey}.${rank}`).toThrow(
          'must equal',
        );
      }
    }
  });

  it('rejects missing, extra, malformed, and non-numeric supported rank data', () => {
    for (const row of supportedEffects) {
      const missing = replaceSupportedEffect(row.key, (effect) => {
        const profile = { ...(effect[row.profileKey] as Record<string, unknown>) };
        delete profile.Common;
        return { ...effect, [row.profileKey]: profile };
      });
      expect(() => normalizeKeepsakes(missing), `${row.key} missing rank`).toThrow('is required');

      const extra = replaceSupportedEffect(row.key, (effect) => ({
        ...effect,
        [row.profileKey]: {
          ...(effect[row.profileKey] as Record<string, unknown>),
          Legendary: 99,
        },
      }));
      expect(() => normalizeKeepsakes(extra), `${row.key} extra rank`).toThrow('is not supported');

      const malformed = replaceSupportedEffect(row.key, (effect) => ({
        ...effect,
        [row.profileKey]: [],
      }));
      expect(() => normalizeKeepsakes(malformed), `${row.key} malformed profile`).toThrow(
        'must be an object',
      );

      const nonNumeric = replaceSupportedEffect(row.key, (effect) => ({
        ...effect,
        [row.profileKey]: {
          ...(effect[row.profileKey] as Record<string, unknown>),
          Rare: 'two',
        },
      }));
      expect(() => normalizeKeepsakes(nonNumeric), `${row.key} non-numeric rank`).toThrow(
        row.key === 'RandomBlessingKeepsake' ? 'must equal Rare' : 'must be numeric',
      );
    }
  });

  it('enforces the exact supported descriptors and their effect-specific shape', () => {
    for (const row of supportedEffects) {
      expect(() => normalizeKeepsakes(replaceSupportedEffect(row.key, () => undefined))).toThrow(
        'must be an object',
      );
      expect(() =>
        normalizeKeepsakes(
          replaceSupportedEffect(row.key, (effect) => ({ ...effect, kind: 'unknownEffect' })),
        ),
      ).toThrow(/must declare/);
      expect(() =>
        normalizeKeepsakes(
          replaceSupportedEffect(row.key, (effect) => ({
            ...effect,
            [row.legacyField]: 999,
          })),
        ),
      ).toThrow('is not supported');
    }

    const neutral = keepsakes.find((keepsake) => keepsake.effect === undefined);
    if (neutral === undefined) throw new Error('missing effect-neutral keepsake declaration');
    expect(() =>
      normalizeKeepsakes(
        keepsakes.map((keepsake) =>
          keepsake.key === neutral.key
            ? { ...keepsake, effect: supportedEffects[1].effect as never }
            : keepsake,
        ),
      ),
    ).toThrow('is not supported by this keepsake');

    expect(() =>
      normalizeKeepsakes(
        replaceSupportedEffect('HadesAndPersephoneKeepsake', (effect) => ({
          ...effect,
          giverKey: 'Apollo',
        })),
      ),
    ).toThrow('must declare the Jeweled Pom rank profile and Hades giver');
    expect(() =>
      normalizeKeepsakes(
        replaceSupportedEffect('TempHammerKeepsake', (effect) => ({
          ...effect,
          giverKey: 'Apollo',
        })),
      ),
    ).toThrow('must declare the Experimental Hammer rank profile and giver');

    for (const [field, value] of [
      ['uses', 2],
      ['minimumBiomeDepth', 3],
      ['providerKey', 'Apollo'],
      ['naturalEncounterKey', 'GeneratedF'],
    ] as const) {
      expect(() =>
        normalizeKeepsakes(
          replaceSupportedEffect('AthenaEncounterKeepsake', (effect) => ({
            ...effect,
            [field]: value,
          })),
        ),
      ).toThrow(
        'must declare Gorgon Amulet one use, depth two, Athena provider, and natural encounter',
      );
    }
  });

  it('normalizes Time Piece’s fixed four charges and the closed concrete acquisition matrix', () => {
    expect(catalog.keepsakes.byKey.GoldifyKeepsake?.effect).toEqual({
      kind: 'timePiece',
      conversionChargesByRank: { Common: 2, Rare: 3, Epic: 4, Heroic: 5 },
    });
    const eligible = catalog.rewards.acquisitions.values
      .filter((acquisition) => acquisition.goldConversionEligible)
      .map((acquisition) => acquisition.gameName)
      .sort();
    expect(eligible).toEqual(
      [
        'AphroditeUpgrade',
        'ApolloUpgrade',
        'AresUpgrade',
        'DemeterUpgrade',
        'HephaestusUpgrade',
        'HeraUpgrade',
        'HermesUpgrade',
        'HestiaUpgrade',
        'PoseidonUpgrade',
        'ZeusUpgrade',
        'WeaponUpgrade',
        'TrialUpgrade',
        'SpellDrop',
        'EmptyMaxHealthSmallDrop',
        'EmptyMaxHealthDrop',
        'MaxHealthDrop',
        'MaxHealthDropBig',
        'MaxHealthDropSmall',
        'MaxManaDrop',
        'MaxManaDropBig',
        'MaxManaDropSmall',
        'TalentDrop',
        'TalentBigDrop',
        'MinorTalentDrop',
        'StackUpgrade',
        'StackUpgradeBig',
        'StackUpgradeTriple',
        'ArmorBoost',
        'ArmorBigBoost',
        'LastStandDrop',
        'RoomRewardConsolationPrize',
        'GiftDrop',
        'MetaCurrencyDrop',
        'MetaCurrencyBigDrop',
        'MetaCardPointsCommonDrop',
        'MetaCardPointsCommonBigDrop',
        'MemPointsCommonDrop',
      ].sort(),
    );
    for (const excluded of [
      'Currency',
      'BlindBoxLoot',
      'StoreRewardRandomStack',
      'ChaosWeaponUpgrade',
      'ElementalBoost',
    ]) {
      expect(catalog.rewards.acquisitions.byKey[excluded]?.goldConversionEligible).not.toBe(true);
    }
  });

  it('normalizes Transcendent Embryo’s Chaos blessing profile and Common Gift replay', () => {
    expect(catalog.keepsakes.byKey.RandomBlessingKeepsake?.effect).toEqual({
      kind: 'transcendentEmbryo',
      source: 'Chaos',
      interval: 8,
      blessingRarityByRank: { Common: 'Common', Rare: 'Rare', Epic: 'Epic', Heroic: 'Heroic' },
    });
    expect(catalog.keepsakes.byKey.RandomBlessingKeepsake?.echoGift).toEqual({
      availability: 'eligible',
      effect: { kind: 'transcendentEmbryo', schedule: 'oneShot' },
    });
  });

  it('rejects missing, unexpected, and malformed Time Piece acquisition capability facts', () => {
    const base = declarations.rewardKernel.acquisitions.map((acquisition) => ({ ...acquisition }));
    const createWith = (acquisitions: readonly unknown[]) =>
      createCatalog({
        ...declarations,
        rewardKernel: { ...declarations.rewardKernel, acquisitions: acquisitions as never },
      });

    expect(() =>
      createWith(
        base.map((acquisition) =>
          acquisition.gameName === 'ApolloUpgrade'
            ? { ...acquisition, goldConversionEligible: false }
            : acquisition,
        ),
      ),
    ).toThrow('exact Time Piece gold-conversion eligibility set');
    expect(() =>
      createWith(
        base.map((acquisition) =>
          acquisition.gameName === 'Currency'
            ? { ...acquisition, goldConversionEligible: true }
            : acquisition,
        ),
      ),
    ).toThrow('exact Time Piece gold-conversion eligibility set');
    expect(() =>
      createWith(
        base.map((acquisition) =>
          acquisition.gameName === 'ApolloUpgrade'
            ? { ...acquisition, goldConversionEligible: 'yes' }
            : acquisition,
        ),
      ),
    ).toThrow('goldConversionEligible: must be boolean');
    expect(() =>
      createWith(
        base.map((acquisition) =>
          acquisition.gameName === 'MemPointsCommonDrop'
            ? { ...acquisition, goldConversionEligible: false }
            : acquisition,
        ),
      ),
    ).toThrow('exact Time Piece gold-conversion eligibility set');
  });

  it('normalizes only the auto-activated Blind Box hidden source as a Time Piece role blocker', () => {
    expect(
      catalog.rewards.rewardTypes.byKey.BlindBoxLoot?.acquisitionRoles.values.map((role) => ({
        key: role.key,
        blocksGoldConversion: role.blocksGoldConversion === true,
      })),
    ).toEqual([
      { key: 'box', blocksGoldConversion: false },
      { key: 'hiddenSource', blocksGoldConversion: true },
    ]);
    expect(
      catalog.rewards.rewardTypes.values.flatMap((rewardType) =>
        rewardType.acquisitionRoles.values
          .filter((role) => role.blocksGoldConversion)
          .map((role) => `${rewardType.gameName}.${role.key}`),
      ),
    ).toEqual(['BlindBoxLoot.hiddenSource']);

    const createWithRoles = (
      replace: (rewardType: (typeof declarations.rewardKernel.rewardTypes)[number]) => unknown,
    ) =>
      createCatalog({
        ...declarations,
        rewardKernel: {
          ...declarations.rewardKernel,
          rewardTypes: declarations.rewardKernel.rewardTypes.map((rewardType) =>
            rewardType.gameName === 'BlindBoxLoot' ? replace(rewardType) : rewardType,
          ) as never,
        },
      });
    const blindBox = declarations.rewardKernel.rewardTypes.find(
      (rewardType) => rewardType.gameName === 'BlindBoxLoot',
    );
    if (blindBox === undefined) throw new Error('missing raw Blind Box declaration');

    expect(() =>
      createWithRoles((rewardType) => ({
        ...rewardType,
        acquisitionRoles: rewardType.acquisitionRoles.map((role) =>
          role.key === 'hiddenSource' ? { key: role.key, resolution: role.resolution } : role,
        ),
      })),
    ).toThrow('exact Time Piece role blocker');
    expect(() =>
      createWithRoles((rewardType) => ({
        ...rewardType,
        acquisitionRoles: rewardType.acquisitionRoles.map((role) =>
          role.key === 'box' ? { ...role, blocksGoldConversion: true } : role,
        ),
      })),
    ).toThrow('exact Time Piece role blocker');
    expect(() =>
      createWithRoles(() => ({
        ...blindBox,
        acquisitionRoles: blindBox.acquisitionRoles.map((role) =>
          role.key === 'hiddenSource' ? { ...role, blocksGoldConversion: 'yes' } : role,
        ),
      })),
    ).toThrow('blocksGoldConversion: must be boolean');
  });
});
