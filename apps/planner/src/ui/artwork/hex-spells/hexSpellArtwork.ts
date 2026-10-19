import iconDarkSide from './assets/DarkSide.webp';
import iconLunarRay from './assets/LunarRay.webp';
import iconMoonWater from './assets/MoonWater.webp';
import iconNightBloom from './assets/NightBloom.webp';
import iconPhaseShift from './assets/PhaseShift.webp';
import iconSkyFall from './assets/SkyFall.webp';
import iconTotalEclipse from './assets/TotalEclipse.webp';
import iconTwilightCurse from './assets/TwilightCurse.webp';
import iconWolfHowl from './assets/WolfHowl.webp';

/** Selene's Hex icons by catalog spell trait key; `null` marks a key with no icon yet. */
export const hexSpellArtwork: Readonly<Record<string, string | null>> = {
  SpellPolymorphTrait: iconTwilightCurse,
  SpellMeteorTrait: iconTotalEclipse,
  SpellTransformTrait: iconDarkSide,
  SpellLeapTrait: iconWolfHowl,
  SpellLaserTrait: iconLunarRay,
  SpellSummonTrait: iconNightBloom,
  SpellTimeSlowTrait: iconPhaseShift,
  SpellPotionTrait: iconMoonWater,
  SpellMoonBeamTrait: iconSkyFall,
};
