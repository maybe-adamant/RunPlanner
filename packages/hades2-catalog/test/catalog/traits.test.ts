import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';
import type { ScalableGodTraitRarityFloorEffect } from '@run-planner/engine/catalog-schema';

const expectedPositiveRequirementOwners = [
  'DoorHealToFullBoon',
  'WeakPotencyBoon',
  'WeakVulnerabilityBoon',
  'BlindChanceBoon',
  'ApolloBlindBoon',
  'DoubleStrikeChanceBoon',
  'ApolloExCastBoon',
  'AresExCastBoon',
  'RendBloodDropBoon',
  'AresStatusDoubleDamageBoon',
  'SlowExAttackBoon',
  'CastAttachBoon',
  'RootDurationBoon',
  'MassiveDamageBoon',
  'MassiveKnockupBoon',
  'DamageSharePotencyBoon',
  'LinkedDeathDamageBoon',
  'SpawnCastDamageBoon',
  'OmegaZeroBurnBoon',
  'BurnArmorBoon',
  'BurnStackBoon',
  'PoseidonStatusBoon',
  'PoseidonExCastBoon',
  'CastAnywhereBoon',
  'DoubleBoltBoon',
  'EchoExpirationBoon',
  'LightningDebuffGeneratorBoon',
  'LuckyBoon',
  'TimeStopLastStandBoon',
  'RandomStatusBoon',
  'DoubleExManaBoon',
  'DoubleBloodDropBoon',
  'InstantRootKill',
  'WeaponUpgradeBoon',
  'AllElementalBoon',
  'BurnSprintBoon',
  'AmplifyConeBoon',
  'SpawnKillBoon',
  'ManaShieldBoon',
  'RaiseDeadBoon',
  'MoneyDamageBoon',
  'RootStrikeBoon',
  'KeepsakeLevelBoon',
  'GoodStuffBoon',
  'ApolloSecondStageCastBoon',
  'PoseidonSplashSprintBoon',
  'StormSpawnBoon',
  'SprintEchoBoon',
  'CharmCrowdBoon',
  'MaxHealthDamageBoon',
  'ManaBurstCountBoon',
  'EchoBurnBoon',
  'ManaRestoreDamageBoon',
  'SteamBoon',
  'BurnConsumeBoon',
  'CoverRegenerationBoon',
  'BurnRefreshBoon',
  'ReboundingSparkBoon',
  'MassiveCastBoon',
  'ClearRootBoon',
  'BlindClearBoon',
  'SlamManaBurstBoon',
  'DoubleMassiveAttackBoon',
  'SuperSacrificeBoonZeus',
  'SuperSacrificeBoonHera',
  'LightningVulnerabilityBoon',
  'AllCloseBoon',
  'SelfCastBoon',
  'AutoRevengeBoon',
  'BloodRetentionBoon',
  'RapidSwordBoon',
  'DoubleSwordBoon',
  'DoubleSplashBoon',
  'FireballRendBoon',
  'BloodManaBurstBoon',
  'SorceryCritBoon',
  'OlympianSpellCountBoon',
] as const;

const expectedOrdinarySlots = Object.fromEntries(
  [
    'Aphrodite',
    'Apollo',
    'Ares',
    'Demeter',
    'Hephaestus',
    'Hera',
    'Hestia',
    'Poseidon',
    'Zeus',
  ].flatMap((giver) => [
    [`${giver}WeaponBoon`, 'Melee'],
    [`${giver}SpecialBoon`, 'Secondary'],
    [`${giver}CastBoon`, 'Ranged'],
    [`${giver}SprintBoon`, 'Rush'],
    [`${giver}ManaBoon`, 'Mana'],
  ]),
);

const expectedPriorityTraitKeys: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  [
    'Aphrodite',
    'Apollo',
    'Ares',
    'Demeter',
    'Hephaestus',
    'Hera',
    'Hestia',
    'Poseidon',
    'Zeus',
  ].map((giver) => [
    giver,
    [
      `${giver}WeaponBoon`,
      `${giver}SpecialBoon`,
      `${giver}CastBoon`,
      `${giver}SprintBoon`,
      `${giver}ManaBoon`,
    ],
  ]),
);

const sourceKeys = (keys: string): readonly string[] => keys.trim().split(/\s+/).sort();

const expectedElementTraitKeys = {
  Aether: sourceKeys(`
    SprintEchoBoon CharmCrowdBoon AllCloseBoon MaxHealthDamageBoon ManaBurstCountBoon
    BurnRefreshBoon SlamManaBurstBoon BloodManaBurstBoon ApolloSecondStageCastBoon
    RaiseDeadBoon PoseidonSplashSprintBoon StormSpawnBoon CoverRegenerationBoon
    BlindClearBoon DoubleSwordBoon SelfCastBoon AutoRevengeBoon BloodRetentionBoon
    RapidSwordBoon DoubleSplashBoon FireballRendBoon RootStrikeBoon KeepsakeLevelBoon
    GoodStuffBoon BurnConsumeBoon ClearRootBoon ManaShieldBoon ReboundingSparkBoon
    MassiveCastBoon DoubleMassiveAttackBoon AllElementalBoon SuperSacrificeBoonHera
    MoneyDamageBoon ManaRestoreDamageBoon EchoBurnBoon SteamBoon
    LightningVulnerabilityBoon SuperSacrificeBoonZeus
  `),
  Earth: sourceKeys(`
    AresWeaponBoon AresSpecialBoon AresCastBoon AresSprintBoon AresManaBoon
    AresExCastBoon RendBloodDropBoon AresStatusDoubleDamageBoon BloodDropRevengeBoon
    MissingHealthCritBoon LowHealthLifestealBoon OmegaDelayedDamageBoon
    DoubleBloodDropBoon DemeterManaBoon PlantHealthBoon BoonGrowthBoon
    ReserveManaHitShieldBoon SlowExAttackBoon CastAttachBoon InstantRootKill
    HephaestusCastBoon HephaestusManaBoon HeavyArmorBoon ArmorBoon
    EncounterStartDefenseBuffBoon ManaToHealthBoon WeaponUpgradeBoon HeraWeaponBoon
    HeraSpecialBoon OmegaHeraProjectileBoon AllElementalBoon HermesWeaponBoon
    HermesSpecialBoon HermesCastDiscountBoon SorcerySpeedBoon
    CritBonusBoon HighHealthCritBoon InsideCastCritBoon TimedCritVulnerabilityBoon
  `),
  Air: sourceKeys(`
    AphroditeCastBoon AphroditeSprintBoon AphroditeManaBoon HighHealthOffenseBoon
    HealthRewardBonusBoon FocusRawDamageBoon RandomStatusBoon ApolloWeaponBoon
    ApolloSpecialBoon ApolloManaBoon PerfectDamageBonusBoon ApolloCastAreaBoon
    DoubleStrikeChanceBoon HeraCastBoon LinkedDeathDamageBoon SpawnCastDamageBoon
    AllElementalBoon ZeusWeaponBoon ZeusSpecialBoon ZeusCastBoon ZeusSprintBoon
    ZeusManaBoon ZeusManaBoltBoon BoltRetaliateBoon CastAnywhereBoon FocusLightningBoon
    DoubleBoltBoon EchoExpirationBoon LightningDebuffGeneratorBoon SpawnKillBoon
    DodgeChanceBoon SlowProjectileBoon MoneyMultiplierBoon TimedKillBuffBoon
    TimeStopLastStandBoon SupportingFireBoon DashOmegaBuffBoon OmegaCastVolleyBoon
    FocusCritBoon SorceryCritBoon
  `),
  Fire: sourceKeys(`
    ApolloCastBoon ApolloSprintBoon ApolloRetaliateBoon BlindChanceBoon
    ApolloBlindBoon ApolloExCastBoon DoubleExManaBoon HephaestusWeaponBoon
    HephaestusSpecialBoon HephaestusSprintBoon MassiveDamageBoon AntiArmorBoon
    MassiveKnockupBoon HeraSprintBoon DamageShareRetaliateBoon CommonGlobalDamageBoon
    AllElementalBoon HestiaWeaponBoon HestiaSpecialBoon HestiaCastBoon HestiaSprintBoon
    HestiaManaBoon OmegaZeroBurnBoon CastProjectileBoon FireballManaSpecialBoon
    BurnExplodeBoon BurnArmorBoon BurnStackBoon AloneDamageBoon BurnSprintBoon
    SprintShieldBoon RestockBoon InvulnerabilityDashBoon RetaliateInvulnerabilityBoon
    FocusLastStandBoon DeathDefianceRefillBoon AthenaProjectileBoon InvulnerabilityCastBoon
    ManaSpearBoon OlympianSpellCountBoon
  `),
  Water: sourceKeys(`
    AphroditeWeaponBoon AphroditeSpecialBoon DoorHealToFullBoon WeakPotencyBoon
    WeakVulnerabilityBoon ManaBurstBoon DemeterWeaponBoon DemeterSpecialBoon
    DemeterCastBoon DemeterSprintBoon CastNovaBoon RootDurationBoon HeraManaBoon
    BoonDecayBoon DamageSharePotencyBoon AllElementalBoon PoseidonWeaponBoon
    PoseidonSpecialBoon PoseidonCastBoon PoseidonSprintBoon PoseidonManaBoon
    EncounterStartOffenseBuffBoon RoomRewardBonusBoon FocusDamageShaveBoon
    DoubleRewardBoon PoseidonStatusBoon PoseidonExCastBoon OmegaPoseidonProjectileBoon
    AmplifyConeBoon LuckyBoon
  `),
} as const;

