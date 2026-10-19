import iconAbundance from './assets/Abundance.webp';
import iconAccumulation from './assets/Accumulation.webp';
import iconAlacrity from './assets/Alacrity.webp';
import iconAllureOfAphrodite from './assets/AllureOfAphrodite.webp';
import iconAmbition from './assets/Ambition.webp';
import iconBearing from './assets/Bearing.webp';
import iconBloodthirst from './assets/Bloodthirst.webp';
import iconBrilliance from './assets/Brilliance.webp';
import iconBrutality from './assets/Brutality.webp';
import iconCalm from './assets/Calm.webp';
import iconCascade from './assets/Cascade.webp';
import iconClarity from './assets/Clarity.webp';
import iconConfluence from './assets/Confluence.webp';
import iconConsequence from './assets/Consequence.webp';
import iconConservation from './assets/Conservation.webp';
import iconContact from './assets/Contact.webp';
import iconContingency from './assets/Contingency.webp';
import iconDecline from './assets/Decline.webp';
import iconDevastation from './assets/Devastation.webp';
import iconDevotion from './assets/Devotion.webp';
import iconDispersion from './assets/Dispersion.webp';
import iconDominion from './assets/Dominion.webp';
import iconDuality from './assets/Duality.webp';
import iconEminence from './assets/Eminence.webp';
import iconEruption from './assets/Eruption.webp';
import iconExcess from './assets/Excess.webp';
import iconExodus from './assets/Exodus.webp';
import iconExposure from './assets/Exposure.webp';
import iconExtinction from './assets/Extinction.webp';
import iconFerocity from './assets/Ferocity.webp';
import iconFocus from './assets/Focus.webp';
import iconFortune from './assets/Fortune.webp';
import iconFragmentation from './assets/Fragmentation.webp';
import iconFrenzy from './assets/Frenzy.webp';
import iconGrowth from './assets/Growth.webp';
import iconHandOfHephaestus from './assets/HandOfHephaestus.webp';
import iconHearthOfHestia from './assets/HearthOfHestia.webp';
import iconHorror from './assets/Horror.webp';
import iconHumility from './assets/Humility.webp';
import iconHunger from './assets/Hunger.webp';
import iconInfection from './assets/Infection.webp';
import iconInstinct from './assets/Instinct.webp';
import iconIntensity from './assets/Intensity.webp';
import iconLanceOfAres from './assets/LanceOfAres.webp';
import iconLethality from './assets/Lethality.webp';
import iconLineage from './assets/Lineage.webp';
import iconMagnitude from './assets/Magnitude.webp';
import iconNumbness from './assets/Numbness.webp';
import iconNurtureOfHera from './assets/NurtureOfHera.webp';
import iconObstinance from './assets/Obstinance.webp';
import iconOmen from './assets/Omen.webp';
import iconOrchestration from './assets/Orchestration.webp';
import iconOverflow from './assets/Overflow.webp';
import iconPanacea from './assets/Panacea.webp';
import iconPatience from './assets/Patience.webp';
import iconPrecision from './assets/Precision.webp';
import iconPreparation from './assets/Preparation.webp';
import iconPrideOfPoseidon from './assets/PrideOfPoseidon.webp';
import iconPrism from './assets/Prism.webp';
import iconProminence from './assets/Prominence.webp';
import iconPurification from './assets/Purification.webp';
import iconPurity from './assets/Purity.webp';
import iconPurpose from './assets/Purpose.webp';
import iconRadiance from './assets/Radiance.webp';
import iconResonance from './assets/Resonance.webp';
import iconRetaliation from './assets/Retaliation.webp';
import iconRigor from './assets/Rigor.webp';
import iconSanctity from './assets/Sanctity.webp';
import iconSaturation from './assets/Saturation.webp';
import iconSavagery from './assets/Savagery.webp';
import iconSelflessness from './assets/Selflessness.webp';
import iconServitude from './assets/Servitude.webp';
import iconShineOfApollo from './assets/ShineOfApollo.webp';
import iconSoftness from './assets/Softness.webp';
import iconSplendor from './assets/Splendor.webp';
import iconSpread from './assets/Spread.webp';
import iconSquallOfDemeter from './assets/SquallOfDemeter.webp';
import iconSteadfastness from './assets/Steadfastness.webp';
import iconStillness from './assets/Stillness.webp';
import iconSting from './assets/Sting.webp';
import iconSustenance from './assets/Sustenance.webp';
import iconTemperOfZeus from './assets/TemperOfZeus.webp';
import iconTenacity from './assets/Tenacity.webp';
import iconTension from './assets/Tension.webp';
import iconTribulation from './assets/Tribulation.webp';
import iconTrinity from './assets/Trinity.webp';
import iconUrgency from './assets/Urgency.webp';
import iconVastness from './assets/Vastness.webp';
import iconVicinity from './assets/Vicinity.webp';
import iconVigor from './assets/Vigor.webp';
import iconZeal from './assets/Zeal.webp';

