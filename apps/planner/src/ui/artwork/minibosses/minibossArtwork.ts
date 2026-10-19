import iconAssassin from './assets/Assassin.webp';
import iconBoar from './assets/Boar.webp';
import iconBrute from './assets/Brute.webp';
import iconCaptain from './assets/Captain.webp';
import iconCharybdis from './assets/Charybdis.webp';
import iconCrawler from './assets/Crawler.webp';
import iconDragon from './assets/Dragon.webp';
import iconFogEmitter from './assets/FogEmitter.webp';
import iconGoldElemental from './assets/GoldElemental.webp';
import iconJellyfish from './assets/Jellyfish.webp';
import iconRatCatcher from './assets/RatCatcher.webp';
import iconSatyrCrossbow from './assets/SatyrCrossbow.webp';
import iconStalker from './assets/Stalker.webp';
import iconTalos from './assets/Talos.webp';
import iconTreant from './assets/Treant.webp';
import iconVampire from './assets/Vampire.webp';
import iconWaterUnit from './assets/WaterUnit.webp';

/** Miniboss icons by catalog miniboss encounter key; `null` marks a key with no icon yet. */
export const minibossArtwork: Readonly<Record<string, string | null>> = {
  MiniBossTreant: iconTreant,
  MiniBossFogEmitter: iconFogEmitter,
  MiniBossAssassin: iconAssassin,
  MiniBossTreant_Shrine: iconTreant,
  MiniBossFogEmitter_Shrine: iconFogEmitter,
  MiniBossWaterUnit: iconWaterUnit,
  MiniBossCrawler: iconCrawler,
  MiniBossJellyfish: iconJellyfish,
  MiniBossVampire: iconVampire,
  MiniBossLamia: null,
  MiniBossRatCatcher: iconRatCatcher,
  MiniBossGoldElemental: iconGoldElemental,
  MiniBossSatyrCrossbow: iconSatyrCrossbow,
  MiniBossBoar: iconBoar,
  MiniBossCharybdis: iconCharybdis,
  MiniBossCaptain: iconCaptain,
  MiniBossTalos: iconTalos,
  MiniBossDragon: iconDragon,
  MiniBossBrute: iconBrute,
  MiniBossStalker: iconStalker,
  BossTyphonTail01: null,
  BossTyphonEye01: null,
};