const expectedHammerRestrictions: Readonly<Record<string, readonly string[]>> = {
  StaffDoubleAttackTrait: ['BaseStaffAspect', 'StaffClearCastAspect', 'StaffSelfHitAspect'],
  StaffLongAttackTrait: ['BaseStaffAspect', 'StaffClearCastAspect', 'StaffSelfHitAspect'],
  StaffDashAttackTrait: ['BaseStaffAspect', 'StaffClearCastAspect', 'StaffSelfHitAspect'],
  StaffExAoETrait: ['BaseStaffAspect', 'StaffClearCastAspect', 'StaffSelfHitAspect'],
  StaffOneWayAttackTrait: ['BaseStaffAspect', 'StaffClearCastAspect', 'StaffSelfHitAspect'],
  StaffRaiseDeadBigTrait: ['StaffRaiseDeadAspect'],
  StaffRaiseDeadDoubleTrait: ['StaffRaiseDeadAspect'],
  StaffLoneShadeRespawnTrait: ['StaffRaiseDeadAspect'],
  StaffLoneShadeRallyTrait: ['StaffRaiseDeadAspect'],
  DaggerDashAttackTripleTrait: [
    'DaggerBackstabAspect',
    'DaggerHomingThrowAspect',
    'DaggerBlockAspect',
  ],
  DaggerTripleBuffTrait: ['DaggerTripleAspect'],
  DaggerTripleRepeatWomboTrait: ['DaggerTripleAspect'],
  DaggerTripleHomingSpecialTrait: ['DaggerTripleAspect'],
  AxeMassiveThirdStrikeTrait: ['AxeRecoveryAspect', 'AxeArmCastAspect', 'AxePerfectCriticalAspect'],
  AxeThirdStrikeTrait: ['AxeRecoveryAspect', 'AxeArmCastAspect', 'AxePerfectCriticalAspect'],
  AxeRallyFrenzyTrait: ['AxeRallyAspect'],
  AxeRallyFirstStrikeTrait: ['AxeRallyAspect'],
  TorchExSpecialCountTrait: [
    'TorchSpecialDurationAspect',
    'TorchDetonateAspect',
    'TorchAutofireAspect',
  ],
  TorchAttackSpeedTrait: [
    'TorchSpecialDurationAspect',
    'TorchSprintRecallAspect',
    'TorchDetonateAspect',
  ],
  TorchDiscountExAttackTrait: [
    'TorchSpecialDurationAspect',
    'TorchSprintRecallAspect',
    'TorchDetonateAspect',
  ],
  TorchLongevityTrait: [
    'TorchSpecialDurationAspect',
    'TorchSprintRecallAspect',
    'TorchDetonateAspect',
  ],
  TorchSplitAttackTrait: ['TorchSpecialDurationAspect', 'TorchAutofireAspect'],
  TorchAutofireSprintTrait: ['TorchAutofireAspect'],
  LobAmmoTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobAmmoMagnetismTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobSpreadShotTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobOneSideTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobStraightShotTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobPulseAmmoTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobPulseAmmoCollectTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobGrowthTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobGunOverheatTrait: ['LobGunAspect'],
  LobGunBounceTrait: ['LobGunAspect'],
  LobGunSpecialBounceTrait: ['LobGunAspect'],
  LobGunAttackRangeTrait: ['LobGunAspect'],
  LobGunAttackDoublerTrait: ['LobGunAspect'],
  SuitDashAttackTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialJumpTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialStartUpTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialAutoTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialBlockTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialDiscountTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialConsecutiveHitTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitComboForwardRocketTrait: ['SuitComboAspect'],
  SuitComboBlockBuffTrait: ['SuitComboAspect'],
  SuitComboDoubleSpecialTrait: ['SuitComboAspect'],
  SuitComboDashAttackTrait: ['SuitComboAspect'],
  SuitPowershotTrait: ['SuitComboAspect'],
};

