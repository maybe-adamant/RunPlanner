import type {
  RawHexDeclaration,
  RawHexLayoutDeclaration,
  RawHexLayoutNodeDeclaration,
} from './types';

function node(
  slot: number,
  fields: Omit<RawHexLayoutNodeDeclaration, 'slot'> = {},
): RawHexLayoutNodeDeclaration {
  return { slot, ...fields };
}

// Source `SpellTalentData.TalentTreeStructures`; zero grid offsets are omitted.
const layouts: readonly RawHexLayoutDeclaration[] = [
  {
    key: 'Lung',
    label: 'Lung',
    structure: [
      [node(2, { linkTo: [2] }), node(4, { linkTo: [4] })],
      [node(2, { linkTo: [1, 2, 3] }), node(4, { linkTo: [4, 5, 6] })],
      [
        node(1, { linkTo: [1], gridOffsetX: -0.5 }),
        node(2, { linkTo: [3], gridOffsetY: 0.25 }),
        node(3, { gridOffsetX: -1.5, gridOffsetY: -2 }),
        node(4, { linkTo: [3], gridOffsetY: -0.25 }),
        node(5, { linkTo: [5], gridOffsetX: -0.5 }),
        node(6, { gridOffsetX: -1.5, gridOffsetY: -1 }),
      ],
      [
        node(1, { kind: 'keystone', gridOffsetX: -0.5 }),
        node(3, { linkTo: [2, 3, 4] }),
        node(5, { kind: 'keystone', gridOffsetX: -0.5 }),
      ],
      [
        node(2, { linkTo: [3], gridOffsetY: -0.25 }),
        node(3, { kind: 'olympianSpell', linkTo: [1], gridOffsetX: -0.25 }),
        node(4, { linkTo: [3], gridOffsetY: 0.25 }),
      ],
      [
        node(1, { kind: 'olympianCount', gridOffsetX: -0.65, gridOffsetY: 2 }),
        node(3, { kind: 'legendary' }),
      ],
    ],
  },
  {
    key: 'Pyramid',
    label: 'Pyramid',
    structure: [
      [
        node(1, { linkTo: [1] }),
        node(2, { linkTo: [1, 2] }),
        node(3, { linkTo: [2, 3] }),
        node(4, { linkTo: [3, 4] }),
        node(5, { linkTo: [4] }),
      ],
      [
        node(1, { linkTo: [2], gridOffsetY: 0.5 }),
        node(2, { linkTo: [3], gridOffsetX: -0.25, gridOffsetY: 0.5 }),
        node(3, { linkTo: [3], gridOffsetX: -0.25, gridOffsetY: 0.5 }),
        node(4, { linkTo: [4], gridOffsetY: 0.5 }),
      ],
      [
        node(2, { linkTo: [2] }),
        node(3, { kind: 'keystone', linkTo: [3], gridOffsetX: -0.5 }),
        node(4, { linkTo: [4] }),
      ],
      [
        node(2, { linkTo: [1, 3] }),
        node(3, { kind: 'olympianSpell', linkTo: [2], gridOffsetX: -0.75 }),
        node(4, { linkTo: [3, 5] }),
      ],
      [
        node(1, { kind: 'keystone' }),
        node(2, { kind: 'olympianCount', gridOffsetX: -1, gridOffsetY: 1 }),
        node(3, { linkTo: [3] }),
        node(5, { kind: 'keystone' }),
      ],
      [node(3, { kind: 'legendary' })],
    ],
  },
  {
    key: 'Maze',
    label: 'Maze',
    structure: [
      [node(3, { linkTo: [2, 3, 4] })],
      [node(2, { linkTo: [2] }), node(3, { linkTo: [3] }), node(4, { linkTo: [4] })],
      [node(2, { linkTo: [1, 2] }), node(3, { linkTo: [3] }), node(4, { linkTo: [4, 5] })],
      [
        node(1, { kind: 'keystone', linkTo: [1, 3], gridOffsetX: -1 }),
        node(2, { linkTo: [2] }),
        node(3, { kind: 'keystone', linkTo: [7] }),
        node(4, { linkTo: [4] }),
        node(5, { kind: 'keystone', linkTo: [5, 6], gridOffsetX: -1 }),
      ],
      [
        node(1, { gridOffsetX: -3 }),
        node(2, { linkTo: [2], gridOffsetX: -0.35, gridOffsetY: -0.5 }),
        node(3, { gridOffsetX: -1, gridOffsetY: -2 }),
        node(4, { linkTo: [4], gridOffsetX: -0.35, gridOffsetY: 0.5 }),
        node(5, { gridOffsetX: -3 }),
        node(6, { gridOffsetX: -1, gridOffsetY: -1 }),
        node(7, { kind: 'olympianSpell', linkTo: [3], gridOffsetY: -4 }),
      ],
      [
        node(2, { linkTo: [2], gridOffsetX: -0.7, gridOffsetY: -0.5 }),
        node(3, { kind: 'olympianCount' }),
        node(4, { linkTo: [4], gridOffsetX: -0.7, gridOffsetY: 0.5 }),
      ],
      [
        node(2, { kind: 'legendary', gridOffsetX: -1, gridOffsetY: -0.5 }),
        node(4, { kind: 'legendary', gridOffsetX: -1, gridOffsetY: 0.5 }),
      ],
    ],
  },
  {
    key: 'Nacelle',
    label: 'Nacelle',
    structure: [
      [node(2, { linkTo: [2], gridOffsetY: -0.5 }), node(4, { linkTo: [4], gridOffsetY: 0.5 })],
      [
        node(2, { linkTo: [0, 1, 2, 3], bidirectional: true, gridOffsetY: -0.5 }),
        node(4, { linkTo: [3, 4, 5, 6], bidirectional: true, gridOffsetY: 0.5 }),
      ],
      [
        node(0, { linkTo: [2], gridOffsetY: 0.5 }),
        node(1, { linkTo: [2, 5], gridOffsetY: 1.5 }),
        node(2, { kind: 'keystone', gridOffsetY: -0.5 }),
        node(3, { linkTo: [3], gridOffsetX: -1 }),
        node(4, { kind: 'keystone', gridOffsetY: 0.5 }),
        node(5, { linkTo: [4, 5], gridOffsetY: -1.5 }),
        node(6, { linkTo: [4], gridOffsetY: -0.5 }),
      ],
      [
        node(2, { linkTo: [2], gridOffsetY: -0.5 }),
        node(3, { kind: 'keystone', gridOffsetX: -3 }),
        node(4, { linkTo: [4], gridOffsetY: 0.5 }),
        node(5, { kind: 'olympianSpell', linkTo: [3], gridOffsetY: -2 }),
      ],
      [
        node(2, { linkTo: [2], gridOffsetY: -0.5 }),
        node(3, { kind: 'olympianCount' }),
        node(4, { linkTo: [4], gridOffsetY: 0.5 }),
      ],
      [
        node(2, { kind: 'legendary', gridOffsetY: -0.5 }),
        node(4, { kind: 'legendary', gridOffsetY: 0.5 }),
      ],
    ],
  },
];

