import { describe, expect, it } from 'vitest';

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
          ? 'Forced common boons'
          : curse.semanticTag === 'Rejected'
            ? 'Fewer offer boons'
            : curse.clock === 'encounters'
              ? 'encounters'
              : curse.clock === 'locations'
                ? 'locations / departures'
                : 'god-offer resolutions',
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
      duration: { minimum: 2, maximum: 3, label: 'Forced common boons' },
    });
    expect(catalog.chaos.curses.byKey.ChaosRestrictBoonCurse?.duration.label).toBe(
      'Fewer offer boons',
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
});