const expectedGiverPools: Readonly<Record<string, readonly string[]>> = {
  Aphrodite: [
    'AphroditeWeaponBoon',
    'AphroditeSpecialBoon',
    'AphroditeCastBoon',
    'AphroditeSprintBoon',
    'AphroditeManaBoon',
    'HighHealthOffenseBoon',
    'HealthRewardBonusBoon',
    'DoorHealToFullBoon',
    'WeakPotencyBoon',
    'WeakVulnerabilityBoon',
    'ManaBurstBoon',
    'FocusRawDamageBoon',
    'ElementalDodgeBoon',
    'RandomStatusBoon',
    'SprintEchoBoon',
    'CharmCrowdBoon',
    'AllCloseBoon',
    'MaxHealthDamageBoon',
    'ManaBurstCountBoon',
    'BurnRefreshBoon',
    'SlamManaBurstBoon',
    'BloodManaBurstBoon',
  ],
  Apollo: [
    'ApolloWeaponBoon',
    'ApolloSpecialBoon',
    'ApolloCastBoon',
    'ApolloSprintBoon',
    'ApolloManaBoon',
    'ApolloRetaliateBoon',
    'PerfectDamageBonusBoon',
    'BlindChanceBoon',
    'ApolloBlindBoon',
    'ApolloExCastBoon',
    'ApolloCastAreaBoon',
    'DoubleStrikeChanceBoon',
    'ElementalRallyBoon',
    'DoubleExManaBoon',
    'ApolloSecondStageCastBoon',
    'RaiseDeadBoon',
    'PoseidonSplashSprintBoon',
    'StormSpawnBoon',
    'ManaBurstCountBoon',
    'CoverRegenerationBoon',
    'BlindClearBoon',
    'DoubleSwordBoon',
  ],
  Ares: [
    'AresWeaponBoon',
    'AresSpecialBoon',
    'AresCastBoon',
    'AresSprintBoon',
    'AresManaBoon',
    'AresExCastBoon',
    'RendBloodDropBoon',
    'AresStatusDoubleDamageBoon',
    'BloodDropRevengeBoon',
    'MissingHealthCritBoon',
    'LowHealthLifestealBoon',
    'OmegaDelayedDamageBoon',
    'ElementalOlympianDamageBoon',
    'DoubleBloodDropBoon',
    'SelfCastBoon',
    'AutoRevengeBoon',
    'BloodRetentionBoon',
    'RapidSwordBoon',
    'DoubleSplashBoon',
    'DoubleSwordBoon',
    'FireballRendBoon',
    'BloodManaBurstBoon',
  ],
  Demeter: [
    'DemeterWeaponBoon',
    'DemeterSpecialBoon',
    'DemeterCastBoon',
    'DemeterSprintBoon',
    'DemeterManaBoon',
    'CastNovaBoon',
    'PlantHealthBoon',
    'BoonGrowthBoon',
    'ReserveManaHitShieldBoon',
    'SlowExAttackBoon',
    'CastAttachBoon',
    'RootDurationBoon',
    'ElementalDamageCapBoon',
    'InstantRootKill',
    'RootStrikeBoon',
    'KeepsakeLevelBoon',
    'GoodStuffBoon',
    'StormSpawnBoon',
    'MaxHealthDamageBoon',
    'BurnConsumeBoon',
    'ClearRootBoon',
    'SelfCastBoon',
  ],
  Hephaestus: [
    'HephaestusWeaponBoon',
    'HephaestusSpecialBoon',
    'HephaestusCastBoon',
    'HephaestusSprintBoon',
    'HephaestusManaBoon',
    'MassiveDamageBoon',
    'AntiArmorBoon',
    'HeavyArmorBoon',
    'ArmorBoon',
    'EncounterStartDefenseBuffBoon',
    'ManaToHealthBoon',
    'MassiveKnockupBoon',
    'ElementalDamageBoon',
    'WeaponUpgradeBoon',
    'ManaShieldBoon',
    'ReboundingSparkBoon',
    'MassiveCastBoon',
    'ClearRootBoon',
    'BlindClearBoon',
    'SlamManaBurstBoon',
    'DoubleMassiveAttackBoon',
    'RapidSwordBoon',
  ],
  Hera: [
    'HeraWeaponBoon',
    'HeraSpecialBoon',
    'HeraCastBoon',
    'HeraSprintBoon',
    'HeraManaBoon',
    'DamageShareRetaliateBoon',
    'LinkedDeathDamageBoon',
    'BoonDecayBoon',
    'DamageSharePotencyBoon',
    'SpawnCastDamageBoon',
    'CommonGlobalDamageBoon',
    'OmegaHeraProjectileBoon',
    'ElementalRarityUpgradeBoon',
    'AllElementalBoon',
    'SuperSacrificeBoonHera',
    'MoneyDamageBoon',
    'KeepsakeLevelBoon',
    'RaiseDeadBoon',
    'ManaRestoreDamageBoon',
    'CharmCrowdBoon',
    'ManaShieldBoon',
    'BloodRetentionBoon',
  ],
  Hestia: [
    'HestiaWeaponBoon',
    'HestiaSpecialBoon',
    'HestiaCastBoon',
    'HestiaSprintBoon',
    'HestiaManaBoon',
    'OmegaZeroBurnBoon',
    'CastProjectileBoon',
    'FireballManaSpecialBoon',
    'BurnExplodeBoon',
    'BurnArmorBoon',
    'BurnStackBoon',
    'AloneDamageBoon',
    'ElementalBaseDamageBoon',
    'BurnSprintBoon',
    'EchoBurnBoon',
    'SteamBoon',
    'BurnConsumeBoon',
    'CoverRegenerationBoon',
    'BurnRefreshBoon',
    'DoubleMassiveAttackBoon',
    'ManaRestoreDamageBoon',
    'FireballRendBoon',
  ],
  Poseidon: [
    'PoseidonWeaponBoon',
    'PoseidonSpecialBoon',
    'PoseidonCastBoon',
    'PoseidonSprintBoon',
    'PoseidonManaBoon',
    'EncounterStartOffenseBuffBoon',
    'RoomRewardBonusBoon',
    'FocusDamageShaveBoon',
    'DoubleRewardBoon',
    'PoseidonStatusBoon',
    'PoseidonExCastBoon',
    'OmegaPoseidonProjectileBoon',
    'ElementalHealthBoon',
    'AmplifyConeBoon',
    'LightningVulnerabilityBoon',
    'MoneyDamageBoon',
    'GoodStuffBoon',
    'PoseidonSplashSprintBoon',
    'AllCloseBoon',
    'SteamBoon',
    'MassiveCastBoon',
    'DoubleSplashBoon',
  ],
  Zeus: [
    'ZeusWeaponBoon',
    'ZeusSpecialBoon',
    'ZeusCastBoon',
    'ZeusSprintBoon',
    'ZeusManaBoon',
    'ZeusManaBoltBoon',
    'BoltRetaliateBoon',
    'CastAnywhereBoon',
    'FocusLightningBoon',
    'DoubleBoltBoon',
    'EchoExpirationBoon',
    'LightningDebuffGeneratorBoon',
    'ElementalDamageFloorBoon',
    'SpawnKillBoon',
    'SuperSacrificeBoonZeus',
    'LightningVulnerabilityBoon',
    'RootStrikeBoon',
    'ApolloSecondStageCastBoon',
    'SprintEchoBoon',
    'EchoBurnBoon',
    'ReboundingSparkBoon',
    'AutoRevengeBoon',
  ],
  Hermes: [
    'HermesWeaponBoon',
    'HermesSpecialBoon',
    'HermesCastDiscountBoon',
    'SprintShieldBoon',
    'SorcerySpeedBoon',
    'DodgeChanceBoon',
    'SlowProjectileBoon',
    'MoneyMultiplierBoon',
    'TimedKillBuffBoon',
    'RestockBoon',
    'LuckyBoon',
    'ElementalUnifiedBoon',
    'TimeStopLastStandBoon',
  ],
  Artemis: [
    'SupportingFireBoon',
    'CritBonusBoon',
    'DashOmegaBuffBoon',
    'HighHealthCritBoon',
    'InsideCastCritBoon',
    'OmegaCastVolleyBoon',
    'TimedCritVulnerabilityBoon',
    'FocusCritBoon',
    'SorceryCritBoon',
  ],
  Athena: [
    'InvulnerabilityDashBoon',
    'RetaliateInvulnerabilityBoon',
    'FocusLastStandBoon',
    'DeathDefianceRefillBoon',
    'AthenaProjectileBoon',
    'InvulnerabilityCastBoon',
    'ManaSpearBoon',
    'OlympianSpellCountBoon',
  ],
  WeaponUpgrade: [
    'StaffDoubleAttackTrait',
    'StaffLongAttackTrait',
    'StaffDashAttackTrait',
    'StaffTripleShotTrait',
    'StaffJumpSpecialTrait',
    'StaffExAoETrait',
    'StaffAttackRecoveryTrait',
    'StaffFastSpecialTrait',
    'StaffExHealTrait',
    'StaffSecondStageTrait',
    'StaffPowershotTrait',
    'StaffOneWayAttackTrait',
    'StaffRaiseDeadBigTrait',
    'StaffRaiseDeadDoubleTrait',
    'StaffLoneShadeRespawnTrait',
    'StaffLoneShadeRallyTrait',
    'DaggerBlinkAoETrait',
    'DaggerSpecialJumpTrait',
    'DaggerSpecialLineTrait',
    'DaggerRapidAttackTrait',
    'DaggerSpecialConsecutiveTrait',
    'DaggerBackstabTrait',
    'DaggerSpecialReturnTrait',
    'DaggerSpecialFanTrait',
    'DaggerAttackFinisherTrait',
    'DaggerFinalHitTrait',
    'DaggerChargeStageSkipTrait',
    'DaggerDashAttackTripleTrait',
    'DaggerTripleBuffTrait',
    'DaggerTripleRepeatWomboTrait',
    'DaggerTripleHomingSpecialTrait',
    'AxeSpinSpeedTrait',
    'AxeChargedSpecialTrait',
    'AxeAttackRecoveryTrait',
    'AxeMassiveThirdStrikeTrait',
    'AxeThirdStrikeTrait',
    'AxeRangedWhirlwindTrait',
    'AxeFreeSpinTrait',
    'AxeArmorTrait',
    'AxeBlockEmpowerTrait',
    'AxeSecondStageTrait',
    'AxeDashAttackTrait',
    'AxeSturdyTrait',
    'AxeRallyFrenzyTrait',
    'AxeRallyFirstStrikeTrait',
    'TorchExSpecialCountTrait',
    'TorchSpecialSpeedTrait',
    'TorchAttackSpeedTrait',
    'TorchSpecialLineTrait',
    'TorchSpecialImpactTrait',
    'TorchMoveSpeedTrait',
    'TorchSplitAttackTrait',
    'TorchEnhancedAttackTrait',
    'TorchDiscountExAttackTrait',
    'TorchLongevityTrait',
    'TorchOrbitPointTrait',
    'TorchSpinAttackTrait',
    'TorchAutofireSprintTrait',
    'LobAmmoTrait',
    'LobAmmoMagnetismTrait',
    'LobRushArmorTrait',
    'LobSpreadShotTrait',
    'LobSpecialSpeedTrait',
    'LobSturdySpecialTrait',
    'LobOneSideTrait',
    'LobInOutSpecialExTrait',
    'LobStraightShotTrait',
    'LobPulseAmmoTrait',
    'LobPulseAmmoCollectTrait',
    'LobGrowthTrait',
    'LobGunOverheatTrait',
    'LobGunBounceTrait',
    'LobGunSpecialBounceTrait',
    'LobGunAttackRangeTrait',
    'LobGunAttackDoublerTrait',
    'SuitArmorTrait',
    'SuitAttackSpeedTrait',
    'SuitAttackSizeTrait',
    'SuitAttackRangeTrait',
    'SuitFullChargeTrait',
    'SuitDashAttackTrait',
    'SuitSpecialJumpTrait',
    'SuitSpecialStartUpTrait',
    'SuitSpecialAutoTrait',
    'SuitSpecialBlockTrait',
    'SuitSpecialDiscountTrait',
    'SuitSpecialConsecutiveHitTrait',
    'SuitComboForwardRocketTrait',
    'SuitComboBlockBuffTrait',
    'SuitComboDoubleSpecialTrait',
    'SuitComboDashAttackTrait',
    'SuitPowershotTrait',
  ],
};

const expectedDeferredTraitKeys = [
  'LaserApolloTalent',
  'LeapHephaestusTalent',
  'MeteorHestiaTalent',
  'MoonBeamAresTalent',
  'PolymorphZeusTalent',
  'PotionPoseidonTalent',
  'SpellLaserTrait',
  'SpellLeapTrait',
  'SpellMeteorTrait',
  'SpellMoonBeamTrait',
  'SpellPolymorphTrait',
  'SpellSummonTrait',
  'SpellTransformTrait',
  'SummonHeraTalent',
  'TimeSlowDemeterTalent',
  'TransformAphroditeTalent',
] as const;

