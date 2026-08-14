import { describe, expect, it } from 'vitest';

import { keepsakes } from '../../src/declarations/keepsakes';
import { normalizeKeepsakes } from '../../src/compiler/keepsakes';
import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';

describe('keepsake normalization', () => {
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

  it('normalizes the closed Jeweled Pom descriptor without retaining caller-owned effect state', () => {
    const source = keepsakes.map((keepsake) => ({
      ...keepsake,
      ...(keepsake.effect === undefined ? {} : { effect: { ...keepsake.effect } }),
    }));
    const pom = source.find((keepsake) => keepsake.key === 'HadesAndPersephoneKeepsake');
    if (pom?.effect?.kind !== 'jeweledPom') throw new Error('missing raw Jeweled Pom descriptor');
    const normalized = normalizeKeepsakes(source).byKey.HadesAndPersephoneKeepsake?.effect;
    expect(normalized).toEqual({
      kind: 'jeweledPom',
      giverKey: 'Hades',
      subsequentEligibleTraitLevels: 3,
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    (pom.effect as { giverKey: string }).giverKey = 'Apollo';
    expect(normalized).toMatchObject({ giverKey: 'Hades' });

    for (const effect of [
      { kind: 'jeweledPom', giverKey: 'Apollo', subsequentEligibleTraitLevels: 3 },
      { kind: 'jeweledPom', giverKey: 'Hades', subsequentEligibleTraitLevels: 2 },
    ]) {
      const malformed = keepsakes.map((keepsake) =>
        keepsake.key === 'HadesAndPersephoneKeepsake'
          ? { ...keepsake, effect: effect as never }
          : keepsake,
      );
      expect(() => normalizeKeepsakes(malformed)).toThrow(
        'must declare Jeweled Pom fixed +3 eligible-trait levels',
      );
    }
  });

  it('normalizes the closed Experimental Hammer descriptor and rejects malformed ownership facts', () => {
    const source = keepsakes.map((keepsake) => ({
      ...keepsake,
      ...(keepsake.effect === undefined ? {} : { effect: { ...keepsake.effect } }),
    }));
    const hammer = source.find((keepsake) => keepsake.key === 'TempHammerKeepsake');
    if (hammer?.effect?.kind !== 'experimentalHammer')
      throw new Error('missing raw Experimental Hammer descriptor');
    const normalized = normalizeKeepsakes(source).byKey.TempHammerKeepsake?.effect;
    expect(normalized).toEqual({
      kind: 'experimentalHammer',
      giverKey: 'WeaponUpgrade',
      qualifyingEncounterUses: 20,
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    (hammer.effect as { giverKey: string }).giverKey = 'Apollo';
    expect(normalized).toMatchObject({ giverKey: 'WeaponUpgrade' });

    for (const effect of [
      { kind: 'experimentalHammer', giverKey: 'Apollo', qualifyingEncounterUses: 20 },
      { kind: 'experimentalHammer', giverKey: 'WeaponUpgrade', qualifyingEncounterUses: 19 },
    ]) {
      const malformed = keepsakes.map((keepsake) =>
        keepsake.key === 'TempHammerKeepsake' ? { ...keepsake, effect: effect as never } : keepsake,
      );
      expect(() => normalizeKeepsakes(malformed)).toThrow(
        'must declare Experimental Hammer giver and fixed 20 qualifying encounter uses',
      );
    }
  });

  it("normalizes Calling Card's fixed six-charge descriptor and rejects malformed charges", () => {
    const source = keepsakes.map((keepsake) => ({
      ...keepsake,
      ...(keepsake.effect === undefined ? {} : { effect: { ...keepsake.effect } }),
    }));
    const callingCard = source.find((keepsake) => keepsake.key === 'RarifyKeepsake');
    if (callingCard?.effect?.kind !== 'callingCard')
      throw new Error('missing raw Calling Card descriptor');
    expect(normalizeKeepsakes(source).byKey.RarifyKeepsake?.effect).toEqual({
      kind: 'callingCard',
      rarificationCharges: 6,
    });
    const malformed = source.map((keepsake) =>
      keepsake.key === 'RarifyKeepsake'
        ? { ...keepsake, effect: { kind: 'callingCard', rarificationCharges: 5 } as never }
        : keepsake,
    );
    expect(() => normalizeKeepsakes(malformed)).toThrow(
      'must declare Calling Card fixed six rarification charges',
    );
  });

  it('normalizes Time Piece’s fixed four charges and the closed concrete acquisition matrix', () => {
    expect(catalog.keepsakes.byKey.GoldifyKeepsake?.effect).toEqual({
      kind: 'timePiece',
      conversionCharges: 4,
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
        'SpellDrop',
        'EmptyMaxHealthSmallDrop',
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
        'GiftDrop',
        'MetaCurrencyDrop',
        'MetaCurrencyBigDrop',
        'MetaCardPointsCommonDrop',
        'MetaCardPointsCommonBigDrop',
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
