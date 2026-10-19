import iconAncestralOffering from './assets/AncestralOffering.webp';
import iconAzureDress from './assets/AzureDress.webp';
import iconBlackNightBanishment from './assets/BlackNightBanishment.webp';
import iconBoonBoonBoon from './assets/BoonBoonBoon.webp';
import iconBottomlessDrink from './assets/BottomlessDrink.webp';
import iconBounceBack from './assets/BounceBack.webp';
import iconCineraryCircle from './assets/CineraryCircle.webp';
import iconCorrosionOnSight from './assets/CorrosionOnSight.webp';
import iconCrimsonDress from './assets/CrimsonDress.webp';
import iconDeathWarrant from './assets/DeathWarrant.webp';
import iconDeepDissent from './assets/DeepDissent.webp';
import iconDefensivePosture from './assets/DefensivePosture.webp';
import iconDivineDash from './assets/DivineDash.webp';
import iconDrunkenStupor from './assets/DrunkenStupor.webp';
import iconEasyShot from './assets/EasyShot.webp';
import iconEmeraldDress from './assets/EmeraldDress.webp';
import iconEnfeeblementOfCowards from './assets/EnfeeblementOfCowards.webp';
import iconEvadeEvadeEvade from './assets/EvadeEvadeEvade.webp';
import iconExplosiveIntent from './assets/ExplosiveIntent.webp';
import iconFatesTrimmings from './assets/FatesTrimmings.webp';
import iconFightFightFight from './assets/FightFightFight.webp';
import iconFuchsiaDress from './assets/FuchsiaDress.webp';
import iconGiftGiftGift from './assets/GiftGiftGift.webp';
import iconGigarosDash from './assets/GigarosDash.webp';
import iconGildedDress from './assets/GildedDress.webp';
import iconGoldGoldGold from './assets/GoldGoldGold.webp';
import iconHappyHaze from './assets/HappyHaze.webp';
import iconHarmForTheAfflicted from './assets/HarmForTheAfflicted.webp';
import iconHazardBoom from './assets/HazardBoom.webp';
import iconHeartfeltCondolences from './assets/HeartfeltCondolences.webp';
import iconHeavenlySplendor from './assets/HeavenlySplendor.webp';
import iconHowlingSoul from './assets/HowlingSoul.webp';
import iconHymnToTheEyeOfNight from './assets/HymnToTheEyeOfNight.webp';
import iconIngeniousFlourish from './assets/IngeniousFlourish.webp';
import iconIngeniousStrike from './assets/IngeniousStrike.webp';
import iconKillingStroke from './assets/KillingStroke.webp';
import iconLapisLazuliInsight from './assets/LapisLazuliInsight.webp';
import iconLastGasp from './assets/LastGasp.webp';
import iconLatestModel from './assets/LatestModel.webp';
import iconLavenderDress from './assets/LavenderDress.webp';
import iconLethalSnare from './assets/LethalSnare.webp';
import iconLifeFromTheDead from './assets/LifeFromTheDead.webp';
import iconLifeSavings from './assets/LifeSavings.webp';
import iconLifeTax from './assets/LifeTax.webp';
import iconMaliceInKind from './assets/MaliceInKind.webp';
import iconMentalBlock from './assets/MentalBlock.webp';
import iconMixedBlessings from './assets/MixedBlessings.webp';
import iconMoonlightDress from './assets/MoonlightDress.webp';
import iconMysticSecrets from './assets/MysticSecrets.webp';
import iconOldGrudge from './assets/OldGrudge.webp';
import iconOldHerbalRemedy from './assets/OldHerbalRemedy.webp';
import iconOnyxDress from './assets/OnyxDress.webp';
import iconPersonalLoan from './assets/PersonalLoan.webp';
import iconPhalanxShot from './assets/PhalanxShot.webp';
import iconPomPomPom from './assets/PomPomPom.webp';
import iconPreciousMetals from './assets/PreciousMetals.webp';
import iconPressurePoints from './assets/PressurePoints.webp';
import iconPrimalPsychicConnection from './assets/PrimalPsychicConnection.webp';
import iconProtectiveCoating from './assets/ProtectiveCoating.webp';
import iconRecklessAbandon from './assets/RecklessAbandon.webp';
import iconRedCitrineDivination from './assets/RedCitrineDivination.webp';
import iconRenewedFaith from './assets/RenewedFaith.webp';
import iconRewardRewardReward from './assets/RewardRewardReward.webp';
import iconRighteousPike from './assets/RighteousPike.webp';
import iconShadowPounce from './assets/ShadowPounce.webp';
import iconStalwartStand from './assets/StalwartStand.webp';
import iconSufferingOnSight from './assets/SufferingOnSight.webp';
import iconSupplyChain from './assets/SupplyChain.webp';
import iconSupportFire from './assets/SupportFire.webp';
import iconSurviveSurviveSurvive from './assets/SurviveSurviveSurvive.webp';
import iconTaskForce from './assets/TaskForce.webp';
import iconTipsyShot from './assets/TipsyShot.webp';
import iconTracesOfSpirit from './assets/TracesOfSpirit.webp';
import iconTurningToASimpleForm from './assets/TurningToASimpleForm.webp';
import iconUnseenIre from './assets/UnseenIre.webp';
import iconVerdureSampler from './assets/VerdureSampler.webp';
import iconVitalSigns from './assets/VitalSigns.webp';
import iconVolatileCoating from './assets/VolatileCoating.webp';
import iconWealthFromTheDead from './assets/WealthFromTheDead.webp';
import iconWhisperedPrayer from './assets/WhisperedPrayer.webp';
import iconWordOfGreaterGirth from './assets/WordOfGreaterGirth.webp';
import iconWordOfSmallerStature from './assets/WordOfSmallerStature.webp';
import iconWorryFree from './assets/WorryFree.webp';

