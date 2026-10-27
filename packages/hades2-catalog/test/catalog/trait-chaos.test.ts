import { describe, expect, it } from 'vitest';

import type { ChaosNumericOperand } from '@run-planner/engine/catalog-schema';

import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';

describe('Chaos compiler owner', () => {
  it('publishes a legal midpoint default and declaration-owned duration label for every Chaos numeric domain', () => {
    const snap = (minimum: number, maximum: number, step: number) =>
      Number(
        (minimum + Math.floor((maximum - minimum) / 2 / step + 0.5 + 1e-9) * step).toFixed(12),
      );
    for (const curse of catalog.chaos.curses.values) {
      expect(curse.duration.label).toBe(
        curse.semanticTag === 'Ordinary'
          ? 'Common Boons'
          : curse.semanticTag === 'Rejected'
            ? 'Limited Offers'
            : curse.clock === 'encounters'
              ? 'Encounters'
              : curse.clock === 'locations'
                ? 'Locations'
                : 'God-offer resolutions',
      );
      expect(curse.duration.authoringDefault).toBe(
        snap(curse.duration.minimum, curse.duration.maximum, curse.duration.step),
      );
      for (const operand of curse.operands) {
        expect(operand.authoringDefault).toBe(snap(operand.minimum, operand.maximum, operand.step));
      }
    }
    for (const blessing of catalog.chaos.blessings.values) {
      for (const operand of blessing.operands) {
        expect(operand.authoringDefault).toBe(snap(operand.minimum, operand.maximum, operand.step));
        for (const domain of Object.values(operand.byRarity ?? {})) {
          if (domain === undefined) continue;
          expect(domain.authoringDefault).toBe(snap(domain.minimum, domain.maximum, domain.step));
        }
      }
    }
  });

  it('declares the complete closed Chaos pair matrix and fixed derived outcomes', () => {
    expect(catalog.chaos.curses.values).toHaveLength(17);
    expect(catalog.chaos.blessings.values).toHaveLength(16);
    expect(
      catalog.rewards.rewardTypes.byKey.TrialUpgrade?.acquisitionRoles.byKey.self?.traitGiverKey,
    ).toBe('Chaos');
    expect(catalog.traitGiverByAcquisitionGameName.TrialUpgrade).toBeUndefined();
    expect(catalog.traitGiverByAcquisitionGameName).toEqual(
      Object.fromEntries(
        declarations.traitCatalog.traitAcquisitionProviders.map(({ gameName, giverKey }) => [
          gameName,
          giverKey,
        ]),
      ),
    );
    expect(catalog.chaos.curses.byKey.ChaosCommonCurse).toMatchObject({
      label: 'Ordinary',
      clock: 'godBoonScreens',
      semanticTag: 'Ordinary',
      duration: { minimum: 2, maximum: 3, label: 'Common Boons' },
    });
    expect(catalog.chaos.curses.byKey.ChaosRestrictBoonCurse?.duration.label).toBe(
      'Limited Offers',
    );
    expect(catalog.chaos.curses.byKey.ChaosHiddenRoomRewardCurse).toMatchObject({
      label: 'Enshrouded',
      clock: 'locations',
      offerRequirements: [{ kind: 'routeKey', routeKey: 'Underworld' }],
    });
    expect(catalog.chaos.blessings.byKey.ChaosElementalBlessing).toMatchObject({
      label: 'Creation',
      semanticTag: 'Creation',
      derivedOutcome: {
        kind: 'creation',
        elementsPerElementByRarity: { Common: 1, Rare: 2, Epic: 3, Heroic: 4 },
      },
    });
    expect(catalog.chaos.blessings.byKey.ChaosSpeedBlessing).toMatchObject({
      label: 'Celerity',
      derivedOutcome: {
        kind: 'celerity',
        moveSpeedPercentByRarity: { Common: 15, Rare: 20, Epic: 25, Heroic: 30 },
        sprintVelocityByRarity: { Common: 297, Rare: 396, Epic: 495, Heroic: 594 },
        sprintCapByRarity: { Common: 133.5, Rare: 178, Epic: 222.5, Heroic: 267 },
      },
    });
    expect(catalog.chaos.blessings.byKey.ChaosOmegaDamageBlessing).toMatchObject({
      label: 'Chant',
      derivedOutcome: {
        kind: 'chant',
        damagePerAetherPercentByRarity: { Common: 30, Rare: 36, Epic: 42, Heroic: 48 },
      },
      offerRequirements: [{ kind: 'elementMinimum', element: 'Aether', minimum: 1 }],
    });
    expect(catalog.chaos.blessings.byKey.ChaosLastStandBlessing).toMatchObject({
      label: 'Defiance',
      fixedRarity: 'Legendary',
      derivedOutcome: { kind: 'defiance', healthPercent: 40, magickPercent: 40 },
    });
    expect(catalog.chaos.rarity).toEqual({
      itemOverride: { Rare: 0.4, Epic: 0.1, Duo: 0, Legendary: 0.05 },
      rollOrder: ['Common', 'Rare', 'Epic'],
    });
    const revelation = catalog.chaos.blessings.byKey.ChaosExSpeedBlessing;
    expect(revelation?.operands.map((operand) => operand.key)).toEqual([
      'weaponSpeed',
      'propertySpeed',
    ]);
    for (const blessing of catalog.chaos.blessings.values) {
      for (const operand of blessing.operands) {
        expect(Object.keys(operand.byRarity ?? {}).sort()).toEqual([
          'Common',
          'Epic',
          'Heroic',
          'Rare',
        ]);
      }
    }
  });

  it.each([
    ['unknown kind', { kind: 'invented' }],
    ['extra member', { kind: 'matureChaosBlessing', extra: true }],
    ['invalid element', { kind: 'elementMinimum', element: 'Void', minimum: 1 }],
    ['zero element minimum', { kind: 'elementMinimum', element: 'Aether', minimum: 0 }],
  ])('rejects malformed Chaos offer requirement: %s', (_label, requirement) => {
    const malformed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        chaos: {
          ...declarations.traitCatalog.chaos,
          blessings: declarations.traitCatalog.chaos.blessings.map((blessing) =>
            blessing.key === 'ChaosOmegaDamageBlessing'
              ? { ...blessing, offerRequirements: [requirement] as never }
              : blessing,
          ),
        },
      },
    };
    expect(() => createCatalog(malformed)).toThrow(
      /unknown Chaos offer requirement|must contain only kind|known element|positive integer/,
    );
  });

  it.each([
    [
      'moves Creation outcome',
      'ChaosWeaponBlessing',
      { kind: 'creation', elementsPerElementByRarity: { Common: 1, Rare: 2, Epic: 3, Heroic: 4 } },
    ],
    [
      'changes Celerity outcome',
      'ChaosSpeedBlessing',
      {
        kind: 'celerity',
        moveSpeedPercentByRarity: { Common: 16, Rare: 20, Epic: 25, Heroic: 30 },
        sprintVelocityByRarity: { Common: 297, Rare: 396, Epic: 495, Heroic: 594 },
        sprintCapByRarity: { Common: 133.5, Rare: 178, Epic: 222.5, Heroic: 267 },
      },
    ],
  ])('rejects a %s mutation', (_label, key, derivedOutcome) => {
    const malformed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        chaos: {
          ...declarations.traitCatalog.chaos,
          blessings: declarations.traitCatalog.chaos.blessings.map((blessing) =>
            blessing.key === key
              ? { ...blessing, derivedOutcome: derivedOutcome as never }
              : blessing,
          ),
        },
      },
    };
    expect(() => createCatalog(malformed)).toThrow(/derivedOutcome/);
  });

  it('rejects extra rarity-domain fields and authored operands on fixed Chaos outcomes', () => {
    const weapon = declarations.traitCatalog.chaos.blessings.find(
      (blessing) => blessing.key === 'ChaosWeaponBlessing',
    );
    if (weapon === undefined) throw new Error('Chaos weapon blessing declaration is missing');
    const damage = weapon.operands[0];
    if (damage?.byRarity === undefined) throw new Error('Chaos damage rarity domains are missing');
    const damageDomains = damage.byRarity;
    const extraDomain = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        chaos: {
          ...declarations.traitCatalog.chaos,
          blessings: declarations.traitCatalog.chaos.blessings.map((blessing) =>
            blessing.key !== 'ChaosWeaponBlessing'
              ? blessing
              : {
                  ...blessing,
                  operands: [
                    {
                      ...damage,
                      byRarity: {
                        ...damageDomains,
                        Common: { ...damageDomains.Common, invented: true },
                      },
                    },
                  ],
                },
          ),
        },
      },
    };
    expect(() => createCatalog(extraDomain as never)).toThrow(/unknown domain key/);

    const derivedOperand = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        chaos: {
          ...declarations.traitCatalog.chaos,
          blessings: declarations.traitCatalog.chaos.blessings.map((blessing) =>
            blessing.key === 'ChaosElementalBlessing'
              ? { ...blessing, operands: weapon.operands }
              : blessing,
          ),
        },
      },
    };
    expect(() => createCatalog(derivedOperand as never)).toThrow(
      /fixed Chaos outcomes cannot own authored operands/,
    );
  });

  it('declares where the save keeps every rolled operand', () => {
    const saved = (
      entries: readonly {
        readonly key: string;
        readonly operands: readonly ChaosNumericOperand[];
      }[],
    ) =>
      Object.fromEntries(
        entries
          .filter((entry) => entry.operands.length > 0)
          .map((entry) => [
            entry.key,
            Object.fromEntries(
              entry.operands.map((operand) => [
                operand.key,
                `${operand.saveField?.path} ${operand.saveField?.relation}`,
              ]),
            ),
          ]),
      );
    expect(catalog.chaos.pendingBlessingSavePath).toBe('OnExpire.TraitData');
    expect(saved(catalog.chaos.curses.values)).toEqual({
      ChaosHealthCurse: { healthPenalty: 'PropertyChanges.1.ChangeValue value' },
      ChaosDamageCurse: {
        damageTaken: 'AddIncomingDamageModifiers.ValidWeaponMultiplier deltaFromOne',
      },
      ChaosPrimaryAttackCurse: { selfDamage: 'DamageOnFireWeapons.Damage value' },
      ChaosSecondaryAttackCurse: { selfDamage: 'DamageOnFireWeapons.Damage value' },
      ChaosSpeedCurse: { speedMultiplier: 'PropertyChanges.2.ChangeValue value' },
      ChaosExAttackCurse: { selfDamage: 'OnWeaponFiredFunctions.FunctionArgs.Damage value' },
      ChaosCastCurse: { selfDamage: 'OnWeaponFiredFunctions.FunctionArgs.Damage value' },
      ChaosDashCurse: { magickLoss: 'OnWeaponFiredFunctions.FunctionArgs.Cost value' },
      ChaosStunCurse: {
        stunDuration: 'OnSelfDamagedFunction.FunctionArgs.DataProperties.Duration value',
      },
    });
    expect(saved(catalog.chaos.blessings.values)).toEqual({
      ChaosWeaponBlessing: {
        damageBonus: 'AddOutgoingDamageModifiers.ValidWeaponMultiplier deltaFromOne',
      },
      ChaosSpecialBlessing: {
        damageBonus: 'AddOutgoingDamageModifiers.ValidWeaponMultiplier deltaFromOne',
      },
      ChaosCastBlessing: {
        damageBonus: 'AddOutgoingDamageModifiers.ValidWeaponMultiplier deltaFromOne',
      },
      ChaosHealthBlessing: { health: 'PropertyChanges.1.ChangeValue value' },
      ChaosManaBlessing: { magick: 'PropertyChanges.1.ChangeValue value' },
      ChaosManaOverTimeBlessing: { magickPerSecond: 'SetupFunction.Args.ManaRegenPerSecond value' },
      ChaosExSpeedBlessing: {
        weaponSpeed: 'WeaponSpeedMultiplier.Value value',
        propertySpeed: 'PropertyChanges.1.ChangeValue value',
      },
      ChaosRarityBlessing: { rareBonus: 'RarityBonus.Rare value' },
      ChaosMoneyBlessing: { moneyBonus: 'MoneyMultiplier deltaFromOne' },
      ChaosManaCostBlessing: { costReduction: 'ManaCostModifiers.ManaCostMultiplier oneMinus' },
      ChaosDoorHealBlessing: { heal: 'DoorHealIgnorePenaltyFixed value' },
      ChaosHarvestBlessing: { doubleChance: 'DoubleToolRewardChance value' },
    });
    // The duration is the saved RemainingUses the record carries itself.
    for (const curse of catalog.chaos.curses.values)
      expect(curse.duration.saveField).toBeUndefined();
  });

  const withOperand = (
    curseKey: string,
    change: (operand: ChaosNumericOperand) => Record<string, unknown>,
  ) => ({
    ...declarations,
    traitCatalog: {
      ...declarations.traitCatalog,
      chaos: {
        ...declarations.traitCatalog.chaos,
        curses: declarations.traitCatalog.chaos.curses.map((curse) =>
          curse.key === curseKey
            ? { ...curse, operands: curse.operands.map((operand) => change(operand)) }
            : curse,
        ),
      },
    },
  });

  it.each([
    [
      'a rolled operand without a save field',
      (operand: ChaosNumericOperand) =>
        Object.fromEntries(Object.entries(operand).filter(([key]) => key !== 'saveField')),
      /is required for a rolled operand/,
    ],
    [
      'a path with a zero array key',
      (operand: ChaosNumericOperand) => ({
        ...operand,
        saveField: { path: 'PropertyChanges.0.ChangeValue', relation: 'value' },
      }),
      /dotted save-table path/,
    ],
    [
      'an unknown relation',
      (operand: ChaosNumericOperand) => ({
        ...operand,
        saveField: { path: 'PropertyChanges.1.ChangeValue', relation: 'scaled' },
      }),
      /must be one of value, deltaFromOne, oneMinus/,
    ],
    [
      'an extra save-field member',
      (operand: ChaosNumericOperand) => ({
        ...operand,
        saveField: { ...operand.saveField, rounding: 2 },
      }),
      /requires only path and relation/,
    ],
  ])('rejects %s', (_label, change, message) => {
    expect(() => createCatalog(withOperand('ChaosHealthCurse', change) as never)).toThrow(message);
  });

  it('rejects a duration save field, a shared operand field and a missing pending path', () => {
    const duration = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        chaos: {
          ...declarations.traitCatalog.chaos,
          curses: declarations.traitCatalog.chaos.curses.map((curse) =>
            curse.key === 'ChaosDashCurse'
              ? {
                  ...curse,
                  duration: {
                    ...curse.duration,
                    saveField: { path: 'RemainingUses', relation: 'value' },
                  },
                }
              : curse,
          ),
        },
      },
    };
    expect(() => createCatalog(duration as never)).toThrow(/is not declared for a duration/);
    const shared = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        chaos: {
          ...declarations.traitCatalog.chaos,
          blessings: declarations.traitCatalog.chaos.blessings.map((blessing) =>
            blessing.key === 'ChaosExSpeedBlessing'
              ? {
                  ...blessing,
                  operands: blessing.operands.map((operand) => ({
                    ...operand,
                    saveField: { path: 'WeaponSpeedMultiplier.Value', relation: 'value' },
                  })),
                }
              : blessing,
          ),
        },
      },
    };
    expect(() => createCatalog(shared as never)).toThrow(/reads one saved field for two operands/);
    const chaos = Object.fromEntries(
      Object.entries(declarations.traitCatalog.chaos).filter(
        ([key]) => key !== 'pendingBlessingSavePath',
      ),
    );
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: { ...declarations.traitCatalog, chaos },
      } as never),
    ).toThrow(/pendingBlessingSavePath/);
  });
});
