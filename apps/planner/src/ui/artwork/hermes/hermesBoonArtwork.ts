import iconHardTarget from './assets/HardTarget.webp';
import iconHastyRetreat from './assets/HastyRetreat.webp';
import iconMeanStreak from './assets/MeanStreak.webp';
import iconNimbleLimbs from './assets/NimbleLimbs.webp';
import iconNitroBoost from './assets/NitroBoost.webp';
import iconPaidDues from './assets/PaidDues.webp';
import iconQuickBuck from './assets/QuickBuck.webp';
import iconRacingThoughts from './assets/RacingThoughts.webp';
import iconStutterStep from './assets/StutterStep.webp';
import iconSuccessRate from './assets/SuccessRate.webp';
import iconTallOrder from './assets/TallOrder.webp';
import iconTravelDeal from './assets/TravelDeal.webp';
import iconWinnersCircle from './assets/WinnersCircle.webp';

/** Hermes boon icons by catalog trait key; `null` marks a key with no icon yet. */
export const hermesBoonArtwork: Readonly<Record<string, string | null>> = {
  HermesWeaponBoon: iconNimbleLimbs,
  HermesSpecialBoon: iconRacingThoughts,
  HermesCastDiscountBoon: iconWinnersCircle,
  SprintShieldBoon: iconNitroBoost,
  SorcerySpeedBoon: iconStutterStep,
  DodgeChanceBoon: iconHastyRetreat,
  SlowProjectileBoon: iconHardTarget,
  MoneyMultiplierBoon: iconQuickBuck,
  TimedKillBuffBoon: iconMeanStreak,
  RestockBoon: iconTravelDeal,
  LuckyBoon: iconSuccessRate,
  ElementalUnifiedBoon: iconTallOrder,
  TimeStopLastStandBoon: iconPaidDues,
};
