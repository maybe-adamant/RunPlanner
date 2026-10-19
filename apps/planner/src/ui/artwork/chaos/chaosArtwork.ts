import iconAddled from './assets/Addled.webp';
import iconAffluence from './assets/Affluence.webp';
import iconAtrophic from './assets/Atrophic.webp';
import iconBarren from './assets/Barren.webp';
import iconCaustic from './assets/Caustic.webp';
import iconCelerity from './assets/Celerity.webp';
import iconChant from './assets/Chant.webp';
import iconChasm from './assets/Chasm.webp';
import iconCreation from './assets/Creation.webp';
import iconDefiance from './assets/Defiance.webp';
import iconDiscovery from './assets/Discovery.webp';
import iconEnshrouded from './assets/Enshrouded.webp';
import iconExcruciating from './assets/Excruciating.webp';
import iconExpiring from './assets/Expiring.webp';
import iconFavor from './assets/Favor.webp';
import iconFixated from './assets/Fixated.webp';
import iconFlayed from './assets/Flayed.webp';
import iconFlourish from './assets/Flourish.webp';
import iconGagged from './assets/Gagged.webp';
import iconMaimed from './assets/Maimed.webp';
import iconMind from './assets/Mind.webp';
import iconNeurotic from './assets/Neurotic.webp';
import iconOrdinary from './assets/Ordinary.webp';
import iconParalyzing from './assets/Paralyzing.webp';
import iconPaupers from './assets/Paupers.webp';
import iconRejected from './assets/Rejected.webp';
import iconRevelation from './assets/Revelation.webp';
import iconRevival from './assets/Revival.webp';
import iconSlothful from './assets/Slothful.webp';
import iconSoul from './assets/Soul.webp';
import iconStrike from './assets/Strike.webp';
import iconTalent from './assets/Talent.webp';
import iconWill from './assets/Will.webp';

/** Chaos blessing and curse icons by catalog key; `null` marks a key with no icon yet. */
export const chaosArtwork: Readonly<Record<string, string | null>> = {
  ChaosWeaponBlessing: iconStrike,
  ChaosSpecialBlessing: iconFlourish,
  ChaosCastBlessing: iconChasm,
  ChaosHealthBlessing: iconSoul,
  ChaosManaBlessing: iconMind,
  ChaosManaOverTimeBlessing: iconWill,
  ChaosExSpeedBlessing: iconRevelation,
  ChaosRarityBlessing: iconFavor,
  ChaosMoneyBlessing: iconAffluence,
  ChaosElementalBlessing: iconCreation,
  ChaosManaCostBlessing: iconTalent,
  ChaosSpeedBlessing: iconCelerity,
  ChaosDoorHealBlessing: iconRevival,
  ChaosHarvestBlessing: iconDiscovery,
  ChaosOmegaDamageBlessing: iconChant,
  ChaosLastStandBlessing: iconDefiance,
  ChaosNoMoneyCurse: iconPaupers,
  ChaosHealthCurse: iconAtrophic,
  ChaosDamageCurse: iconExcruciating,
  ChaosPrimaryAttackCurse: iconMaimed,
  ChaosSecondaryAttackCurse: iconFlayed,
  ChaosDeathWeaponCurse: iconCaustic,
  ChaosSpeedCurse: iconSlothful,
  ChaosExAttackCurse: iconGagged,
  ChaosCastCurse: iconAddled,
  ChaosDashCurse: iconNeurotic,
  ChaosManaFocusCurse: iconFixated,
  ChaosStunCurse: iconParalyzing,
  ChaosTimeCurse: iconExpiring,
  ChaosMetaUpgradeCurse: iconBarren,
  ChaosHiddenRoomRewardCurse: iconEnshrouded,
  ChaosCommonCurse: iconOrdinary,
  ChaosRestrictBoonCurse: iconRejected,
};