/** Path of Stars node icons by catalog talent key; `null` marks a key with no icon yet. */
export const hexNodeArtwork: Readonly<Record<string, string | null>> = {
  PolymorphBossDamageTalent: iconAmbition,
  PolymorphDeathExplodeTalent: iconExtinction,
  PolymorphTauntTalent: iconSpread,
  PolymorphTeleportCastTalent: iconOrchestration,
  PolymorphHealthCrushTalent: iconDecline,
  PolymorphSandwichTalent: iconSustenance,
  PolymorphCurseTalent: iconInfection,
  CooldownDamageTalent: iconPurpose,
  ChargeRegenTalent: iconGrowth,
  PolymorphDurationTalent: iconHumility,
  PolymorphDamageTalent: iconExposure,
  PolymorphZeusTalent: iconTemperOfZeus,
  OlympianSpellCountTalent: iconLineage,
  MeteorVulnerabilityDecalTalent: iconSoftness,
  MeteorSlowDecalTalent: iconNumbness,
  MeteorShowerTalent: iconFragmentation,
  MeteorChargeTalent: iconConsequence,
  MeteorInvulnerableChargeTalent: iconEminence,
  MeteorDoubleTalent: iconDevastation,
  MeteorExCastTalent: iconExcess,
  PreChargeTalent: iconPreparation,
  MeteorSizeTalent: iconVastness,
  MeteorDamageTalent: iconMagnitude,
  MeteorHestiaTalent: iconHearthOfHestia,
  TransformCastDamageTalent: iconDominion,
  TransformLastStandRechargeTalent: iconContingency,
  TransformAttackSpeedTalent: iconSavagery,
  TransformSpecialTalent: iconSplendor,
  TransformPrimaryTalent: iconResonance,
  TransformSpecialCritTalent: iconHorror,
  TransformExCastTalent: iconSanctity,
  TransformDurationTalent: iconFocus,
  TransformDamageTalent: iconBloodthirst,
  TransformCooldownDodgeTalent: iconTension,
  TransformAphroditeTalent: iconAllureOfAphrodite,
  LeapLaunchAoETalent: iconDuality,
  LeapAoETalent: iconVicinity,
  LeapCritTalent: iconLethality,
  LeapSprintTalent: iconFrenzy,
  LeapShieldTalent: iconTenacity,
  LeapTwiceTalent: iconBrutality,
  LeapDamageTalent: iconInstinct,
  LeapArmorDamageTalent: iconHunger,
  LeapCooldownSpeedTalent: iconUrgency,
  LeapHephaestusTalent: iconHandOfHephaestus,
  LaserAoETalent: iconDispersion,
  LaserStartAoETalent: iconOverflow,
  LaserPenetrationTalent: iconExodus,
  LaserDurationTalent: iconObstinance,
  LaserFirstHitDamageTalent: iconContact,
  LaserTripleTalent: iconTrinity,
  LaserCrystalTalent: iconProminence,
  LaserDamageTalent: iconIntensity,
  LaserDefenseTalent: iconBearing,
  LaserApolloTalent: iconShineOfApollo,
  SummonSpeedTalent: iconRigor,
  SummonTeleportTalent: iconConfluence,
  SummonPermanenceTalent: iconServitude,
  SummonRetaliateTalent: iconRetaliation,
  SummonDamageSplitTalent: iconSelflessness,
  SummonExplodeTalent: iconEruption,
  SummonDamageTalent: iconDevotion,
  SummonHeraTalent: iconNurtureOfHera,
  TimeSlowDestroyProjectilesTalent: iconPurification,
  TimeSlowSpeedTalent: iconAlacrity,
  TimeSlowLastStandRechargeTalent: iconContingency,
  TimeSlowCumulativeBuffTalent: iconAccumulation,
  TimeSlowCritTalent: iconPrecision,
  TimeSlowFreezeTimeTalent: iconStillness,
  TimeSlowAmountTalent: iconPatience,
  CooldownDefenseTalent: iconSteadfastness,
  TimeSlowDemeterTalent: iconSquallOfDemeter,
  DamageBuffTalent: iconZeal,
  ShieldTalent: iconRadiance,
  RolloverUsesTalent: iconConservation,
  HealLastTalent: iconPanacea,
  ClearCastTalent: iconClarity,
  HealRetaliateTalent: iconTribulation,
  PotionExCastTalent: iconSaturation,
  PotionManaRestoreTalent: iconPurity,
  PotionUsesTalent: iconAbundance,
  HealAmountTalent: iconVigor,
  CurrencyUseTalent: iconFortune,
  PotionPoseidonTalent: iconPrideOfPoseidon,
  MoonBeamConsecutiveDamageTalent: iconFerocity,
  MoonBeamDefenseTalent: iconCalm,
  MoonBeamPrimaryTalent: iconAmbition,
  MoonBeamTargetTalent: iconPrism,
  MoonBeamExBeamBonusTalent: iconCascade,
  MoonBeamVulnerabilityTalent: iconOmen,
  MoonBeamDamageTalent: iconSting,
  MoonBeamCountTalent: iconBrilliance,
  MoonBeamAresTalent: iconLanceOfAres,
};
