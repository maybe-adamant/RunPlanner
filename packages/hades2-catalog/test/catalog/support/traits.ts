import { declarations } from '../../../src/declarations';

export const expectedPositiveRequirementOwners = [
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
  'FocusAttackDamageTrait',
  'FocusSpecialDamageTrait',
] as const;

export const expectedSettledSpellDropRequirementOwners = ['OlympianSpellCountBoon'] as const;

export const expectedOrdinarySlots = Object.fromEntries(
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

export const expectedPriorityTraitKeys: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
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

export const expectedHammersWithoutRankII = sourceKeys(`
  StaffDashAttackTrait StaffTripleShotTrait StaffOneWayAttackTrait
  StaffRaiseDeadDoubleTrait DaggerSpecialConsecutiveTrait DaggerDashAttackTripleTrait
  AxeMassiveThirdStrikeTrait AxeFreeSpinTrait AxeArmorTrait AxeSecondStageTrait
  AxeDashAttackTrait AxeRallyFrenzyTrait AxeRallyFirstStrikeTrait
  TorchExSpecialCountTrait TorchSpecialSpeedTrait TorchSpecialLineTrait TorchSplitAttackTrait
  TorchEnhancedAttackTrait TorchDiscountExAttackTrait LobRushArmorTrait LobSpreadShotTrait
  LobInOutSpecialExTrait LobGunAttackDoublerTrait SuitArmorTrait SuitDashAttackTrait
  SuitSpecialStartUpTrait SuitSpecialBlockTrait
`);

export const expectedElementTraitKeys = {
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

export const expectedHammerRestrictions: Readonly<Record<string, readonly string[]>> = {
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

export const expectedGiverPools: Readonly<Record<string, readonly string[]>> = {
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

export const expectedDeferredTraitKeys = [
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

export const expectedOfferRequirements: Readonly<Record<string, string>> = {
  ArcanaRarityTrait: '[{"kind":"manualArcanaGraspCost","minimum":1}]',
  RemoveShrineTrait: '[{"kind":"offerContext","context":"circeRemovableFearVow","required":true}]',
  CirceSorceryDamageBoon:
    '[{"kind":"anyEquippedTrait","traitKeys":["SpellLaserTrait","SpellLeapTrait","SpellSummonTrait","SpellMeteorTrait","SpellTransformTrait","SpellMoonBeamTrait","SpellPolymorphTrait"]}]',
  NarcissusA: '[{"kind":"upgradableTrait"}]',
  HadesCastProjectileBoon:
    '[{"kind":"notEquippedTrait","traitKeys":["CastProjectileBoon","CastAnywhereBoon","CastLobBoon","SelfCastBoon"]}]',
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
  OlympianSpellCountBoon: '[{"kind":"settledSpellDrop"}]',
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
  FocusAttackDamageTrait:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeWeaponBoon","ApolloWeaponBoon","AresWeaponBoon","DemeterWeaponBoon","HephaestusWeaponBoon","HeraWeaponBoon","HestiaWeaponBoon","PoseidonWeaponBoon","ZeusWeaponBoon"]}]',
  FocusSpecialDamageTrait:
    '[{"kind":"anyEquippedTrait","traitKeys":["AphroditeSpecialBoon","ApolloSpecialBoon","AresSpecialBoon","DemeterSpecialBoon","HephaestusSpecialBoon","HeraSpecialBoon","HestiaSpecialBoon","PoseidonSpecialBoon","ZeusSpecialBoon"]}]',
};
