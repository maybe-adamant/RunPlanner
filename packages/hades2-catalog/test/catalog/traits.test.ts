import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';
import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../../src/declarations/traits';
import type { ProperUpbringingEffect } from '@run-planner/engine/catalog-schema';

const expectedPositiveRequirementOwners = [
  'CirceSorceryDamageBoon',
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

const expectedHammersWithoutRankII = sourceKeys(`
  StaffDashAttackTrait StaffTripleShotTrait StaffOneWayAttackTrait
  StaffRaiseDeadDoubleTrait DaggerSpecialConsecutiveTrait DaggerDashAttackTripleTrait
  AxeMassiveThirdStrikeTrait AxeFreeSpinTrait AxeArmorTrait AxeSecondStageTrait
  AxeDashAttackTrait AxeRallyFrenzyTrait AxeRallyFirstStrikeTrait
  TorchExSpecialCountTrait TorchSpecialSpeedTrait TorchSpecialLineTrait TorchSplitAttackTrait
  TorchEnhancedAttackTrait TorchDiscountExAttackTrait LobRushArmorTrait LobSpreadShotTrait
  LobInOutSpecialExTrait LobGunAttackDoublerTrait SuitArmorTrait SuitDashAttackTrait
  SuitSpecialStartUpTrait SuitSpecialBlockTrait
`);

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
    AmplifyConeBoon LuckyBoon CastLobBoon HiddenMaxHealthBoon FirstHangoverBoon
    CombatEncounterHealBoon PowerDrinkBoon FogDamageBonusBoon BankBoon
    RandomBaseDamageBoon
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
  Chaos: [
    ...declarations.traitCatalog.chaos.curses.map((trait) => trait.key),
    ...declarations.traitCatalog.chaos.blessings.map((trait) => trait.key),
  ],
  Echo: [
    'EchoLastReward',
    'EchoDeathDefianceRefill',
    'DiminishingDodgeBoon',
    'DiminishingHealthAndManaBoon',
    'EchoLastRunBoon',
    'EchoDoubleLevelBoon',
    'EchoDoubleShop',
    'EchoRepeatKeepsakeBoon',
  ],
  Circe: [
    'CirceShrinkTrait',
    'CirceEnlargeTrait',
    'ArcanaRarityTrait',
    'HealAmplifyTrait',
    'DoubleFamiliarTrait',
    'RemoveShrineTrait',
    'RandomArcanaTrait',
    'CirceSorceryDamageBoon',
    'ExPolymorphBoon',
  ],
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
  Arachne: [
    'AgilityCostume',
    'ManaCostume',
    'VitalityCostume',
    'HighArmorCostume',
    'CastDamageCostume',
    'IncomeCostume',
    'SpellCostume',
    'EscalatingCostume',
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
  Dionysus: [
    'CastLobBoon',
    'HiddenMaxHealthBoon',
    'FirstHangoverBoon',
    'CombatEncounterHealBoon',
    'PowerDrinkBoon',
    'FogDamageBonusBoon',
    'BankBoon',
    'RandomBaseDamageBoon',
  ],
  Hades: [
    'HadesLifestealBoon',
    'HadesCastProjectileBoon',
    'HadesPreDamageBoon',
    'HadesChronosDebuffBoon',
    'HadesDashSweepBoon',
    'HadesDeathDefianceDamageBoon',
    'HadesManaUrnBoon',
    'HadesInvisibilityRetaliateBoon',
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
  Medea: [
    'HealingOnDeathCurse',
    'MoneyOnDeathCurse',
    'ManaOverTimeCurse',
    'SpawnDamageCurse',
    'ArmorPenaltyCurse',
    'SlowProjectileCurse',
    'DeathDefianceRetaliateCurse',
    'NewStatusDamage',
  ],
  Narcissus: [
    'NarcissusA',
    'NarcissusB',
    'NarcissusC',
    'NarcissusD',
    'NarcissusE',
    'NarcissusF',
    'NarcissusG',
    'NarcissusH',
    'NarcissusI',
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
  Icarus: [
    'FocusAttackDamageTrait',
    'FocusSpecialDamageTrait',
    'OmegaExplodeBoon',
    'CastHazardBoon',
    'BreakInvincibleArmorBoon',
    'BreakExplosiveArmorBoon',
    'SupplyDropBoon',
    'UpgradeHammerBoon',
  ],
  SpellDrop: [
    'SpellPolymorphTrait',
    'SpellMeteorTrait',
    'SpellTransformTrait',
    'SpellLeapTrait',
    'SpellLaserTrait',
    'SpellSummonTrait',
    'SpellTimeSlowTrait',
    'SpellPotionTrait',
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
  'SummonHeraTalent',
  'TimeSlowDemeterTalent',
  'TransformAphroditeTalent',
] as const;

const expectedOfferRequirements: Readonly<Record<string, string>> = {
  ArcanaRarityTrait: '[{"kind":"manualArcanaGraspCost","minimum":1}]',
  RemoveShrineTrait: '[{"kind":"offerContext","context":"circeRemovableFearVow","required":true}]',
  CirceSorceryDamageBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["SpellLaserTrait","SpellLeapTrait","SpellSummonTrait","SpellMeteorTrait","SpellTransformTrait","SpellMoonBeamTrait","SpellPolymorphTrait"]}]',
  NarcissusA: '[{"kind":"upgradableTrait"}]',
  NarcissusH: '[{"kind":"offerContext","context":"deathDefianceConditionMet","required":true}]',
  EchoDeathDefianceRefill:
    '[{"kind":"offerContext","context":"deathDefianceConditionMet","required":true}]',
  DeathDefianceRefillBoon:
    '[{"kind":"offerContext","context":"deathDefianceConditionMet","required":true}]',
  DeathDefianceRetaliateCurse:
    '[{"kind":"offerContext","context":"deathDefianceConditionMet","required":true}]',
  HadesCastProjectileBoon:
    '[{"kind":"notEquippedTrait","traitKeys":["CastProjectileBoon","CastAnywhereBoon","CastLobBoon","SelfCastBoon"]}]',
  HadesDeathDefianceDamageBoon:
    '[{"kind":"offerContext","context":"deathDefianceConditionMet","required":true}]',
  CastLobBoon:
    '[{"kind":"notEquippedTrait","traitKeys":["CastProjectileBoon","CastAnywhereBoon","HadesCastProjectileBoon","SelfCastBoon"]}]',
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
  FocusAttackDamageTrait: '[{"kind":"ordinaryBoonSlotOccupied","slot":"Melee"}]',
  FocusSpecialDamageTrait: '[{"kind":"ordinaryBoonSlotOccupied","slot":"Secondary"}]',
};

describe('trait offer catalog closure', () => {
  it('normalizes one closed audited Olympian and Hermes boon-rarity base table', () => {
    expect(catalog.boonRarityBases.olympian).toEqual({
      Rare: 0.1,
      Epic: 0.05,
      Duo: 0.12,
      Legendary: 0.1,
    });
    expect(catalog.boonRarityBases.hermes).toEqual({
      Rare: 0.06,
      Epic: 0.03,
      Duo: 0,
      Legendary: 0.01,
    });
    expect(catalog.traitGivers.byKey.Apollo).not.toHaveProperty('boonRarityBase');
    expect(catalog.traitGivers.byKey.Hermes).not.toHaveProperty('boonRarityBase');
  });

  it('rejects incomplete, extra, and non-finite provider base declarations', () => {
    const malformed = (boonRarityBases: object) =>
      createCatalog({
        ...declarations,
        traitCatalog: { ...declarations.traitCatalog, boonRarityBases: boonRarityBases as never },
      });
    expect(() =>
      malformed({ olympian: declarations.traitCatalog.boonRarityBases.olympian }),
    ).toThrow(/exactly olympian and hermes/);
    expect(() =>
      malformed({
        ...declarations.traitCatalog.boonRarityBases,
        npc: declarations.traitCatalog.boonRarityBases.hermes,
      }),
    ).toThrow(/exactly olympian and hermes/);
    expect(() =>
      malformed({
        ...declarations.traitCatalog.boonRarityBases,
        hermes: { ...declarations.traitCatalog.boonRarityBases.hermes, Duo: Number.NaN },
      }),
    ).toThrow(/finite number/);
  });

  const traits = {
    weapons: catalog.weapons,
    aspects: catalog.aspects,
    traits: catalog.traits,
    givers: catalog.traitGivers,
    echoLastRunBoon: catalog.echoLastRunBoon,
    offerContexts: catalog.traitOfferContexts,
    rarityOrder: catalog.traitRarityOrder,
    baseElements: catalog.traitBaseElements,
  };

  it('declares Selene’s eight normal spells and Aspect-owned Sky Fall exactly', () => {
    expect(traits.givers.byKey.SpellDrop).toMatchObject({
      providerKind: 'spell',
      traitKeys: [
        'SpellPolymorphTrait',
        'SpellMeteorTrait',
        'SpellTransformTrait',
        'SpellLeapTrait',
        'SpellLaserTrait',
        'SpellSummonTrait',
        'SpellTimeSlowTrait',
        'SpellPotionTrait',
      ],
    });
    expect(traits.aspects.byKey.SuitHexAspect?.startingTrait).toEqual({
      traitKey: 'SpellMoonBeamTrait',
      giverKey: 'SpellDrop',
    });
    for (const key of [...traits.givers.byKey.SpellDrop!.traitKeys, 'SpellMoonBeamTrait'])
      expect(traits.traits.byKey[key]?.equipmentSlot).toBe('Spell');
  });

  it('rejects malformed Aspect starting spell links', () => {
    const mutate = (startingTrait: unknown) =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          aspects: declarations.traitCatalog.aspects.map((aspect) =>
            aspect.key === 'SuitHexAspect'
              ? {
                  ...aspect,
                  startingTrait: startingTrait as { traitKey: string; giverKey: string },
                }
              : aspect,
          ),
        },
      });
    expect(() => mutate({ traitKey: 'UnknownSpell', giverKey: 'SpellDrop' })).toThrow(
      /unknown trait/,
    );
    expect(() => mutate({ traitKey: 'SpellPolymorphTrait', giverKey: 'SpellDrop' })).toThrow(
      /must not belong to the normal spell pool/,
    );
    expect(() => mutate({ traitKey: 'SpellMoonBeamTrait', giverKey: 'Apollo' })).toThrow(
      /must identify a spell provider/,
    );
    expect(() =>
      mutate({ traitKey: 'SpellMoonBeamTrait', giverKey: 'SpellDrop', extra: true }),
    ).toThrow(/exactly traitKey and giverKey/);
    expect(() => mutate({ traitKey: '', giverKey: 'SpellDrop' })).toThrow(/must not be empty/);
  });

  it('declares the complete field-NPC provider surfaces', () => {
    expect(traits).toBeDefined();
    expect(traits?.weapons.values).toHaveLength(6);
    expect(traits?.aspects.values).toHaveLength(24);
    expect(traits?.traits.values).toHaveLength(419);
    expect(traits?.givers.values.map((giver) => [giver.key, giver.traitKeys.length])).toEqual([
      ['Aphrodite', 22],
      ['Arachne', 8],
      ['Artemis', 9],
      ['Athena', 8],
      ['Icarus', 8],
      ['Apollo', 22],
      ['Ares', 22],
      ['Demeter', 22],
      ['Dionysus', 8],
      ['Hades', 8],
      ['Hephaestus', 22],
      ['Hera', 22],
      ['Hestia', 22],
      ['Poseidon', 22],
      ['Zeus', 22],
      ['Hermes', 13],
      ['Medea', 8],
      ['Narcissus', 9],
      ['Circe', 9],
      ['Echo', 8],
      ['WeaponUpgrade', 92],
      ['SpellDrop', 8],
      ['Chaos', 33],
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
      duration: { minimum: 2, maximum: 3 },
    });
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

  it('declares the exact player-rarityless Story and field-NPC matrix', () => {
    const raritylessProviders = [
      'Arachne',
      'Icarus',
      'Medea',
      'Narcissus',
      'Circe',
      'Hades',
    ] as const;
    for (const giverKey of raritylessProviders) {
      const giver = traits.givers.byKey[giverKey];
      expect(giver?.rarityPolicy, giverKey).toEqual({ kind: 'none' });
      for (const traitKey of giver?.traitKeys ?? []) {
        expect(traits.traits.byKey[traitKey], `${giverKey}:${traitKey}`).toMatchObject({
          rarityDomain: { kind: 'none' },
          usesBoonRarity: false,
          blockInRunRarify: giverKey === 'Hades',
        });
      }
    }

    for (const giverKey of ['Athena', 'Artemis', 'Dionysus'] as const) {
      const giver = traits.givers.byKey[giverKey];
      expect(giver?.rarityPolicy.kind, giverKey).toBe('selectable');
      expect(
        giver?.traitKeys.every((key) => traits.traits.byKey[key]?.rarityDomain.kind === 'ranked'),
      ).toBe(true);
    }
  });

  it('declares the landed Echo matrix as rarityless with closed dispositions', () => {
    const giver = traits.givers.byKey.Echo;
    expect(giver?.rarityPolicy).toEqual({ kind: 'none' });
    expect(giver?.traitKeys).toEqual([
      'EchoLastReward',
      'EchoDeathDefianceRefill',
      'DiminishingDodgeBoon',
      'DiminishingHealthAndManaBoon',
      'EchoLastRunBoon',
      'EchoDoubleLevelBoon',
      'EchoDoubleShop',
      'EchoRepeatKeepsakeBoon',
    ]);
    expect(
      giver?.traitKeys.map((key) => ({
        key,
        rarityDomain: traits.traits.byKey[key]?.rarityDomain,
        disposition: traits.traits.byKey[key]?.selectedDisposition,
      })),
    ).toEqual([
      {
        key: 'EchoLastReward',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'lastReward' },
      },
      {
        key: 'EchoDeathDefianceRefill',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'survive' },
      },
      {
        key: 'DiminishingDodgeBoon',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'numericNoOp' },
      },
      {
        key: 'DiminishingHealthAndManaBoon',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'numericNoOp' },
      },
      {
        key: 'EchoLastRunBoon',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'lastRunBoon' },
      },
      {
        key: 'EchoDoubleLevelBoon',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'doubleLevel' },
      },
      {
        key: 'EchoDoubleShop',
        rarityDomain: { kind: 'none' },
        disposition: {
          kind: 'echo',
          effect: 'doubleShop',
          excludedRewardTypes: ['SpellDrop'],
        },
      },
      {
        key: 'EchoRepeatKeepsakeBoon',
        rarityDomain: { kind: 'none' },
        disposition: {
          kind: 'echo',
          effect: 'repeatKeepsake',
          excludedKeepsakeKeys: [
            'AthenaEncounterKeepsake',
            'HadesAndPersephoneKeepsake',
            'EscalatingKeepsake',
            'FountainRarityKeepsake',
          ],
        },
      },
    ]);
  });

  it('declares Infernal Contract as rarityless and Travel Deal as one exact ranked restock', () => {
    expect(traits.traits.byKey.InfernalContractBoon).toMatchObject({
      rarityDomain: { kind: 'none' },
      blockStacking: true,
      blockInRunRarify: true,
      excludeFromRarityCount: true,
    });
    expect(traits.traits.byKey.RestockBoon?.selectedDisposition).toEqual({
      kind: 'worldShopRestock',
      refillCount: 1,
      discountByRarity: { Common: 0.05, Rare: 0.1, Epic: 0.15, Heroic: 0.2 },
    });
  });

  it('compiler-closes All Together to the exact immutable four-pair direct-grant matrix', () => {
    const expected = {
      kind: 'directTraitSets',
      sets: [
        {
          key: 'earth',
          traitKeys: ['ElementalDamageBoon', 'ElementalOlympianDamageBoon'],
        },
        {
          key: 'fire',
          traitKeys: ['ElementalBaseDamageBoon', 'ElementalRallyBoon'],
        },
        {
          key: 'air',
          traitKeys: ['ElementalDamageFloorBoon', 'ElementalDodgeBoon'],
        },
        {
          key: 'water',
          traitKeys: ['ElementalHealthBoon', 'ElementalDamageCapBoon'],
        },
      ],
    } as const;
    const disposition = catalog.traits.byKey.AllElementalBoon?.selectedDisposition;
    expect(disposition).toEqual(expected);
    expect(Object.isFrozen(disposition)).toBe(true);
    if (disposition?.kind !== 'directTraitSets') throw new Error('missing All Together descriptor');
    expect(Object.isFrozen(disposition.sets)).toBe(true);
    expect(
      disposition.sets.every((set) => Object.isFrozen(set) && Object.isFrozen(set.traitKeys)),
    ).toBe(true);

    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'AllElementalBoon'
              ? ({
                  ...trait,
                  selectedDisposition: {
                    ...expected,
                    sets: [expected.sets[0], expected.sets[2], expected.sets[1], expected.sets[3]],
                  },
                } as RawTraitDeclaration)
              : trait,
          ),
        },
      }),
    ).toThrow(/must declare earth, fire, air, and water in source order/);

    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'HeraWeaponBoon'
              ? ({ ...trait, selectedDisposition: expected } as RawTraitDeclaration)
              : trait,
          ),
        },
      }),
    ).toThrow(/direct trait sets are reserved for All Together/);
  });

  it('compiler-closes Gold Gold Gold to excluding exactly SpellDrop', () => {
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'EchoDoubleShop'
              ? ({
                  ...trait,
                  selectedDisposition: { kind: 'echo', effect: 'doubleShop' },
                } as RawTraitDeclaration)
              : trait,
          ),
        },
      }),
    ).toThrow(/requires kind, effect, and excludedRewardTypes/);

    const mutatedExcludedTypes = [['GiftDrop'], ['SpellDrop', 'GiftDrop']] as const;
    for (const excludedRewardTypes of mutatedExcludedTypes) {
      expect(() =>
        createCatalog({
          ...declarations,
          traitCatalog: {
            ...declarations.traitCatalog,
            traits: declarations.traitCatalog.traits.map((trait) =>
              trait.key === 'EchoDoubleShop'
                ? ({
                    ...trait,
                    selectedDisposition: {
                      kind: 'echo',
                      effect: 'doubleShop',
                      excludedRewardTypes,
                    },
                  } as RawTraitDeclaration)
                : trait,
            ),
          },
        }),
      ).toThrow(/must equal \[SpellDrop\]/);
    }
  });

  it('declares Echo Boon as the exact source-resolved 13-provider union', () => {
    const variants = traits.echoLastRunBoon.variants.values;
    expect([...new Set(variants.map((variant) => variant.giverKey))]).toEqual([
      'Aphrodite',
      'Apollo',
      'Ares',
      'Demeter',
      'Hephaestus',
      'Hera',
      'Hestia',
      'Poseidon',
      'Zeus',
      'Hermes',
      'Artemis',
      'Athena',
      'Dionysus',
    ]);
    expect(variants).toHaveLength(236);
    expect(
      variants.every((variant) => {
        const trait = traits.traits.byKey[variant.traitKey];
        return trait?.rarityDomain.kind === 'ranked';
      }),
    ).toBe(true);
    expect(traits.echoLastRunBoon.variants.byKey['Hades:CastProjectileBoon']).toBeUndefined();
    expect(traits.echoLastRunBoon.variants.byKey['Aphrodite:SprintEchoBoon']).toEqual({
      key: 'Aphrodite:SprintEchoBoon',
      giverKey: 'Aphrodite',
      traitKey: 'SprintEchoBoon',
      lootHistorySource: 'AphroditeUpgrade',
    });
    expect(traits.echoLastRunBoon.variants.byKey['Zeus:SprintEchoBoon']).toEqual({
      key: 'Zeus:SprintEchoBoon',
      giverKey: 'Zeus',
      traitKey: 'SprintEchoBoon',
      lootHistorySource: 'ZeusUpgrade',
    });
    expect(traits.echoLastRunBoon.variants.byKey['Artemis:SupportingFireBoon']).toEqual(
      expect.not.objectContaining({ lootHistorySource: expect.anything() }),
    );
    expect(
      variants
        .filter(
          (variant) => traits.traits.byKey[variant.traitKey]?.targetedAcquisition !== undefined,
        )
        .map((variant) => variant.key),
    ).toEqual(['Hera:BoonDecayBoon']);
    expect(
      variants
        .filter((variant) => variant.requiresDeathDefianceCondition === true)
        .map((variant) => variant.key),
    ).toEqual(['Athena:DeathDefianceRefillBoon']);
    expect(
      variants
        .filter(
          (variant) =>
            traits.traits.byKey[variant.traitKey]?.selectedDisposition.kind ===
            'advanceCurrentKeepsake',
        )
        .map((variant) => variant.key),
    ).toEqual(['Demeter:KeepsakeLevelBoon', 'Hera:KeepsakeLevelBoon']);
  });

  it('rejects duplicate and rarityless Echo-last-run sources at the catalog boundary', () => {
    const duplicateSource = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        echoLastRunBoon: {
          ...declarations.traitCatalog.echoLastRunBoon,
          sources: [
            ...declarations.traitCatalog.echoLastRunBoon.sources,
            { giverKey: 'Apollo', lootHistorySource: 'ApolloUpgrade' },
          ],
        },
      },
    };
    expect(() => createCatalog(duplicateSource)).toThrow(/distinct participating givers/);

    const raritylessSource = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        echoLastRunBoon: {
          ...declarations.traitCatalog.echoLastRunBoon,
          sources: [{ giverKey: 'Echo' }],
        },
      },
    };
    expect(() => createCatalog(raritylessSource)).toThrow(
      /Echo cannot participate in Echo's last-run domain/,
    );
  });

  it('rejects an unknown Echo disposition effect at the raw declaration boundary', () => {
    const malformed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'EchoDoubleLevelBoon'
            ? {
                ...trait,
                selectedDisposition: { kind: 'echo', effect: 'unexpected' } as never,
              }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformed)).toThrow(
      /selectedDisposition.effect.*numericNoOp.*survive.*doubleLevel/,
    );
  });

  it('keeps shared traits giver-neutral and closes deferred operands without placeholders', () => {
    expect(traits?.givers.byKey.Aphrodite?.traitKeys).toContain('SprintEchoBoon');
    expect(traits?.givers.byKey.Zeus?.traitKeys).toContain('SprintEchoBoon');
    expect(traits?.traits.byKey.SprintEchoBoon).toBeDefined();
    expect(traits?.traits.byKey.SorceryCritBoon).toBeDefined();
    expect(declarations.traitCatalog.deferredTraitKeys).not.toContain('SpellLaserTrait');
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
    expect(traits?.offerContexts.byKey.deathDefianceConditionMet).toEqual({
      key: 'deathDefianceConditionMet',
      kind: 'authoredCondition',
      authoredCondition: 'deathDefianceConditionMet',
    });
    expect(traits?.givers.byKey.Aphrodite?.rarityPolicy).toEqual({
      kind: 'selectable',
      rarities: ['Common', 'Rare', 'Epic'],
    });
    expect(traits?.givers.byKey.Icarus?.rarityPolicy).toEqual({ kind: 'none' });
    expect(traits?.givers.byKey.Hades?.rarityPolicy).toEqual({ kind: 'none' });
    expect(traits?.givers.byKey.Dionysus?.rarityPolicy).toEqual({
      kind: 'selectable',
      rarities: ['Common', 'Rare', 'Epic'],
    });
    for (const traitKey of expectedGiverPools.Hades ?? []) {
      expect(traits.traits.byKey[traitKey]).toMatchObject({
        rarityDomain: { kind: 'none' },
        elementContributions: {},
        usesBoonRarity: false,
        isCoreGodTrait: false,
        blockStacking: false,
        blockInRunRarify: true,
        excludeFromRarityCount: false,
      });
      expect(traits.traits.byKey[traitKey]?.equipmentSlot).toBeUndefined();
    }
    for (const traitKey of expectedGiverPools.Dionysus ?? []) {
      expect(traits.traits.byKey[traitKey]).toMatchObject({
        rarityDomain: {
          kind: 'ranked',
          freshOfferRarities: ['Common', 'Rare', 'Epic'],
          equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
        },
        elementContributions: { Water: 1 },
        usesBoonRarity: true,
        isCoreGodTrait: false,
        blockStacking: false,
        blockInRunRarify: false,
        excludeFromRarityCount: false,
      });
      expect(traits.traits.byKey[traitKey]?.equipmentSlot).toBeUndefined();
    }
    expect(traits?.traits.byKey.FocusAttackDamageTrait?.offerRequirements).toEqual([
      { kind: 'ordinaryBoonSlotOccupied', slot: 'Melee' },
    ]);
    expect(traits?.traits.byKey.FocusSpecialDamageTrait?.offerRequirements).toEqual([
      { kind: 'ordinaryBoonSlotOccupied', slot: 'Secondary' },
    ]);
    expect(traits?.traits.byKey.UpgradeHammerBoon?.targetedAcquisition).toEqual({
      kind: 'upgradeHammerToRank2',
      target: 'upgradableHammer',
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
    expect(traits?.traits.byKey.BoonDecayBoon?.targetedAcquisition).toEqual({
      kind: 'promoteGodTraitToHeroic',
      target: 'superchargeableGodTrait',
    });
    expect(traits?.traits.byKey.HephaestusWeaponBoon?.maximumEligibleLevelByRarity).toEqual({
      Common: 9,
      Rare: 7,
      Epic: 5,
      Heroic: 3,
    });
    expect(traits?.traits.byKey.HephaestusSpecialBoon?.maximumEligibleLevelByRarity).toEqual({
      Common: 11,
      Rare: 9,
      Epic: 7,
      Heroic: 5,
    });
    expect(traits?.traits.byKey.HephaestusSprintBoon?.maximumEligibleLevelByRarity).toEqual({
      Common: 8,
      Rare: 7,
      Epic: 6,
      Heroic: 5,
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
          .filter((trait) => trait.equipmentSlot !== undefined && trait.equipmentSlot !== 'Spell')
          .map((trait) => [trait.key, trait.equipmentSlot]),
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
    // classification. Compare every included trait, including explicit
    // rarityless NPC declarations and the 92 no-rarity Hammers.
    const expectedCoreGodTraitKeys = new Set(
      declarations.traitCatalog.givers
        .filter((giver) => giver.providerKind === 'olympian')
        .flatMap((giver) => giver.traitKeys),
    );
    for (const expected of declarations.traitCatalog.traits) {
      const actual = traits.traits.byKey[expected.key];
      expect(actual).toBeDefined();
      if (actual === undefined) continue;
      expect({
        key: actual.key,
        label: actual.label,
        rarityDomain: actual.rarityDomain,
        offerRequirements: actual.offerRequirements,
        equipmentSlot: actual.equipmentSlot,
        elementContributions: actual.elementContributions,
        usesBoonRarity: actual.usesBoonRarity,
        isCoreGodTrait: actual.isCoreGodTrait,
        blockStacking: actual.blockStacking,
        blockInRunRarify: actual.blockInRunRarify,
        excludeFromRarityCount: actual.excludeFromRarityCount,
        selfExclusion: actual.selfExclusion,
        hammerCompatibility: actual.hammerCompatibility,
      }).toEqual({
        key: expected.key,
        label: expected.label,
        rarityDomain:
          expected.hammerCompatibility === undefined && expected.rarityDomain !== 'none'
            ? {
                kind: 'ranked',
                freshOfferRarities: expected.freshOfferRarities,
                equippedRarities: expected.equippedRarities,
              }
            : { kind: 'none' },
        offerRequirements: expected.offerRequirements,
        equipmentSlot: expected.equipmentSlot,
        elementContributions: expected.elementContributions,
        usesBoonRarity: expected.usesBoonRarity,
        isCoreGodTrait: expectedCoreGodTraitKeys.has(expected.key),
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

    const deferred = new Set(declarations.traitCatalog.deferredTraitKeys);
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
      traits.traits.values.filter((trait) => trait.hammerCompatibility?.supportsRankII),
    ).toHaveLength(65);
    expect(
      traits.traits.values
        .filter(
          (trait) =>
            trait.hammerCompatibility !== undefined && !trait.hammerCompatibility.supportsRankII,
        )
        .map((trait) => trait.key)
        .sort(),
    ).toEqual(expectedHammersWithoutRankII);
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
      boonRarityContribution: { additive: { Rare: 1 } },
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
                  rarityFloorEffect: effect as unknown as ProperUpbringingEffect,
                }
              : trait,
          ),
        },
      });
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: {},
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/must not be empty/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Lightning: 2 },
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/unknown|must be one of/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 0 },
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/positive integer/);
    expect(() =>
      malformed({
        fromRarity: 'Epic',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 2 },
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/must be Common/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Common',
        activationElementMinimums: { Fire: 2 },
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/must be Rare|must follow/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 2 },
      }),
    ).toThrow(/exactly the Proper Upbringing effect fields/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 2 },
        boonRarityContribution: { additive: { Rare: 1, Epic: 0 } },
      }),
    ).toThrow(/exactly Rare: 1/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 2 },
        boonRarityContribution: { additive: { Rare: 0 } },
      }),
    ).toThrow(/exactly Rare: 1/);
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
                    boonRarityContribution: { additive: { Rare: 1 } },
                  },
                }
              : trait,
          ),
        },
      }),
    ).toThrow(/reserved to ElementalRarityUpgradeBoon/);
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'HeraWeaponBoon'
              ? { ...trait, rarityFloorEffect: proper.rarityFloorEffect! }
              : trait,
          ),
        },
      }),
    ).toThrow(/reserved to ElementalRarityUpgradeBoon/);
  });

  it('rejects unknown pools at the catalog boundary', () => {
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
  });

  it('rejects malformed priority declarations and retired giver authoring seeds', () => {
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

    const retiredSeed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite'
            ? {
                ...giver,
                defaultOffer: {
                  options: [
                    { traitKey: 'AphroditeWeaponBoon', rarity: 'Common' as const },
                    { traitKey: 'AphroditeSpecialBoon', rarity: 'Common' as const },
                    { traitKey: 'AphroditeCastBoon', rarity: 'Common' as const },
                  ] as const,
                  selectedOption: 0 as const,
                },
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(retiredSeed as typeof declarations)).toThrow(
      /defaultOffer.*not supported/,
    );
  });

  it('preserves Legendary rarity while keeping Hammer declarations un-rarified', () => {
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
    expect(() => createCatalog(invalidHammer)).toThrow(/rarityless traits cannot declare/);
    expect(catalog.traitGivers.byKey.WeaponUpgrade?.rarityPolicy).toEqual({ kind: 'none' });
    expect(catalog.traits.byKey.StaffTripleShotTrait?.rarityDomain).toEqual({ kind: 'none' });
    expect(Object.isFrozen(catalog.traitGivers.byKey.WeaponUpgrade?.rarityPolicy)).toBe(true);
  });

  it('rejects malformed rarityless declarations and giver policies', () => {
    const withTrait = (
      traitKey: string,
      replacement: (trait: RawTraitDeclaration) => RawTraitDeclaration,
    ) => ({
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === traitKey ? replacement(trait) : trait,
        ),
      },
    });

    expect(() =>
      createCatalog(
        withTrait('DiminishingDodgeBoon', (trait) => ({
          ...trait,
          freshOfferRarities: ['Common'],
          equippedRarities: ['Common'],
        })),
      ),
    ).toThrow(/explicitly rarityless traits must omit rarity arrays/);
    for (const rarityArrays of [
      { freshOfferRarities: [] },
      { equippedRarities: [] },
      { freshOfferRarities: [], equippedRarities: [] },
    ] as const) {
      expect(() =>
        createCatalog(
          withTrait('DiminishingDodgeBoon', (trait) => ({ ...trait, ...rarityArrays })),
        ),
      ).toThrow(/explicitly rarityless traits must omit rarity arrays/);
    }
    expect(() =>
      createCatalog(
        withTrait('DiminishingDodgeBoon', (trait) => ({ ...trait, usesBoonRarity: true })),
      ),
    ).toThrow(/rarityless traits cannot use boon rarity/);
    expect(() =>
      createCatalog(
        withTrait('AphroditeWeaponBoon', (trait) => {
          const {
            freshOfferRarities: _freshOfferRarities,
            equippedRarities: _equippedRarities,
            ...withoutRarityArrays
          } = trait;
          void _freshOfferRarities;
          void _equippedRarities;
          return withoutRarityArrays;
        }),
      ),
    ).toThrow(/ranked rarity domains must not be empty/);

    const withGiver = (
      giverKey: string,
      replacement: (giver: RawTraitGiverDeclaration) => RawTraitGiverDeclaration,
    ) => ({
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === giverKey ? replacement(giver) : giver,
        ),
      },
    });
    expect(() =>
      createCatalog(
        withGiver('Aphrodite', (giver) => ({ ...giver, rarityPolicy: { kind: 'none' } })),
      ),
    ).toThrow(/no-rarity givers require only rarityless members/);
    expect(() =>
      createCatalog(
        withGiver('Echo', (giver) => ({
          ...giver,
          rarityPolicy: { kind: 'fixed', rarity: 'Common' },
        })),
      ),
    ).toThrow(/ranked giver policies cannot contain rarityless members/);
    for (const [giverKey, rarityPolicy] of [
      ['Echo', { kind: 'none', rarity: 'Common' }],
      ['Aphrodite', { kind: 'fixed', rarity: 'Common', rarities: ['Common'] }],
      ['Aphrodite', { kind: 'selectable', rarities: ['Common'], rarity: 'Common' }],
    ] as const) {
      expect(() =>
        createCatalog(
          withGiver(giverKey, (giver) => ({
            ...giver,
            rarityPolicy: rarityPolicy as unknown as RawTraitGiverDeclaration['rarityPolicy'],
          })),
        ),
      ).toThrow(/rarity policy must contain exactly/);
    }
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
                rarityPolicy: { kind: 'fixed' as const, rarity: 'Common' as const },
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(hammerRarity as never)).toThrow(
      /Hammer givers require no rarity authorship/,
    );

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
    expect(() => createCatalog(unsupportedFixedPolicy)).toThrow(
      /Hammer givers require no rarity authorship/,
    );
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

  it('declares the complete Narcissus disposition table without modeled outer effects', () => {
    const table = Object.fromEntries(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((suffix) => {
        const trait = catalog.traits.byKey[`Narcissus${suffix}`];
        if (trait === undefined) throw new Error(`missing Narcissus${suffix}`);
        return [suffix, trait.selectedDisposition];
      }),
    );
    expect(table).toEqual({
      A: expect.objectContaining({
        kind: 'producePickups',
        pickups: [{ key: 'pom', rewardType: 'StoreRewardRandomStack' }],
      }),
      B: expect.objectContaining({
        kind: 'producePickups',
        pickups: [{ key: 'ashes', rewardType: 'MetaCardPointsCommonDrop' }],
      }),
      C: expect.objectContaining({
        kind: 'producePickups',
        pickups: [{ key: 'currency', rewardType: 'Currency' }],
      }),
      D: expect.objectContaining({
        kind: 'producePickups',
        pickups: [
          { key: 'psyche', rewardType: 'MemPointsCommonDrop' },
          { key: 'maxMana', rewardType: 'MaxManaDrop' },
        ],
      }),
      E: expect.objectContaining({
        kind: 'producePickups',
        pickups: [
          { key: 'bones', rewardType: 'MetaCurrencyDrop' },
          { key: 'maxHealth', rewardType: 'MaxHealthDrop' },
        ],
      }),
      F: { kind: 'noOp' },
      G: expect.objectContaining({
        kind: 'producePickups',
        pickups: [
          { key: 'elementalBoost1', rewardType: 'ElementalBoost' },
          { key: 'elementalBoost2', rewardType: 'ElementalBoost' },
        ],
      }),
      H: expect.objectContaining({
        kind: 'producePickups',
        pickups: [{ key: 'lastStand', rewardType: 'LastStandDrop' }],
      }),
      I: expect.objectContaining({
        kind: 'producePickups',
        pickups: [{ key: 'mysteryBoon', rewardType: 'BlindBoxLoot' }],
      }),
    });
  });

  it('owns Cherished Heirloom as the sole exact rank-one keepsake advance disposition', () => {
    expect(catalog.traits.byKey.KeepsakeLevelBoon?.selectedDisposition).toEqual({
      kind: 'advanceCurrentKeepsake',
      rankBonus: 1,
    });
    expect(
      catalog.traits.values.filter(
        (trait) => trait.selectedDisposition.kind === 'advanceCurrentKeepsake',
      ),
    ).toHaveLength(1);
  });

  it.each([
    ['missing', undefined],
    ['wrong rank', { kind: 'advanceCurrentKeepsake', rankBonus: 2 }],
    ['wrong kind', { kind: 'noOp' }],
  ] as const)('rejects a %s Cherished keepsake advance declaration', (_label, disposition) => {
    const malformed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'KeepsakeLevelBoon'
            ? { ...trait, selectedDisposition: disposition as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformed)).toThrow(/KeepsakeLevelBoon|rankBonus 1/);
  });

  it('rejects the Cherished disposition on any other trait', () => {
    const malformed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'ApolloWeaponBoon'
            ? {
                ...trait,
                selectedDisposition: { kind: 'advanceCurrentKeepsake', rankBonus: 1 } as never,
              }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformed)).toThrow(/reserved for KeepsakeLevelBoon/);
  });

  it.each([
    [
      'unknown pickup lifecycle',
      { producerLifecycleKey: 'MissingLifecycle' },
      /unknown producer lifecycle/,
    ],
    [
      'unknown pickup reward',
      { pickups: [{ key: 'pom', rewardType: 'MissingReward' }] },
      /unknown reward type/,
    ],
    [
      'lifecycle reward mismatch',
      { producerLifecycleKey: 'RoomReward' },
      /not supported by producer lifecycle/,
    ],
  ] as const)('rejects Narcissus pickup declaration with %s', (_name, patch, message) => {
    const malformed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'NarcissusA'
            ? { ...trait, selectedDisposition: { ...trait.selectedDisposition, ...patch } as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformed)).toThrow(message);
  });

  it.each([
    [
      'moved to another core trait',
      'ApolloWeaponBoon',
      { Common: 1, Rare: 1, Epic: 1, Heroic: 1 },
      /reserved/,
    ],
    [
      'moved to a non-Pom trait',
      'HephaestusManaBoon',
      { Common: 1, Rare: 1, Epic: 1, Heroic: 1 },
      /reserved/,
    ],
    ['partial rarities', 'HephaestusWeaponBoon', { Common: 1, Rare: 1, Epic: 1 }, /cover exactly/],
    [
      'zero cap',
      'HephaestusWeaponBoon',
      { Common: 0, Rare: 1, Epic: 1, Heroic: 1 },
      /positive integer/,
    ],
  ] as const)(
    'rejects malformed declaration-owned cooldown upgrade limits: %s',
    (_name, traitKey, caps, message) => {
      const malformed = {
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === traitKey
              ? {
                  ...trait,
                  maximumEligibleLevelByRarity: caps as never,
                }
              : trait,
          ),
        },
      };
      expect(() => createCatalog(malformed)).toThrow(message);
    },
  );
});