const expectedOfferRequirements: Readonly<Record<string, string>> = {
  DoorHealToFullBoon: '[{"kind":"anyEquippedTrait","traitKeys":["HighHealthOffenseBoon"]}]',
  WeakPotencyBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","AphroditeSprintBoon","AphroditeManaBoon"]}]',
  WeakVulnerabilityBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","AphroditeSprintBoon","AphroditeManaBoon"]}]',
  ElementalDodgeBoon: '[{"kind":"elementCount","element":"Air","minimum":2}]',
  RandomStatusBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","AphroditeSprintBoon","AphroditeManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["AphroditeWeaponBoon","AphroditeSpecialBoon"]},{"kind":"anyEquippedTrait","traitKeys":["WeakPotencyBoon","WeakVulnerabilityBoon","HighHealthOffenseBoon","FocusRawDamageBoon"]}]}]',
  SprintEchoBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["ZeusWeaponBoon","ZeusSpecialBoon"]},{"kind":"anyEquippedTrait","traitKeys":["AphroditeWeaponBoon","AphroditeSpecialBoon","AphroditeCastBoon","AphroditeSprintBoon","AphroditeManaBoon"]}]}]',
  CharmCrowdBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HeraWeaponBoon","HeraSpecialBoon","HeraCastBoon","HeraSprintBoon"]},{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","AphroditeSprintBoon","AphroditeManaBoon"]}]}]',
  AllCloseBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["PoseidonWeaponBoon","PoseidonSpecialBoon","PoseidonCastBoon","PoseidonSprintBoon","PoseidonManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["AphroditeWeaponBoon","AphroditeSpecialBoon"]}]}]',
  MaxHealthDamageBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["DemeterWeaponBoon","DemeterSpecialBoon","DemeterManaBoon","DemeterSprintBoon","PlantHealthBoon"]},{"kind":"anyEquippedTrait","traitKeys":["AphroditeWeaponBoon","AphroditeSpecialBoon","AphroditeManaBoon","AphroditeSprintBoon","DoorHealToFullBoon"]}]}]',
  ManaBurstCountBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["ManaBurstBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ApolloWeaponBoon","ApolloSpecialBoon","ApolloCastBoon","ApolloSprintBoon","ApolloManaBoon"]}]}]',
  BurnRefreshBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon"]},{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","AphroditeSprintBoon","AphroditeManaBoon"]}]}]',
  SlamManaBurstBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AphroditeWeaponBoon","AphroditeSpecialBoon","AphroditeCastBoon","AphroditeSprintBoon","AphroditeManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HephaestusWeaponBoon","HephaestusSpecialBoon","HephaestusSprintBoon"]}]}]',
  BloodManaBurstBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AresManaBoon","BloodDropRevengeBoon"]},{"kind":"anyEquippedTrait","traitKeys":["AphroditeWeaponBoon","AphroditeSpecialBoon","AphroditeCastBoon","AphroditeSprintBoon","AphroditeManaBoon"]}]}]',
  BlindChanceBoon: '[{"kind":"anyEquippedTrait","traitKeys":["ApolloWeaponBoon"]}]',
  ApolloBlindBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["ApolloCastBoon","ApolloSprintBoon","ApolloRetaliateBoon","BlindChanceBoon"]}]',
  ApolloExCastBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","ApolloCastBoon","DemeterCastBoon","HephaestusCastBoon","HeraCastBoon","HestiaCastBoon","PoseidonCastBoon","ZeusCastBoon","AresCastBoon"]}]',
  DoubleStrikeChanceBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeWeaponBoon","ApolloWeaponBoon","DemeterWeaponBoon","HephaestusWeaponBoon","HeraWeaponBoon","HestiaWeaponBoon","PoseidonWeaponBoon","ZeusWeaponBoon","AresWeaponBoon"]}]',
  SorceryCritBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["SpellLaserTrait","SpellLeapTrait","SpellSummonTrait","SpellMeteorTrait","SpellTransformTrait","SpellMoonBeamTrait","SpellPolymorphTrait"]}]',
  OlympianSpellCountBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["PolymorphZeusTalent","MeteorHestiaTalent","TransformAphroditeTalent","LeapHephaestusTalent","LaserApolloTalent","SummonHeraTalent","TimeSlowDemeterTalent","PotionPoseidonTalent","MoonBeamAresTalent"]}]',
  ElementalRallyBoon: '[{"kind":"elementCount","element":"Fire","minimum":2}]',
  DoubleExManaBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["ApolloWeaponBoon","ApolloSpecialBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ApolloCastBoon","ApolloSprintBoon","ApolloManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["DoubleStrikeChanceBoon","ApolloCastAreaBoon","ApolloBlindBoon","ApolloExCastBoon"]}]}]',
  ApolloSecondStageCastBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["ApolloExCastBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ZeusWeaponBoon","ZeusSpecialBoon","ZeusCastBoon","ZeusSprintBoon"]}]}]',
  RaiseDeadBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HeraCastBoon","HeraSprintBoon","HeraManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ApolloCastBoon","ApolloSprintBoon","ApolloManaBoon"]}]}]',
  PoseidonSplashSprintBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["ApolloWeaponBoon","ApolloSpecialBoon","ApolloCastBoon","ApolloSprintBoon","ApolloManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["PoseidonWeaponBoon","PoseidonSpecialBoon","PoseidonCastBoon","PoseidonSprintBoon","PoseidonManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ApolloSprintBoon","PoseidonSprintBoon"]}]}]',
  StormSpawnBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["ApolloWeaponBoon","ApolloSpecialBoon","ApolloCastBoon","ApolloSprintBoon","ApolloManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["DemeterSprintBoon","CastNovaBoon"]}]}]',
  CoverRegenerationBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["ApolloCastBoon","ApolloSprintBoon","ApolloRetaliateBoon","BlindChanceBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon","HestiaSprintBoon","HestiaManaBoon"]}]}]',
  BlindClearBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HephaestusWeaponBoon","HephaestusSpecialBoon","HephaestusSprintBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ApolloCastBoon","ApolloSprintBoon","ApolloRetaliateBoon","BlindChanceBoon"]}]}]',
  DoubleSwordBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AresCastBoon","AresSprintBoon","OmegaDelayedDamageBoon","RendBloodDropBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ApolloWeaponBoon","ApolloSpecialBoon","ApolloCastBoon","ApolloSprintBoon","ApolloManaBoon"]}]}]',
  AresExCastBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","ApolloCastBoon","DemeterCastBoon","HephaestusCastBoon","HeraCastBoon","HestiaCastBoon","PoseidonCastBoon","ZeusCastBoon","AresCastBoon"]}]',
  RendBloodDropBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AresWeaponBoon","AresSpecialBoon","AresManaBoon","BloodDropRevengeBoon"]}]',
  AresStatusDoubleDamageBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AresWeaponBoon","AresSpecialBoon"]}]',
  ElementalOlympianDamageBoon: '[{"kind":"elementCount","element":"Earth","minimum":4}]',
  DoubleBloodDropBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AresWeaponBoon","AresSpecialBoon"]},{"kind":"anyEquippedTrait","traitKeys":["AresManaBoon","BloodDropRevengeBoon"]},{"kind":"anyEquippedTrait","traitKeys":["AresExCastBoon","AresStatusDoubleDamageBoon","MissingHealthCritBoon","LowHealthLifestealBoon","OmegaDelayedDamageBoon"]}]}]',
  SelfCastBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AresCastBoon","AresExCastBoon","OmegaDelayedDamageBoon"]},{"kind":"anyEquippedTrait","traitKeys":["DemeterWeaponBoon","DemeterSpecialBoon","DemeterCastBoon","DemeterSprintBoon","DemeterManaBoon"]}]},{"kind":"notEquippedTrait","traitKeys":["CastProjectileBoon","CastAnywhereBoon","HadesCastProjectileBoon","CastLobBoon"]}]',
  CastProjectileBoon:
    '[{"kind":"notEquippedTrait","traitKeys":["HadesCastProjectileBoon","CastAnywhereBoon","CastLobBoon","SelfCastBoon"]}]',
  AutoRevengeBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AresWeaponBoon","AresSpecialBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ZeusWeaponBoon","ZeusSpecialBoon","ZeusCastBoon","ZeusSprintBoon","ZeusManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["BloodDropRevengeBoon","ApolloRetaliateBoon","BoltRetaliateBoon"]}]}]',
  BloodRetentionBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AresManaBoon","BloodDropRevengeBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HeraWeaponBoon","HeraSpecialBoon","HeraCastBoon","HeraSprintBoon","HeraManaBoon"]}]}]',
  RapidSwordBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AresCastBoon","AresSprintBoon","OmegaDelayedDamageBoon","RendBloodDropBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HephaestusWeaponBoon","HephaestusSpecialBoon","HephaestusCastBoon","HephaestusSprintBoon","HephaestusManaBoon"]}]}]',
  DoubleSplashBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AresWeaponBoon","AresSpecialBoon","AresCastBoon","AresSprintBoon","AresManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["PoseidonWeaponBoon","PoseidonSpecialBoon"]}]}]',
  FireballRendBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["AresWeaponBoon","AresSpecialBoon","AresCastBoon","AresSprintBoon","AresManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["FireballManaSpecialBoon","CastProjectileBoon"]}]}]',
  PlantHealthBoon: '[{"kind":"offerContext","context":"blockGiftBoons","required":false}]',
  BoonGrowthBoon: '[{"kind":"rarifiableTrait"}]',
  SlowExAttackBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeWeaponBoon","ApolloWeaponBoon","DemeterWeaponBoon","HephaestusWeaponBoon","HeraWeaponBoon","HestiaWeaponBoon","PoseidonWeaponBoon","ZeusWeaponBoon","AresWeaponBoon"]}]',
  CastAttachBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","ApolloCastBoon","DemeterCastBoon","HephaestusCastBoon","HeraCastBoon","HestiaCastBoon","PoseidonCastBoon","ZeusCastBoon","AresCastBoon"]}]',
  RootDurationBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["DemeterWeaponBoon","DemeterSpecialBoon","DemeterCastBoon"]}]',
  ElementalDamageCapBoon: '[{"kind":"elementCount","element":"Water","minimum":4}]',
  InstantRootKill:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["DemeterWeaponBoon","DemeterSpecialBoon","DemeterCastBoon"]},{"kind":"anyEquippedTrait","traitKeys":["PlantHealthBoon","ReserveManaHitShieldBoon","BoonGrowthBoon"]},{"kind":"anyEquippedTrait","traitKeys":["SlowExAttackBoon","RootDurationBoon","CastAttachBoon"]}]}]',
  RootStrikeBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["ZeusWeaponBoon","ZeusSpecialBoon","ZeusCastBoon","ZeusSprintBoon","ZeusManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["DemeterWeaponBoon","DemeterSpecialBoon","DemeterCastBoon"]}]}]',
  KeepsakeLevelBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["DemeterWeaponBoon","DemeterSpecialBoon","DemeterCastBoon","DemeterSprintBoon","DemeterManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HeraWeaponBoon","HeraSpecialBoon","HeraCastBoon","HeraSprintBoon","HeraManaBoon"]}]}]',
  GoodStuffBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["PoseidonWeaponBoon","PoseidonSpecialBoon","PoseidonCastBoon","PoseidonSprintBoon","PoseidonManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["DemeterWeaponBoon","DemeterSpecialBoon","DemeterCastBoon","DemeterSprintBoon","DemeterManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["RoomRewardBonusBoon","DoubleRewardBoon","BoonGrowthBoon","PlantHealthBoon"]}]}]',
  BurnConsumeBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["DemeterWeaponBoon","DemeterSpecialBoon","DemeterCastBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon"]}]}]',
  ClearRootBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HephaestusWeaponBoon","HephaestusSpecialBoon","HephaestusSprintBoon"]},{"kind":"anyEquippedTrait","traitKeys":["DemeterWeaponBoon","DemeterSpecialBoon","DemeterCastBoon"]}]}]',
  MassiveDamageBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["HephaestusWeaponBoon","HephaestusSpecialBoon","HephaestusSprintBoon"]}]',
  MassiveKnockupBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["HephaestusWeaponBoon","HephaestusSpecialBoon","HephaestusSprintBoon"]}]',
  ElementalDamageBoon: '[{"kind":"elementCount","element":"Earth","minimum":2}]',
  WeaponUpgradeBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HephaestusWeaponBoon","HephaestusSpecialBoon","HephaestusSprintBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HeavyArmorBoon","ArmorBoon","EncounterStartDefenseBuffBoon"]},{"kind":"anyEquippedTrait","traitKeys":["MassiveDamageBoon","AntiArmorBoon","MassiveKnockupBoon"]}]}]',
  ManaShieldBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["DamageShareRetaliateBoon","LinkedDeathDamageBoon","DamageSharePotencyBoon","SpawnCastDamageBoon","OmegaHeraProjectileBoon"]},{"kind":"anyEquippedTrait","traitKeys":["MassiveDamageBoon","AntiArmorBoon","HeavyArmorBoon","ArmorBoon","EncounterStartDefenseBuffBoon","ManaToHealthBoon","MassiveKnockupBoon"]}]}]',
  ReboundingSparkBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["FocusLightningBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HephaestusWeaponBoon","HephaestusSpecialBoon","HephaestusCastBoon","HephaestusSprintBoon","HephaestusManaBoon"]}]}]',
  MassiveCastBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["PoseidonWeaponBoon","PoseidonSpecialBoon","PoseidonCastBoon","PoseidonSprintBoon","PoseidonManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HephaestusWeaponBoon","HephaestusSpecialBoon","HephaestusSprintBoon"]}]}]',
  DoubleMassiveAttackBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HephaestusWeaponBoon","HephaestusSpecialBoon","HephaestusSprintBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon","HestiaSprintBoon","HestiaManaBoon"]}]}]',
  LinkedDeathDamageBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["HeraWeaponBoon","HeraSpecialBoon","HeraCastBoon","HeraSprintBoon"]}]',
  BoonDecayBoon: '[{"kind":"superchargeableTrait"}]',
  DamageSharePotencyBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["HeraWeaponBoon","HeraSpecialBoon","HeraCastBoon","HeraSprintBoon"]}]',
  SpawnCastDamageBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","ApolloCastBoon","DemeterCastBoon","HephaestusCastBoon","HeraCastBoon","HestiaCastBoon","PoseidonCastBoon","ZeusCastBoon","AresCastBoon"]}]',
  CommonGlobalDamageBoon:
    '[{"kind":"godBoonRarityCount","rarity":"Common","minimum":0,"maximum":0}]',
  ElementalRarityUpgradeBoon:
    '[{"kind":"all","requirements":[{"kind":"elementCount","element":"Fire","minimum":1},{"kind":"elementCount","element":"Earth","minimum":1},{"kind":"elementCount","element":"Air","minimum":1},{"kind":"elementCount","element":"Water","minimum":1}]}]',
  AllElementalBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HeraWeaponBoon","HeraSpecialBoon","HeraCastBoon","HeraSprintBoon"]},{"kind":"anyEquippedTrait","traitKeys":["BoonDecayBoon","CommonGlobalDamageBoon","OmegaHeraProjectileBoon"]},{"kind":"anyEquippedTrait","traitKeys":["DamageSharePotencyBoon","SpawnCastDamageBoon"]}]}]',
  SuperSacrificeBoonHera:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HeraWeaponBoon","HeraSpecialBoon","HeraCastBoon","HeraSprintBoon","HeraManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ZeusCastBoon","ZeusManaBoon","ZeusSprintBoon"]}]}]',
  MoneyDamageBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HeraWeaponBoon","HeraSpecialBoon","HeraCastBoon","OmegaHeraProjectileBoon"]},{"kind":"anyEquippedTrait","traitKeys":["PoseidonWeaponBoon","PoseidonSpecialBoon","PoseidonCastBoon","OmegaPoseidonProjectileBoon"]},{"kind":"anyEquippedTrait","traitKeys":["OmegaHeraProjectileBoon","OmegaPoseidonProjectileBoon"]}]}]',
  ManaRestoreDamageBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HeraWeaponBoon","HeraSpecialBoon","HeraCastBoon","HeraSprintBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon","HestiaSprintBoon","HestiaManaBoon"]}]}]',
  OmegaZeroBurnBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon"]}]',
  BurnArmorBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon"]}]',
  BurnStackBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon"]}]',
  ElementalBaseDamageBoon: '[{"kind":"elementCount","element":"Fire","minimum":2}]',
  BurnSprintBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon"]},{"kind":"anyEquippedTrait","traitKeys":["BurnExplodeBoon","BurnArmorBoon","BurnStackBoon","OmegaZeroBurnBoon"]},{"kind":"anyEquippedTrait","traitKeys":["CastProjectileBoon","FireballManaSpecialBoon"]}]}]',
  EchoBurnBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["ZeusWeaponBoon","ZeusSpecialBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon"]}]}]',
  SteamBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["PoseidonCastBoon","PoseidonStatusBoon"]},{"kind":"anyEquippedTrait","traitKeys":["HestiaWeaponBoon","HestiaSpecialBoon","HestiaCastBoon","HestiaSprintBoon","FireballManaSpecialBoon","CastProjectileBoon"]}]}]',
  RoomRewardBonusBoon: '[{"kind":"offerContext","context":"blockGiftBoons","required":false}]',
  PoseidonStatusBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["PoseidonWeaponBoon","PoseidonSpecialBoon"]}]',
  PoseidonExCastBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","ApolloCastBoon","DemeterCastBoon","HephaestusCastBoon","HeraCastBoon","HestiaCastBoon","PoseidonCastBoon","ZeusCastBoon","AresCastBoon"]}]',
  ElementalHealthBoon: '[{"kind":"elementCount","element":"Water","minimum":2}]',
  AmplifyConeBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["PoseidonWeaponBoon","PoseidonSpecialBoon"]},{"kind":"anyEquippedTrait","traitKeys":["PoseidonSprintBoon","PoseidonManaBoon","PoseidonExCastBoon"]},{"kind":"anyEquippedTrait","traitKeys":["EncounterStartOffenseBuffBoon","OmegaPoseidonProjectileBoon","PoseidonStatusBoon","FocusDamageShaveBoon"]}]}]',
  LightningVulnerabilityBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["PoseidonCastBoon","PoseidonStatusBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ZeusWeaponBoon","ZeusSpecialBoon","ZeusCastBoon","ZeusSprintBoon","BoltRetaliateBoon","CastAnywhereBoon"]}]}]',
  CastAnywhereBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeCastBoon","ApolloCastBoon","DemeterCastBoon","HephaestusCastBoon","HeraCastBoon","HestiaCastBoon","PoseidonCastBoon","ZeusCastBoon","AresCastBoon"]},{"kind":"notEquippedTrait","traitKeys":["CastProjectileBoon","HadesCastProjectileBoon","CastLobBoon","SelfCastBoon"]}]',
  DoubleBoltBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["ZeusWeaponBoon","ZeusSpecialBoon","ZeusCastBoon","ZeusSprintBoon","ZeusManaBoltBoon","BoltRetaliateBoon","CastAnywhereBoon"]}]',
  EchoExpirationBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["ZeusWeaponBoon","ZeusSpecialBoon"]}]',
  LightningDebuffGeneratorBoon: '[{"kind":"anyEquippedTrait","traitKeys":["FocusLightningBoon"]}]',
  ElementalDamageFloorBoon: '[{"kind":"elementCount","element":"Air","minimum":3}]',
  SpawnKillBoon:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["ZeusWeaponBoon","ZeusSpecialBoon","ZeusCastBoon","ZeusSprintBoon","ZeusManaBoon"]},{"kind":"anyEquippedTrait","traitKeys":["FocusLightningBoon","ZeusManaBoltBoon","CastAnywhereBoon","BoltRetaliateBoon"]},{"kind":"anyEquippedTrait","traitKeys":["EchoExpirationBoon","DoubleBoltBoon","LightningDebuffGeneratorBoon"]}]}]',
  SuperSacrificeBoonZeus:
    '[{"kind":"all","requirements":[{"kind":"anyEquippedTrait","traitKeys":["HeraCastBoon","HeraManaBoon","HeraSprintBoon"]},{"kind":"anyEquippedTrait","traitKeys":["ZeusWeaponBoon","ZeusSpecialBoon","ZeusCastBoon","ZeusSprintBoon","ZeusManaBoon"]}]}]',
  MoneyMultiplierBoon: '[{"kind":"offerContext","context":"blockGiftBoons","required":false}]',
  LuckyBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["DoubleRewardBoon","PoseidonCastBoon","PoseidonStatusBoon","BoltRetaliateBoon","DoubleBoltBoon","SpawnKillBoon","BlindChanceBoon","DoubleStrikeChanceBoon","CritBonusBoon","HighHealthCritBoon","InsideCastCritBoon","TimedCritVulnerabilityBoon","FocusCritBoon","DashOmegaBuffBoon","SorceryCritBoon","AresManaBoon","BloodDropRevengeBoon","MissingHealthCritBoon","AresStatusDoubleDamageBoon","DoubleSplashBoon","BloodManaBurstBoon","MoneyDamageBoon"]}]',
  ElementalUnifiedBoon: '[{"kind":"highestBaseElementCount","minimum":4}]',
  TimeStopLastStandBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["HermesWeaponBoon","HermesSpecialBoon","HermesCastDiscountBoon","SprintShieldBoon","SorcerySpeedBoon","DodgeChanceBoon","SlowProjectileBoon","MoneyMultiplierBoon","TimedKillBuffBoon","RestockBoon","LuckyBoon"]}]',
  LobAmmoMagnetismTrait: '[{"kind":"notEquippedTrait","traitKeys":["LobPulseAmmoTrait"]}]',
  LobPulseAmmoTrait: '[{"kind":"notEquippedTrait","traitKeys":["LobAmmoMagnetismTrait"]}]',
};

