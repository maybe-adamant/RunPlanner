import type { RawHexDeclaration } from '../traits';

const layouts = [
  { key: 'Lung', label: 'Lung', baseCapacity: 16, rareCount: 2, epicCount: 1 },
  { key: 'Pyramid', label: 'Pyramid', baseCapacity: 18, rareCount: 3, epicCount: 1 },
  { key: 'Maze', label: 'Maze', baseCapacity: 22, rareCount: 3, epicCount: 2 },
  { key: 'Nacelle', label: 'Nacelle', baseCapacity: 18, rareCount: 3, epicCount: 2 },
] as const;

const lineage = {
  lineageTalentKey: 'OlympianSpellCountTalent',
  lineageTalentLabel: 'Lineage',
  capacityDelta: 2,
} as const;

function candidate(key: string, label: string) {
  return { key, label } as const;
}

export const hexes: readonly RawHexDeclaration[] = [
  {
    spellTraitKey: 'SpellPolymorphTrait',
    label: 'Twilight Curse',
    layouts,
    rareCandidates: [
      candidate('PolymorphBossDamageTalent', 'Ambition'),
      candidate('PolymorphDeathExplodeTalent', 'Extinction'),
      candidate('PolymorphTauntTalent', 'Spread'),
      candidate('PolymorphTeleportCastTalent', 'Orchestration'),
      candidate('PolymorphHealthCrushTalent', 'Decline'),
    ],
    epicCandidates: [
      candidate('PolymorphSandwichTalent', 'Sustenance'),
      candidate('PolymorphCurseTalent', 'Infection'),
    ],
    godSent: {
      ...lineage,
      providerKey: 'Zeus',
      forceKeepsakeKey: 'ForceZeusBoonKeepsake',
      olympianTalentKey: 'PolymorphZeusTalent',
      olympianTalentLabel: 'Temper of Zeus',
    },
  },
  {
    spellTraitKey: 'SpellMeteorTrait',
    label: 'Total Eclipse',
    layouts,
    rareCandidates: [
      candidate('MeteorVulnerabilityDecalTalent', 'Softness'),
      candidate('MeteorSlowDecalTalent', 'Numbness'),
      candidate('MeteorShowerTalent', 'Fragmentation'),
      candidate('MeteorChargeTalent', 'Consequence'),
    ],
    epicCandidates: [
      candidate('MeteorInvulnerableChargeTalent', 'Eminence'),
      candidate('MeteorDoubleTalent', 'Devastation'),
      candidate('MeteorExCastTalent', 'Excess'),
    ],
    godSent: {
      ...lineage,
      providerKey: 'Hestia',
      forceKeepsakeKey: 'ForceHestiaBoonKeepsake',
      olympianTalentKey: 'MeteorHestiaTalent',
      olympianTalentLabel: 'Hearth of Hestia',
    },
  },
  {
    spellTraitKey: 'SpellTransformTrait',
    label: 'Dark Side',
    layouts,
    rareCandidates: [
      candidate('TransformCastDamageTalent', 'Dominion'),
      candidate('TransformLastStandRechargeTalent', 'Contingency'),
      candidate('TransformAttackSpeedTalent', 'Savagery'),
      candidate('TransformSpecialTalent', 'Splendor'),
    ],
    epicCandidates: [
      candidate('TransformPrimaryTalent', 'Resonance'),
      candidate('TransformSpecialCritTalent', 'Horror'),
      candidate('TransformExCastTalent', 'Sanctity'),
    ],
    godSent: {
      ...lineage,
      providerKey: 'Aphrodite',
      forceKeepsakeKey: 'ForceAphroditeBoonKeepsake',
      olympianTalentKey: 'TransformAphroditeTalent',
      olympianTalentLabel: 'Allure of Aphrodite',
    },
  },
  {
    spellTraitKey: 'SpellLeapTrait',
    label: 'Wolf Howl',
    layouts,
    rareCandidates: [
      candidate('LeapLaunchAoETalent', 'Duality'),
      candidate('LeapAoETalent', 'Vicinity'),
      candidate('LeapCritTalent', 'Lethality'),
      candidate('LeapSprintTalent', 'Tremor'),
    ],
    epicCandidates: [
      candidate('LeapShieldTalent', 'Tenacity'),
      candidate('LeapTwiceTalent', 'Brutality'),
    ],
    godSent: {
      ...lineage,
      providerKey: 'Hephaestus',
      forceKeepsakeKey: 'ForceHephaestusBoonKeepsake',
      olympianTalentKey: 'LeapHephaestusTalent',
      olympianTalentLabel: 'Hand of Hephaestus',
    },
  },
  {
    spellTraitKey: 'SpellLaserTrait',
    label: 'Lunar Ray',
    layouts,
    rareCandidates: [
      candidate('LaserAoETalent', 'Dispersion'),
      candidate('LaserStartAoETalent', 'Overflow'),
      candidate('LaserPenetrationTalent', 'Exodus'),
      candidate('LaserDurationTalent', 'Obstinance'),
      candidate('LaserFirstHitDamageTalent', 'Contact'),
    ],
    epicCandidates: [
      candidate('LaserTripleTalent', 'Trinity'),
      candidate('LaserCrystalTalent', 'Prominence'),
    ],
    godSent: {
      ...lineage,
      providerKey: 'Apollo',
      forceKeepsakeKey: 'ForceApolloBoonKeepsake',
      olympianTalentKey: 'LaserApolloTalent',
      olympianTalentLabel: 'Shine of Apollo',
    },
  },
  {
    spellTraitKey: 'SpellSummonTrait',
    label: 'Night Bloom',
    layouts,
    rareCandidates: [
      candidate('SummonSpeedTalent', 'Rigor'),
      candidate('SummonTeleportTalent', 'Confluence'),
      candidate('SummonPermanenceTalent', 'Servitude'),
      candidate('SummonRetaliateTalent', 'Retaliation'),
    ],
    epicCandidates: [
      candidate('SummonDamageSplitTalent', 'Selflessness'),
      candidate('SummonExplodeTalent', 'Eruption'),
    ],
    godSent: {
      ...lineage,
      providerKey: 'Hera',
      forceKeepsakeKey: 'ForceHeraBoonKeepsake',
      olympianTalentKey: 'SummonHeraTalent',
      olympianTalentLabel: 'Nurture of Hera',
    },
  },
  {
    spellTraitKey: 'SpellTimeSlowTrait',
    label: 'Phase Shift',
    layouts,
    rareCandidates: [
      candidate('TimeSlowDestroyProjectilesTalent', 'Purification'),
      candidate('TimeSlowSpeedTalent', 'Alacrity'),
      candidate('TimeSlowLastStandRechargeTalent', 'Contingency'),
      candidate('TimeSlowCumulativeBuffTalent', 'Accumulation'),
    ],
    epicCandidates: [
      candidate('TimeSlowCritTalent', 'Precision'),
      candidate('TimeSlowFreezeTimeTalent', 'Stillness'),
    ],
    godSent: {
      ...lineage,
      providerKey: 'Demeter',
      forceKeepsakeKey: 'ForceDemeterBoonKeepsake',
      olympianTalentKey: 'TimeSlowDemeterTalent',
      olympianTalentLabel: 'Squall of Demeter',
    },
  },
  {
    spellTraitKey: 'SpellPotionTrait',
    label: 'Moon Water',
    layouts,
    rareCandidates: [
      candidate('DamageBuffTalent', 'Zeal'),
      candidate('ShieldTalent', 'Radiance'),
      candidate('RolloverUsesTalent', 'Conservation'),
      candidate('HealLastTalent', 'Panacea'),
    ],
    epicCandidates: [
      candidate('ClearCastTalent', 'Clarity'),
      candidate('HealRetaliateTalent', 'Tribulation'),
      candidate('PotionExCastTalent', 'Saturation'),
    ],
    godSent: {
      ...lineage,
      providerKey: 'Poseidon',
      forceKeepsakeKey: 'ForcePoseidonBoonKeepsake',
      olympianTalentKey: 'PotionPoseidonTalent',
      olympianTalentLabel: 'Pride of Poseidon',
    },
  },
  {
    spellTraitKey: 'SpellMoonBeamTrait',
    label: 'Sky Fall',
    layouts,
    rareCandidates: [
      candidate('MoonBeamConsecutiveDamageTalent', 'Ferocity'),
      candidate('MoonBeamDefenseTalent', 'Calm'),
      candidate('MoonBeamPrimaryTalent', 'Ambition'),
    ],
    epicCandidates: [
      candidate('MoonBeamTargetTalent', 'Prism'),
      candidate('MoonBeamExBeamBonusTalent', 'Cascade'),
    ],
    godSent: {
      ...lineage,
      providerKey: 'Ares',
      forceKeepsakeKey: 'ForceAresBoonKeepsake',
      olympianTalentKey: 'MoonBeamAresTalent',
      olympianTalentLabel: 'Lance of Ares',
    },
  },
] as const;
