import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '../../src';
import { declarations, type RawCatalogInput } from '../../src/declarations';

type MutableHexDeclaration = {
  epicCandidates: { key: string }[];
  rareCandidates: { key: string }[];
  godSent: { forceKeepsakeKey: string };
};

function cloneDeclarations(): RawCatalogInput {
  return JSON.parse(JSON.stringify(declarations)) as RawCatalogInput;
}

function mutableFirstHex(input: RawCatalogInput): MutableHexDeclaration {
  const hex = input.traitCatalog.hexes[0];
  if (hex === undefined) throw new Error('first Hex declaration is missing');
  return hex as unknown as MutableHexDeclaration;
}

const layoutFacts = {
  Lung: [16, 2, 1],
  Pyramid: [18, 3, 1],
  Maze: [22, 3, 2],
  Nacelle: [18, 3, 2],
} as const;

const hexFacts = {
  SpellPolymorphTrait: {
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
    rare: ['LeapLaunchAoETalent', 'LeapAoETalent', 'LeapCritTalent', 'LeapSprintTalent'],
    epic: ['LeapShieldTalent', 'LeapTwiceTalent'],
    provider: 'Hephaestus',
    keepsake: 'ForceHephaestusBoonKeepsake',
    olympian: 'LeapHephaestusTalent',
  },
  SpellLaserTrait: {
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
    rare: ['DamageBuffTalent', 'ShieldTalent', 'RolloverUsesTalent', 'HealLastTalent'],
    epic: ['ClearCastTalent', 'HealRetaliateTalent', 'PotionExCastTalent'],
    provider: 'Poseidon',
    keepsake: 'ForcePoseidonBoonKeepsake',
    olympian: 'PotionPoseidonTalent',
  },
  SpellMoonBeamTrait: {
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
        ]),
      ).toEqual(Object.entries(layoutFacts).map(([key, facts]) => [key, ...facts]));
    }
  });

  it('contains exact Rare/Epic pools and linked God Sent pairs', () => {
    for (const [spellTraitKey, expected] of Object.entries(hexFacts)) {
      const hex = catalog.hexes.byKey[spellTraitKey];
      expect(hex).toBeDefined();
      expect(hex!.rareCandidates.values.map((candidate) => candidate.key)).toEqual(expected.rare);
      expect(hex!.epicCandidates.values.map((candidate) => candidate.key)).toEqual(expected.epic);
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
    expect(() => createCatalog(duplicate)).toThrow(/Rare and Epic node keys must be unique/);

    const wrongKeepsake = cloneDeclarations();
    const wrongKeepsakeHex = mutableFirstHex(wrongKeepsake);
    wrongKeepsakeHex.godSent.forceKeepsakeKey = 'ForceHestiaBoonKeepsake';
    expect(() => createCatalog(wrongKeepsake)).toThrow(/must be ForceZeusBoonKeepsake/);
  });
});