describe('trait offer catalog closure', () => {
  const traits = {
    weapons: catalog.weapons,
    aspects: catalog.aspects,
    traits: catalog.traits,
    givers: catalog.traitGivers,
    offerContexts: catalog.traitOfferContexts,
    rarityOrder: catalog.traitRarityOrder,
    baseElements: catalog.traitBaseElements,
  };

  it('declares the complete Gate-A provider surfaces', () => {
    expect(traits).toBeDefined();
    expect(traits?.weapons.values).toHaveLength(6);
    expect(traits?.aspects.values).toHaveLength(24);
    expect(traits?.traits.values).toHaveLength(285);
    expect(traits?.givers.values.map((giver) => [giver.key, giver.traitKeys.length])).toEqual([
      ['Aphrodite', 22],
      ['Artemis', 9],
      ['Athena', 8],
      ['Apollo', 22],
      ['Ares', 22],
      ['Demeter', 22],
      ['Hephaestus', 22],
      ['Hera', 22],
      ['Hestia', 22],
      ['Poseidon', 22],
      ['Zeus', 22],
      ['Hermes', 13],
      ['WeaponUpgrade', 92],
    ]);
    expect(
      Object.fromEntries(traits?.givers.values.map((giver) => [giver.key, giver.traitKeys])),
    ).toEqual(expectedGiverPools);
    expect(declarations.traitCatalog.deferredTraitKeys).toEqual(expectedDeferredTraitKeys);
    for (const [giverKey, priorityTraitKeys] of Object.entries(expectedPriorityTraitKeys)) {
      expect(traits.givers.byKey[giverKey]?.priorityTraitKeys).toEqual(priorityTraitKeys);
    }
    expect(traits.givers.byKey.Hermes?.priorityTraitKeys).toEqual([]);
    expect(traits.givers.byKey.WeaponUpgrade?.priorityTraitKeys).toEqual([]);
  });

  it('keeps shared traits giver-neutral and closes deferred operands without placeholders', () => {
    expect(traits?.givers.byKey.Aphrodite?.traitKeys).toContain('SprintEchoBoon');
    expect(traits?.givers.byKey.Zeus?.traitKeys).toContain('SprintEchoBoon');
    expect(traits?.traits.byKey.SprintEchoBoon).toBeDefined();
    expect(traits?.traits.byKey.SorceryCritBoon).toBeDefined();
    expect(declarations.traitCatalog.deferredTraitKeys).toContain('SpellLaserTrait');
    expect(traits?.traits.byKey.SorceryCritBoon?.rarityDomain).toEqual({
      kind: 'ranked',
      freshOfferRarities: ['Common', 'Rare', 'Epic'],
      equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    });
  });

  it('normalizes rarity, element, context, and derived-fact contracts', () => {
    expect(traits?.rarityOrder).toEqual(['Common', 'Rare', 'Epic', 'Heroic']);
    expect(traits?.baseElements).toEqual(['Earth', 'Air', 'Fire', 'Water']);
    expect(traits?.offerContexts.byKey.devotionNoDuo?.blockedRarity).toBe('Duo');
    expect(traits?.offerContexts.byKey.blockGiftBoons?.roomFlag).toBe('BlockGiftBoons');
    expect(traits?.givers.byKey.Aphrodite?.rarityPolicy).toEqual({
      kind: 'selectable',
      rarities: ['Common', 'Rare', 'Epic'],
    });

    const allElemental = traits?.traits.byKey.AllElementalBoon;
    expect(allElemental?.elementContributions).toEqual({
      Aether: 1,
      Earth: 1,
      Air: 1,
      Fire: 1,
      Water: 1,
    });
    expect(traits?.traits.byKey.CommonGlobalDamageBoon?.offerRequirements).toContainEqual({
      kind: 'godBoonRarityCount',
      rarity: 'Common',
      minimum: 0,
      maximum: 0,
    });
    expect(traits?.traits.byKey.BoonGrowthBoon?.offerRequirements).toContainEqual({
      kind: 'rarifiableTrait',
    });
    expect(traits?.traits.byKey.BoonDecayBoon?.offerRequirements).toContainEqual({
      kind: 'superchargeableTrait',
    });
    expect(traits?.traits.byKey.ElementalUnifiedBoon?.offerRequirements).toContainEqual({
      kind: 'highestBaseElementCount',
      minimum: 4,
    });
    expect(traits?.traits.byKey.ElementalDamageBoon?.offerRequirements).toContainEqual({
      kind: 'elementCount',
      element: 'Earth',
      minimum: 2,
    });
    expect(traits?.traits.byKey.PlantHealthBoon?.offerRequirements).toContainEqual({
      kind: 'offerContext',
      context: 'blockGiftBoons',
      required: false,
    });

    expect(
      Object.fromEntries(
        traits.traits.values
          .filter((trait) => trait.ordinaryBoonSlot !== undefined)
          .map((trait) => [trait.key, trait.ordinaryBoonSlot]),
      ),
    ).toEqual(expectedOrdinarySlots);

    expect(
      Object.fromEntries(
        catalog.traitElements.map((element) => [
          element,
          traits.traits.values
            .filter((trait) => trait.elementContributions[element] !== undefined)
            .map((trait) => trait.key)
            .sort(),
        ]),
      ),
    ).toEqual(expectedElementTraitKeys);
    expect(
      new Set(traits.traits.values.flatMap((trait) => Object.values(trait.elementContributions))),
    ).toEqual(new Set([1]));

    // The declaration set is the source expected map for the normalized
    // classification. Compare every included trait, including the 92
    // no-rarity Hammers, rather than sampling only the ten infusion traits.
    for (const expected of declarations.traitCatalog.traits) {
      const actual = traits.traits.byKey[expected.key];
      expect(actual).toBeDefined();
      if (actual === undefined) continue;
      expect({
        key: actual.key,
        label: actual.label,
        rarityDomain: actual.rarityDomain,
        offerRequirements: actual.offerRequirements,
        ordinaryBoonSlot: actual.ordinaryBoonSlot,
        elementContributions: actual.elementContributions,
        isPersistentGodTrait: actual.isPersistentGodTrait,
        blockStacking: actual.blockStacking,
        blockInRunRarify: actual.blockInRunRarify,
        excludeFromRarityCount: actual.excludeFromRarityCount,
        selfExclusion: actual.selfExclusion,
        hammerCompatibility: actual.hammerCompatibility,
      }).toEqual({
        key: expected.key,
        label: expected.label,
        rarityDomain:
          expected.hammerCompatibility === undefined
            ? {
                kind: 'ranked',
                freshOfferRarities: expected.freshOfferRarities,
                equippedRarities: expected.equippedRarities,
              }
            : { kind: 'none' },
        offerRequirements: expected.offerRequirements,
        ordinaryBoonSlot: expected.ordinaryBoonSlot,
        elementContributions: expected.elementContributions,
        isPersistentGodTrait: expected.isPersistentGodTrait,
        blockStacking: expected.blockStacking,
        blockInRunRarify: expected.blockInRunRarify,
        excludeFromRarityCount: expected.excludeFromRarityCount,
        selfExclusion: expected.selfExclusion,
        hammerCompatibility: expected.hammerCompatibility,
      });
    }
    expect(traits.traits.values).toHaveLength(declarations.traitCatalog.traits.length);
    expect(traits?.traits.byKey.ElementalOlympianDamageBoon?.rarityDomain).toEqual({
      kind: 'ranked',
      freshOfferRarities: ['Common', 'Rare', 'Epic'],
      equippedRarities: ['Common', 'Rare', 'Epic'],
    });
    expect(Object.isFrozen(traits.traits.byKey.AphroditeWeaponBoon?.rarityDomain)).toBe(true);
    expect(Object.isFrozen(traits.traits.byKey.StaffDoubleAttackTrait?.rarityDomain)).toBe(true);
  });

  it('closes the complete audited dependency, negative, threshold, and aspect matrices', () => {
    type Requirement = (typeof traits.traits.values)[number]['offerRequirements'][number];
    const containsPositiveEquippedRequirement = (requirement: Requirement): boolean => {
      if (requirement.kind === 'anyEquippedTrait') return true;
      if (requirement.kind === 'all')
        return requirement.requirements.some(containsPositiveEquippedRequirement);
      return false;
    };
    const positiveOwners = traits.traits.values
      .filter((trait) => trait.offerRequirements.some(containsPositiveEquippedRequirement))
      .map((trait) => trait.key);
    expect(positiveOwners).toHaveLength(expectedPositiveRequirementOwners.length);
    expect(new Set(positiveOwners)).toEqual(new Set(expectedPositiveRequirementOwners));

    const actualOfferRequirements = Object.fromEntries(
      traits.traits.values
        .filter((trait) => trait.offerRequirements.length > 0)
        .map((trait) => [trait.key, JSON.stringify(trait.offerRequirements)]),
    );
    expect(actualOfferRequirements).toEqual(expectedOfferRequirements);

    const deferred = new Set([
      ...declarations.traitCatalog.deferredTraitKeys,
      'HadesCastProjectileBoon',
      'CastLobBoon',
    ]);
    const walk = (
      requirement: (typeof traits.traits.values)[number]['offerRequirements'][number],
    ): readonly string[] => {
      if (requirement.kind === 'anyEquippedTrait' || requirement.kind === 'notEquippedTrait') {
        return requirement.traitKeys;
      }
      if (requirement.kind === 'all') return requirement.requirements.flatMap(walk);
      return [];
    };
    for (const trait of traits.traits.values) {
      for (const requirement of trait.offerRequirements) {
        for (const key of walk(requirement)) {
          expect(traits.traits.byKey[key] ?? deferred.has(key)).toBeTruthy();
        }
      }
    }
    expect(traits.traits.byKey.LobAmmoMagnetismTrait?.offerRequirements).toContainEqual({
      kind: 'notEquippedTrait',
      traitKeys: ['LobPulseAmmoTrait'],
    });
    expect(traits.traits.byKey.LobPulseAmmoTrait?.offerRequirements).toContainEqual({
      kind: 'notEquippedTrait',
      traitKeys: ['LobAmmoMagnetismTrait'],
    });

    expect(Object.keys(expectedHammerRestrictions)).toHaveLength(48);
    for (const [traitKey, aspectKeys] of Object.entries(expectedHammerRestrictions)) {
      expect(traits.traits.byKey[traitKey]?.hammerCompatibility?.aspectKeys).toEqual(aspectKeys);
    }
    expect(traits.traits.values.filter((trait) => trait.hammerCompatibility)).toHaveLength(92);
    expect(
      traits.traits.values.filter(
        (trait) => trait.hammerCompatibility && trait.hammerCompatibility.aspectKeys.length === 4,
      ),
    ).toHaveLength(44);

    const thresholds: Readonly<Record<string, unknown>> = {
      ElementalUnifiedBoon: { kind: 'highestBaseElementCount', minimum: 4 },
      ElementalDamageBoon: { kind: 'elementCount', element: 'Earth', minimum: 2 },
      ElementalOlympianDamageBoon: { kind: 'elementCount', element: 'Earth', minimum: 4 },
      ElementalBaseDamageBoon: { kind: 'elementCount', element: 'Fire', minimum: 2 },
      ElementalRallyBoon: { kind: 'elementCount', element: 'Fire', minimum: 2 },
      ElementalDamageFloorBoon: { kind: 'elementCount', element: 'Air', minimum: 3 },
      ElementalDodgeBoon: { kind: 'elementCount', element: 'Air', minimum: 2 },
      ElementalDamageCapBoon: { kind: 'elementCount', element: 'Water', minimum: 4 },
      ElementalHealthBoon: { kind: 'elementCount', element: 'Water', minimum: 2 },
    };
    for (const [traitKey, threshold] of Object.entries(thresholds)) {
      expect(traits.traits.byKey[traitKey]?.offerRequirements).toContainEqual(threshold);
    }
    expect(traits.traits.byKey.ElementalRarityUpgradeBoon?.offerRequirements).toContainEqual({
      kind: 'all',
      requirements: [
        { kind: 'elementCount', element: 'Fire', minimum: 1 },
        { kind: 'elementCount', element: 'Earth', minimum: 1 },
        { kind: 'elementCount', element: 'Air', minimum: 1 },
        { kind: 'elementCount', element: 'Water', minimum: 1 },
      ],
    });
    expect(traits.traits.byKey.ElementalRarityUpgradeBoon?.rarityFloorEffect).toEqual({
      activationElementMinimums: { Fire: 2, Earth: 2, Air: 2, Water: 2 },
      fromRarity: 'Common',
      minimumRarity: 'Rare',
    });
    expect(Object.isFrozen(traits.traits.byKey.ElementalRarityUpgradeBoon?.rarityFloorEffect)).toBe(
      true,
    );
    expect(
      Object.isFrozen(
        traits.traits.byKey.ElementalRarityUpgradeBoon?.rarityFloorEffect
          ?.activationElementMinimums,
      ),
    ).toBe(true);
    expect(traits.traits.byKey.HeraWeaponBoon?.rarityFloorEffect).toBeUndefined();
  });

  it('rejects malformed declaration-owned rarity floors at catalog construction', () => {
    const proper = declarations.traitCatalog.traits.find(
      (trait) => trait.key === 'ElementalRarityUpgradeBoon',
    );
    if (proper === undefined) throw new Error('missing Proper Upbringing declaration');
    const malformed = (effect: object) =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === proper.key
              ? {
                  ...trait,
                  // Deliberately malformed values enter through the raw declaration boundary.
                  rarityFloorEffect: effect as unknown as ScalableGodTraitRarityFloorEffect,
                }
              : trait,
          ),
        },
      });
    expect(() =>
      malformed({ fromRarity: 'Common', minimumRarity: 'Rare', activationElementMinimums: {} }),
    ).toThrow(/must not be empty/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Lightning: 2 },
      }),
    ).toThrow(/unknown|must be one of/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 0 },
      }),
    ).toThrow(/positive integer/);
    expect(() =>
      malformed({
        fromRarity: 'Epic',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 2 },
      }),
    ).toThrow(/must be Common/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Common',
        activationElementMinimums: { Fire: 2 },
      }),
    ).toThrow(/must be Rare|must follow/);
    const hammer = declarations.traitCatalog.traits.find(
      (trait) => trait.hammerCompatibility !== undefined,
    );
    if (hammer === undefined) throw new Error('missing Hammer declaration');
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === hammer.key
              ? {
                  ...trait,
                  rarityFloorEffect: {
                    fromRarity: 'Common',
                    minimumRarity: 'Rare',
                    activationElementMinimums: { Fire: 2 },
                  },
                }
              : trait,
          ),
        },
      }),
    ).toThrow(/Hammer traits cannot declare/);
  });

  it('provides a compatible complete Hammer default for every weapon/aspect pair', () => {
    const hammer = traits?.givers.byKey.WeaponUpgrade;
    expect(hammer?.defaultsByLoadout && Object.keys(hammer.defaultsByLoadout)).toHaveLength(24);
    for (const weapon of traits?.weapons.values ?? []) {
      for (const aspectKey of weapon.aspectKeys) {
        const defaults = hammer?.defaultsByLoadout?.[`${weapon.key}:${aspectKey}`];
        expect(defaults?.options).toHaveLength(3);
        for (const option of defaults?.options ?? []) {
          const declaration = traits?.traits.byKey[option.traitKey];
          expect(declaration?.hammerCompatibility?.weaponKey).toBe(weapon.key);
          expect(declaration?.hammerCompatibility?.aspectKeys).toContain(aspectKey);
          expect(option.rarity).toBeUndefined();
        }
      }
    }
  });

  it('rejects unknown pools and incomplete Hammer defaults at the catalog boundary', () => {
    const unknownPool = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver, index) =>
          index === 0 ? { ...giver, traitKeys: [...giver.traitKeys, 'NotARealTrait'] } : giver,
        ),
      },
    };
    expect(() => createCatalog(unknownPool)).toThrow(/unknown trait/);

    const incompleteHammer = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'WeaponUpgrade'
            ? {
                ...giver,
                defaultsByLoadout: Object.fromEntries(
                  Object.entries(giver.defaultsByLoadout ?? {}).filter(
                    ([key]) => key !== 'WeaponStaffSwing:BaseStaffAspect',
                  ),
                ),
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(incompleteHammer)).toThrow(
      /missing WeaponStaffSwing:BaseStaffAspect/,
    );
  });

  it('rejects malformed priority declarations and non-priority Olympian defaults', () => {
    const duplicatePriority = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite'
            ? {
                ...giver,
                priorityTraitKeys: [giver.priorityTraitKeys[0]!, ...giver.priorityTraitKeys],
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(duplicatePriority)).toThrow(/priorityTraitKeys/);

    const nonPriorityDefault = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite' && giver.defaultOffer !== undefined
            ? {
                ...giver,
                defaultOffer: {
                  ...giver.defaultOffer,
                  options: [
                    giver.defaultOffer.options[0]!,
                    giver.defaultOffer.options[1]!,
                    { traitKey: 'RandomStatusBoon', rarity: 'Legendary' as const },
                  ] as const,
                },
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(nonPriorityDefault)).toThrow(/priority traits only/);

    const meleeOnlyDefault = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite' && giver.defaultOffer !== undefined
            ? {
                ...giver,
                defaultOffer: {
                  ...giver.defaultOffer,
                  options: [
                    giver.defaultOffer.options[0]!,
                    giver.defaultOffer.options[2]!,
                    { traitKey: 'AphroditeSprintBoon', rarity: 'Common' as const },
                  ] as const,
                },
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(meleeOnlyDefault)).not.toThrow();

    const noMeleeOrSecondaryDefault = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite' && giver.defaultOffer !== undefined
            ? {
                ...giver,
                defaultOffer: {
                  ...giver.defaultOffer,
                  options: [
                    giver.defaultOffer.options[2]!,
                    { traitKey: 'AphroditeSprintBoon', rarity: 'Common' as const },
                    { traitKey: 'AphroditeManaBoon', rarity: 'Common' as const },
                  ] as const,
                },
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(noMeleeOrSecondaryDefault)).toThrow(/Melee or Secondary traits/);
  });

  it('preserves Legendary rarity while keeping Hammer declarations un-rarified', () => {
    const aphrodite = declarations.traitCatalog.givers.find((giver) => giver.key === 'Aphrodite');
    if (aphrodite === undefined || aphrodite.defaultOffer === undefined) throw new Error('fixture');
    const legendaryDefault = {
      ...aphrodite,
      defaultOffer: {
        ...aphrodite.defaultOffer,
        options: [
          aphrodite.defaultOffer.options[0],
          aphrodite.defaultOffer.options[1],
          { traitKey: 'RandomStatusBoon', rarity: 'Legendary' as const },
        ] as const,
      },
    };
    const valid = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite' ? legendaryDefault : giver,
        ),
      },
    };
    expect(() => createCatalog(valid)).toThrow(/priority traits only/);

    const hammerTrait = declarations.traitCatalog.traits.find(
      (trait) => trait.key === 'StaffTripleShotTrait',
    );
    if (hammerTrait === undefined) throw new Error('fixture');
    const invalidHammer = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === hammerTrait.key
            ? {
                ...trait,
                freshOfferRarities: ['Rare' as const],
                equippedRarities: ['Rare' as const],
              }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(invalidHammer)).toThrow(/no rarity domain/);
    expect(catalog.traitGivers.byKey.WeaponUpgrade?.rarityPolicy).toEqual({ kind: 'none' });
    expect(catalog.traits.byKey.StaffTripleShotTrait?.rarityDomain).toEqual({ kind: 'none' });
    expect(Object.isFrozen(catalog.traitGivers.byKey.WeaponUpgrade?.rarityPolicy)).toBe(true);
  });

  it('rejects malformed raw booleans, rarity domains, and requirement discriminators', () => {
    const invalidBoolean = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, blockStacking: 'false' as unknown as boolean }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(invalidBoolean)).toThrow(/blockStacking: must be boolean/);

    const emptyRanked = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, freshOfferRarities: [] as const }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(emptyRanked)).toThrow(/ranked rarity domains must not be empty/);

    const unknownRarity = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, freshOfferRarities: ['Mythic' as unknown as 'Common'] }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(unknownRarity)).toThrow(/must be one of Common/);

    const emptyGiverRarities = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite'
            ? { ...giver, rarityPolicy: { kind: 'selectable' as const, rarities: [] } }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(emptyGiverRarities)).toThrow(
      /rarityPolicy\.rarities: must not be empty/,
    );

    const hammerRarity = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'WeaponUpgrade'
            ? {
                ...giver,
                defaultsByLoadout: {
                  ...giver.defaultsByLoadout,
                  'WeaponStaffSwing:BaseStaffAspect': {
                    ...giver.defaultsByLoadout?.['WeaponStaffSwing:BaseStaffAspect'],
                    options: [
                      {
                        traitKey: 'StaffDoubleAttackTrait',
                        rarity: 'Common' as const,
                      },
                      ...(giver.defaultsByLoadout?.[
                        'WeaponStaffSwing:BaseStaffAspect'
                      ]?.options.slice(1) ?? []),
                    ] as const,
                  },
                },
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(hammerRarity as never)).toThrow(/has no rarity/);

    const unknownRequirement = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? {
                ...trait,
                offerRequirements: [{ kind: 'futurePredicate' } as never],
              }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(unknownRequirement)).toThrow(/unknown requirement kind/);
  });

  it('rejects malformed raw array and object contacts with declaration paths', () => {
    const malformedRequirements = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, offerRequirements: null as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformedRequirements)).toThrow(
      /traits\[.*\]\.offerRequirements: must be an array/,
    );

    const malformedElements = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, elementContributions: null as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformedElements)).toThrow(
      /traits\[.*\]\.elementContributions: must be an object/,
    );

    const malformedRarities = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, freshOfferRarities: null as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformedRarities)).toThrow(
      /traits\[.*\]\.freshOfferRarities: must be an array/,
    );

    const malformedPolicy = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'WeaponUpgrade' ? { ...giver, rarityPolicy: null as never } : giver,
        ),
      },
    };
    expect(() => createCatalog(malformedPolicy)).toThrow(
      /givers\[.*\]\.rarityPolicy: must be an object/,
    );

    const unsupportedFixedPolicy = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'WeaponUpgrade'
            ? {
                ...giver,
                rarityPolicy: { kind: 'fixed', rarity: 'Common' } as never,
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(unsupportedFixedPolicy)).toThrow(/unknown rarity policy kind fixed/);
  });

  it('keeps compiler-local deferred operands out of the normalized catalog', () => {
    const withoutCompilerKeys = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        deferredTraitKeys: declarations.traitCatalog.deferredTraitKeys,
      },
    };
    const normalized = createCatalog(withoutCompilerKeys);
    expect(normalized.traits.byKey.CastProjectileBoon).toBeDefined();
    expect(normalized.traits.byKey.CastAnywhereBoon).toBeDefined();
    expect(normalized.traits.byKey.SelfCastBoon).toBeDefined();
    expect('deferredTraitKeys' in normalized).toBe(false);
  });
});