/** Field and story NPC boon icons by catalog trait key; `null` marks a key with no icon yet. */
export const npcBoonArtwork: Readonly<Record<string, string | null>> = {
  SupportingFireBoon: iconSupportFire,
  CritBonusBoon: iconPressurePoints,
  DashOmegaBuffBoon: iconShadowPounce,
  HighHealthCritBoon: iconVitalSigns,
  InsideCastCritBoon: iconLethalSnare,
  OmegaCastVolleyBoon: iconEasyShot,
  TimedCritVulnerabilityBoon: iconDeathWarrant,
  FocusCritBoon: iconKillingStroke,
  SorceryCritBoon: iconWhisperedPrayer,
  InvulnerabilityDashBoon: iconDivineDash,
  RetaliateInvulnerabilityBoon: iconDefensivePosture,
  FocusLastStandBoon: iconStalwartStand,
  DeathDefianceRefillBoon: iconRenewedFaith,
  AthenaProjectileBoon: iconPhalanxShot,
  InvulnerabilityCastBoon: iconMentalBlock,
  ManaSpearBoon: iconRighteousPike,
  OlympianSpellCountBoon: iconTaskForce,
  FocusAttackDamageTrait: iconIngeniousStrike,
  FocusSpecialDamageTrait: iconIngeniousFlourish,
  OmegaExplodeBoon: iconExplosiveIntent,
  CastHazardBoon: iconHazardBoom,
  BreakInvincibleArmorBoon: iconProtectiveCoating,
  BreakExplosiveArmorBoon: iconVolatileCoating,
  SupplyDropBoon: iconSupplyChain,
  UpgradeHammerBoon: iconLatestModel,
  AgilityCostume: iconLavenderDress,
  ManaCostume: iconAzureDress,
  VitalityCostume: iconEmeraldDress,
  HighArmorCostume: iconOnyxDress,
  CastDamageCostume: iconFuchsiaDress,
  IncomeCostume: iconGildedDress,
  SpellCostume: iconMoonlightDress,
  EscalatingCostume: iconCrimsonDress,
  CirceShrinkTrait: iconWordOfSmallerStature,
  CirceEnlargeTrait: iconWordOfGreaterGirth,
  ArcanaRarityTrait: iconLapisLazuliInsight,
  HealAmplifyTrait: iconOldHerbalRemedy,
  DoubleFamiliarTrait: iconPrimalPsychicConnection,
  RemoveShrineTrait: iconBlackNightBanishment,
  RandomArcanaTrait: iconRedCitrineDivination,
  CirceSorceryDamageBoon: iconHymnToTheEyeOfNight,
  ExPolymorphBoon: iconTurningToASimpleForm,
  CastLobBoon: iconTipsyShot,
  HiddenMaxHealthBoon: iconWorryFree,
  FirstHangoverBoon: iconDrunkenStupor,
  CombatEncounterHealBoon: iconBounceBack,
  PowerDrinkBoon: iconBottomlessDrink,
  FogDamageBonusBoon: iconHappyHaze,
  BankBoon: iconPersonalLoan,
  RandomBaseDamageBoon: iconRecklessAbandon,
  EchoLastReward: iconRewardRewardReward,
  EchoDeathDefianceRefill: iconSurviveSurviveSurvive,
  DiminishingDodgeBoon: iconEvadeEvadeEvade,
  DiminishingHealthAndManaBoon: iconFightFightFight,
  EchoLastRunBoon: iconBoonBoonBoon,
  EchoDoubleLevelBoon: iconPomPomPom,
  EchoDoubleShop: iconGoldGoldGold,
  EchoRepeatKeepsakeBoon: iconGiftGiftGift,
  HadesLifestealBoon: iconLifeTax,
  HadesCastProjectileBoon: iconHowlingSoul,
  HadesPreDamageBoon: iconOldGrudge,
  HadesChronosDebuffBoon: iconDeepDissent,
  HadesDashSweepBoon: iconGigarosDash,
  HadesDeathDefianceDamageBoon: iconLastGasp,
  HadesManaUrnBoon: iconCineraryCircle,
  HadesInvisibilityRetaliateBoon: iconUnseenIre,
  HealingOnDeathCurse: iconLifeFromTheDead,
  MoneyOnDeathCurse: iconWealthFromTheDead,
  ManaOverTimeCurse: iconTracesOfSpirit,
  SpawnDamageCurse: iconSufferingOnSight,
  ArmorPenaltyCurse: iconCorrosionOnSight,
  SlowProjectileCurse: iconEnfeeblementOfCowards,
  DeathDefianceRetaliateCurse: iconMaliceInKind,
  NewStatusDamage: iconHarmForTheAfflicted,
  NarcissusA: iconVerdureSampler,
  NarcissusB: iconHeartfeltCondolences,
  NarcissusC: iconPreciousMetals,
  NarcissusD: iconMysticSecrets,
  NarcissusE: iconAncestralOffering,
  NarcissusF: iconFatesTrimmings,
  NarcissusG: iconHeavenlySplendor,
  NarcissusH: iconLifeSavings,
  NarcissusI: iconMixedBlessings,
};