const lineage = {
  lineageTalentKey: 'OlympianSpellCountTalent',
  lineageTalentLabel: 'Lineage',
  capacityDelta: 2,
} as const;

function candidate(key: string, label: string) {
  return { key, label } as const;
}

// Shared repeatable talents; `MaxCount` comes from `TraitData_Talent.lua`.
const cooldownDamage = candidate('CooldownDamageTalent', 'Purpose');
const chargeRegen = { key: 'ChargeRegenTalent', label: 'Growth', maxCount: 1 } as const;
const preCharge = { key: 'PreChargeTalent', label: 'Preparation', maxCount: 2 } as const;

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
    repeatableCandidates: [
      cooldownDamage,
      chargeRegen,
      candidate('PolymorphDurationTalent', 'Humility'),
      candidate('PolymorphDamageTalent', 'Exposure'),
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
    repeatableCandidates: [
      cooldownDamage,
      preCharge,
      candidate('MeteorSizeTalent', 'Vastness'),
      candidate('MeteorDamageTalent', 'Magnitude'),
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
    repeatableCandidates: [
      candidate('TransformDurationTalent', 'Focus'),
      candidate('TransformDamageTalent', 'Bloodthirst'),
      candidate('TransformCooldownDodgeTalent', 'Tension'),
      chargeRegen,
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
    repeatableCandidates: [
      chargeRegen,
      candidate('LeapDamageTalent', 'Instinct'),
      candidate('LeapArmorDamageTalent', 'Hunger'),
      candidate('LeapCooldownSpeedTalent', 'Urgency'),
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
    repeatableCandidates: [
      cooldownDamage,
      chargeRegen,
      candidate('LaserDamageTalent', 'Intensity'),
      candidate('LaserDefenseTalent', 'Bearing'),
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
    repeatableCandidates: [
      cooldownDamage,
      chargeRegen,
      preCharge,
      candidate('SummonDamageTalent', 'Devotion'),
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
    repeatableCandidates: [
      preCharge,
      chargeRegen,
      candidate('TimeSlowAmountTalent', 'Patience'),
      candidate('CooldownDefenseTalent', 'Steadfastness'),
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
    repeatableCandidates: [
      candidate('PotionManaRestoreTalent', 'Purity'),
      candidate('PotionUsesTalent', 'Abundance'),
      candidate('HealAmountTalent', 'Vigor'),
      candidate('CurrencyUseTalent', 'Fortune'),
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
    repeatableCandidates: [
      chargeRegen,
      candidate('MoonBeamVulnerabilityTalent', 'Omen'),
      candidate('MoonBeamDamageTalent', 'Sting'),
      candidate('MoonBeamCountTalent', 'Brilliance'),
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
