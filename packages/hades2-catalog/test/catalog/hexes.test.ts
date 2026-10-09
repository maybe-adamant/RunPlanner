import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '../../src';
import type { RawCatalogInput } from '../../src/declarations';
import { cloneCatalogInput } from './support/catalog-input';

type MutableHexNode = {
  slot: number;
  kind?: string;
  linkTo?: number[];
  bidirectional?: boolean;
};

type MutableHexDeclaration = {
  epicCandidates: { key: string }[];
  rareCandidates: { key: string }[];
  repeatableCandidates: { key: string; label: string; maxCount?: number }[];
  layouts: { key: string; structure: MutableHexNode[][] }[];
  godSent: { forceKeepsakeKey: string };
};

const cloneDeclarations = cloneCatalogInput;

function mutableFirstHex(input: RawCatalogInput): MutableHexDeclaration {
  const hex = input.traitCatalog.hexes[0];
  if (hex === undefined) throw new Error('first Hex declaration is missing');
  return hex as unknown as MutableHexDeclaration;
}

// [base capacity, Rare, Epic, repeatable nodes]
const layoutFacts = {
  Lung: [16, 2, 1, 13],
  Pyramid: [18, 3, 1, 14],
  Maze: [22, 3, 2, 17],
  Nacelle: [18, 3, 2, 13],
} as const;

const godSentNodes = {
  Lung: ['5:3', '6:1'],
  Pyramid: ['4:3', '5:2'],
  Maze: ['5:7', '6:3'],
  Nacelle: ['4:5', '5:3'],
} as const;

/** The first Hex declaration's copy of one layout. */
function mutableLayout(input: RawCatalogInput, key: string) {
  const layout = mutableFirstHex(input).layouts.find((candidate) => candidate.key === key);
  if (layout === undefined) throw new Error(`layout ${key} is missing`);
  return layout;
}

const hexFacts = {
  SpellPolymorphTrait: {
    repeatable: [
      'CooldownDamageTalent',
      'ChargeRegenTalent',
      'PolymorphDurationTalent',
      'PolymorphDamageTalent',
    ],
    rare: [
      'PolymorphBossDamageTalent',
      'PolymorphDeathExplodeTalent',
      'PolymorphTauntTalent',
      'PolymorphTeleportCastTalent',
      'PolymorphHealthCrushTalent',
    ],
    epic: ['PolymorphSandwichTalent', 'PolymorphCurseTalent'],
    provider: 'Zeus',
    keepsake: 'ForceZeusBoonKeepsake',
    olympian: 'PolymorphZeusTalent',
  },
  SpellMeteorTrait: {
    repeatable: [
      'CooldownDamageTalent',
      'PreChargeTalent',
      'MeteorSizeTalent',
      'MeteorDamageTalent',
    ],
    rare: [
      'MeteorVulnerabilityDecalTalent',
      'MeteorSlowDecalTalent',
      'MeteorShowerTalent',
      'MeteorChargeTalent',
    ],
    epic: ['MeteorInvulnerableChargeTalent', 'MeteorDoubleTalent', 'MeteorExCastTalent'],
    provider: 'Hestia',
    keepsake: 'ForceHestiaBoonKeepsake',
    olympian: 'MeteorHestiaTalent',
  },
  SpellTransformTrait: {
    repeatable: [
      'TransformDurationTalent',
      'TransformDamageTalent',
      'TransformCooldownDodgeTalent',
      'ChargeRegenTalent',
    ],
    rare: [
      'TransformCastDamageTalent',
      'TransformLastStandRechargeTalent',
      'TransformAttackSpeedTalent',
      'TransformSpecialTalent',
    ],
    epic: ['TransformPrimaryTalent', 'TransformSpecialCritTalent', 'TransformExCastTalent'],
    provider: 'Aphrodite',
    keepsake: 'ForceAphroditeBoonKeepsake',
    olympian: 'TransformAphroditeTalent',
  },
  SpellLeapTrait: {
    repeatable: [
      'ChargeRegenTalent',
      'LeapDamageTalent',
      'LeapArmorDamageTalent',
      'LeapCooldownSpeedTalent',
    ],
    rare: ['LeapLaunchAoETalent', 'LeapAoETalent', 'LeapCritTalent', 'LeapSprintTalent'],
    epic: ['LeapShieldTalent', 'LeapTwiceTalent'],
    provider: 'Hephaestus',
    keepsake: 'ForceHephaestusBoonKeepsake',
    olympian: 'LeapHephaestusTalent',
  },
  SpellLaserTrait: {
    repeatable: [
      'CooldownDamageTalent',
      'ChargeRegenTalent',
      'LaserDamageTalent',
      'LaserDefenseTalent',
    ],
    rare: [
      'LaserAoETalent',
      'LaserStartAoETalent',
      'LaserPenetrationTalent',
      'LaserDurationTalent',
      'LaserFirstHitDamageTalent',
    ],
    epic: ['LaserTripleTalent', 'LaserCrystalTalent'],
    provider: 'Apollo',
    keepsake: 'ForceApolloBoonKeepsake',
    olympian: 'LaserApolloTalent',
  },
  SpellSummonTrait: {
    repeatable: [
      'CooldownDamageTalent',
      'ChargeRegenTalent',
      'PreChargeTalent',
      'SummonDamageTalent',
    ],
    rare: [
      'SummonSpeedTalent',
      'SummonTeleportTalent',
      'SummonPermanenceTalent',
      'SummonRetaliateTalent',
    ],
    epic: ['SummonDamageSplitTalent', 'SummonExplodeTalent'],
    provider: 'Hera',
    keepsake: 'ForceHeraBoonKeepsake',
    olympian: 'SummonHeraTalent',
  },
  SpellTimeSlowTrait: {
    repeatable: [
      'PreChargeTalent',
      'ChargeRegenTalent',
      'TimeSlowAmountTalent',
      'CooldownDefenseTalent',
    ],
    rare: [
      'TimeSlowDestroyProjectilesTalent',
      'TimeSlowSpeedTalent',
      'TimeSlowLastStandRechargeTalent',
      'TimeSlowCumulativeBuffTalent',
    ],
    epic: ['TimeSlowCritTalent', 'TimeSlowFreezeTimeTalent'],
    provider: 'Demeter',
    keepsake: 'ForceDemeterBoonKeepsake',
    olympian: 'TimeSlowDemeterTalent',
  },
  SpellPotionTrait: {
    repeatable: [
      'PotionManaRestoreTalent',
      'PotionUsesTalent',
      'HealAmountTalent',
      'CurrencyUseTalent',
    ],
    rare: ['DamageBuffTalent', 'ShieldTalent', 'RolloverUsesTalent', 'HealLastTalent'],
    epic: ['ClearCastTalent', 'HealRetaliateTalent', 'PotionExCastTalent'],
    provider: 'Poseidon',
    keepsake: 'ForcePoseidonBoonKeepsake',
    olympian: 'PotionPoseidonTalent',
  },
  SpellMoonBeamTrait: {
    repeatable: [
      'ChargeRegenTalent',
      'MoonBeamVulnerabilityTalent',
      'MoonBeamDamageTalent',
      'MoonBeamCountTalent',
    ],
    rare: ['MoonBeamConsecutiveDamageTalent', 'MoonBeamDefenseTalent', 'MoonBeamPrimaryTalent'],
    epic: ['MoonBeamTargetTalent', 'MoonBeamExBeamBonusTalent'],
    provider: 'Ares',
    keepsake: 'ForceAresBoonKeepsake',
    olympian: 'MoonBeamAresTalent',
  },
} as const;

describe('compiled Hex declarations', () => {
  it('contains every audited layout capacity and node count', () => {
    expect(catalog.hexes.values).toHaveLength(9);
    for (const hex of catalog.hexes.values) {
      expect(
        hex.layouts.values.map((layout) => [
          layout.key,
          layout.baseCapacity,
          layout.rareCount,
          layout.epicCount,
          layout.nodes.values.filter((node) => node.kind === 'repeatable').length,
        ]),
      ).toEqual(Object.entries(layoutFacts).map(([key, facts]) => [key, ...facts]));
      for (const layout of hex.layouts.values)
        expect(
          layout.nodes.values
            .filter((node) => node.kind === 'olympianSpell' || node.kind === 'olympianCount')
            .map((node) => node.key),
        ).toEqual(godSentNodes[layout.key]);
    }
  });

  it('keys nodes by depth and slot in layout order with derived backlinks', () => {
    const lung = catalog.hexes.byKey.SpellPolymorphTrait!.layouts.byKey.Lung!;
    expect(lung.nodes.values.map((node) => node.key)).toEqual([
      '1:2',
      '1:4',
      '2:2',
      '2:4',
      '3:1',
      '3:2',
      '3:3',
      '3:4',
      '3:5',
      '3:6',
      '4:1',
      '4:3',
      '4:5',
      '5:2',
      '5:3',
      '5:4',
      '6:1',
      '6:3',
    ]);
    expect(lung.nodes.byKey['4:3']).toMatchObject({ linkTo: [2, 3, 4], linkFrom: [2, 4] });
    expect(lung.nodes.byKey['6:3']).toMatchObject({ kind: 'legendary', linkFrom: [2, 4] });
    expect(lung.nodes.byKey['6:1']).toMatchObject({
      kind: 'olympianCount',
      linkFrom: [3],
      gridOffsetX: -0.65,
      gridOffsetY: 2,
    });
    const nacelle = catalog.hexes.byKey.SpellPolymorphTrait!.layouts.byKey.Nacelle!;
    expect(nacelle.nodes.byKey['3:0']).toMatchObject({ slot: 0, linkFrom: [2] });
    expect(nacelle.nodes.byKey['2:4']).toMatchObject({
      bidirectional: true,
      linkTo: [3, 4, 5, 6],
      linkFrom: [4],
    });
    expect(nacelle.nodes.byKey['3:3']!.linkFrom).toEqual([2, 4]);
    expect(
      nacelle.nodes.values.filter((node) => node.bidirectional).map((node) => node.key),
    ).toEqual(['2:2', '2:4']);
  });

  it('declares the source MaxCount on shared repeatable talents', () => {
    const summon = catalog.hexes.byKey.SpellSummonTrait!.repeatableCandidates.byKey;
    expect(summon.ChargeRegenTalent).toEqual({
      key: 'ChargeRegenTalent',
      label: 'Growth',
      maxCount: 1,
    });
    expect(summon.PreChargeTalent).toEqual({
      key: 'PreChargeTalent',
      label: 'Preparation',
      maxCount: 2,
    });
    expect(summon.CooldownDamageTalent).toEqual({ key: 'CooldownDamageTalent', label: 'Purpose' });
  });

  it('rejects malformed layout graphs', () => {
    const missingTarget = cloneDeclarations();
    mutableLayout(missingTarget, 'Lung').structure[0]![0]!.linkTo = [3];
    expect(() => createCatalog(missingTarget)).toThrow(/references missing node 2:3/);

    const unlinked = cloneDeclarations();
    mutableLayout(unlinked, 'Lung').structure[0]![0]!.linkTo = [];
    expect(() => createCatalog(unlinked)).toThrow(/must be linked from the previous depth/);

    const unordered = cloneDeclarations();
    mutableLayout(unordered, 'Maze').structure[1]!.reverse();
    expect(() => createCatalog(unordered)).toThrow(/slots must ascend within a depth/);

    const godSentOnly = cloneDeclarations();
    const lung = mutableLayout(godSentOnly, 'Lung');
    lung.structure[4]![0]!.linkTo = [];
    lung.structure[4]![2]!.linkTo = [];
    lung.structure[4]![1]!.linkTo = [1, 3];
    expect(() => createCatalog(godSentOnly)).toThrow(/reachable without the God Sent pair/);

    const secondDuo = cloneDeclarations();
    mutableLayout(secondDuo, 'Pyramid').structure[0]![0]!.kind = 'olympianSpell';
    expect(() => createCatalog(secondDuo)).toThrow(/exactly one God Sent pair/);

    const lonelyBidirectional = cloneDeclarations();
    mutableLayout(lonelyBidirectional, 'Lung').structure[2]![2]!.bidirectional = true;
    expect(() => createCatalog(lonelyBidirectional)).toThrow(/requires links to the next depth/);
  });

  it('rejects pools that cannot fill a layout', () => {
    const shortRare = cloneDeclarations();
    const hex = mutableFirstHex(shortRare);
    hex.rareCandidates.splice(2);
    expect(() => createCatalog(shortRare)).toThrow(/must fill every Keystone and Legendary node/);

    const bounded = cloneDeclarations();
    for (const talent of mutableFirstHex(bounded).repeatableCandidates) talent.maxCount = 3;
    expect(() => createCatalog(bounded)).toThrow(/refills never run out/);

    const inconsistent = cloneDeclarations();
    const charge = inconsistent.traitCatalog.hexes[1]!.repeatableCandidates.find(
      (talent) => talent.key === 'PreChargeTalent',
    ) as { maxCount?: number };
    charge.maxCount = 3;
    expect(() => createCatalog(inconsistent)).toThrow(/must match its other declarations/);
  });

  it('contains exact Rare/Epic pools and linked God Sent pairs', () => {
    for (const [spellTraitKey, expected] of Object.entries(hexFacts)) {
      const hex = catalog.hexes.byKey[spellTraitKey];
      expect(hex).toBeDefined();
      expect(hex!.rareCandidates.values.map((candidate) => candidate.key)).toEqual(expected.rare);
      expect(hex!.epicCandidates.values.map((candidate) => candidate.key)).toEqual(expected.epic);
      expect(hex!.repeatableCandidates.values.map((candidate) => candidate.key)).toEqual(
        expected.repeatable,
      );
      expect(hex!.godSent.providerKey).toBe(expected.provider);
      expect(hex!.godSent.forceKeepsakeKey).toBe(expected.keepsake);
      expect(hex!.godSent.olympianTalentKey).toBe(expected.olympian);
      expect(hex!.godSent.lineageTalentKey).toBe('OlympianSpellCountTalent');
      expect(hex!.godSent.capacityDelta).toBe(2);
    }
  });

  it('rejects cross-pool node collisions and mismatched provider keepsakes', () => {
    const duplicate = cloneDeclarations();
    const duplicateHex = mutableFirstHex(duplicate);
    duplicateHex.epicCandidates[0]!.key = duplicateHex.rareCandidates[0]!.key;
    expect(() => createCatalog(duplicate)).toThrow(/Hex talent keys must be unique across pools/);

    const wrongKeepsake = cloneDeclarations();
    const wrongKeepsakeHex = mutableFirstHex(wrongKeepsake);
    wrongKeepsakeHex.godSent.forceKeepsakeKey = 'ForceHestiaBoonKeepsake';
    expect(() => createCatalog(wrongKeepsake)).toThrow(/must be ForceZeusBoonKeepsake/);
  });
});
