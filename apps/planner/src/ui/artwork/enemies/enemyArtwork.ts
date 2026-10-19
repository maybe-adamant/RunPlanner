import iconAnchor from './assets/Anchor.webp';
import iconAutoForcer from './assets/AutoForcer.webp';
import iconAutoSeeker from './assets/AutoSeeker.webp';
import iconAutoWatcher from './assets/AutoWatcher.webp';
import iconBawlder from './assets/Bawlder.webp';
import iconBlasket from './assets/Blasket.webp';
import iconBlightShade from './assets/BlightShade.webp';
import iconBloatShade from './assets/BloatShade.webp';
import iconBloodShade from './assets/BloodShade.webp';
import iconBloodless from './assets/Bloodless.webp';
import iconBoneRaker from './assets/BoneRaker.webp';
import iconBoozer from './assets/Boozer.webp';
import iconBronzebeak from './assets/Bronzebeak.webp';
import iconBurnFlinger from './assets/BurnFlinger.webp';
import iconCasket from './assets/Casket.webp';
import iconCutthroat from './assets/Cutthroat.webp';
import iconDroplet from './assets/Droplet.webp';
import iconEidolon from './assets/Eidolon.webp';
import iconEyesore from './assets/Eyesore.webp';
import iconGoldwraith from './assets/Goldwraith.webp';
import iconHarpyRaptor from './assets/HarpyRaptor.webp';
import iconHarpyTalon from './assets/HarpyTalon.webp';
import iconHippo from './assets/Hippo.webp';
import iconHoleheart from './assets/Holeheart.webp';
import iconHorror from './assets/Horror.webp';
import iconInfernoBomber from './assets/InfernoBomber.webp';
import iconLamia from './assets/Lamia.webp';
import iconLandDracon from './assets/LandDracon.webp';
import iconLubber from './assets/Lubber.webp';
import iconLurker from './assets/Lurker.webp';
import iconLycaon from './assets/Lycaon.webp';
import iconMourner from './assets/Mourner.webp';
import iconNumbskull from './assets/Numbskull.webp';
import iconPinhead from './assets/Pinhead.webp';
import iconPolyp from './assets/Polyp.webp';
import iconSandskull from './assets/Sandskull.webp';
import iconSatyrGoldpike from './assets/SatyrGoldpike.webp';
import iconSatyrHoplite from './assets/SatyrHoplite.webp';
import iconSatyrRaider from './assets/SatyrRaider.webp';
import iconSatyrSapper from './assets/SatyrSapper.webp';
import iconSatyrVierophant from './assets/SatyrVierophant.webp';
import iconSeaSerpent from './assets/SeaSerpent.webp';
import iconSeaShambler from './assets/SeaShambler.webp';
import iconSeesword from './assets/Seesword.webp';
import iconShambler from './assets/Shambler.webp';
import iconShellback from './assets/Shellback.webp';
import iconSkyDracon from './assets/SkyDracon.webp';
import iconSlamDancer from './assets/SlamDancer.webp';
import iconSmacker from './assets/Smacker.webp';
import iconSnowShambler from './assets/SnowShambler.webp';
import iconSopSpindle from './assets/SopSpindle.webp';
import iconSorrowSpiller from './assets/SorrowSpiller.webp';
import iconSpindle from './assets/Spindle.webp';
import iconStalker from './assets/Stalker.webp';
import iconStickler from './assets/Stickler.webp';
import iconTempus from './assets/Tempus.webp';
import iconThornWeeper from './assets/ThornWeeper.webp';
import iconWailer from './assets/Wailer.webp';
import iconWastrel from './assets/Wastrel.webp';
import iconWaveMaker from './assets/WaveMaker.webp';
import iconWetWhisper from './assets/WetWhisper.webp';
import iconWhisper from './assets/Whisper.webp';
import iconWretchedThug from './assets/WretchedThug.webp';
import iconWretchedWitch from './assets/WretchedWitch.webp';

/** Enemy icons by catalog enemy key; elites share their base art; `null` marks a key with no icon yet. */
export const enemyArtwork: Readonly<Record<string, string | null>> = {
  AutomatonBeamer: iconAutoWatcher,
  AutomatonBeamer_Elite: iconAutoWatcher,
  AutomatonEnforcer: iconAutoForcer,
  AutomatonEnforcer_Elite: iconAutoForcer,
  BloodlessBerserker: iconBoneRaker,
  BloodlessBerserker_Elite: iconBoneRaker,
  BloodlessGrenadier: iconInfernoBomber,
  BloodlessGrenadier_Elite: iconInfernoBomber,
  BloodlessNaked: iconBloodless,
  BloodlessNaked_Elite: iconBloodless,
  BloodlessPitcher: iconBurnFlinger,
  BloodlessPitcher_Elite: iconBurnFlinger,
  BloodlessSelfDestruct: iconSlamDancer,
  BloodlessSelfDestruct_Elite: iconSlamDancer,
  BloodlessWaveFist: iconWaveMaker,
  BloodlessWaveFist_Elite: iconWaveMaker,
  Brawler: iconWastrel,
  Brawler_Elite: iconWastrel,
  BrokenHearted: iconSmacker,
  BrokenHearted_Elite: iconSmacker,
  Brute: iconHorror,
  Brute_Elite: iconHorror,
  Carrion: iconBronzebeak,
  Carrion_Elite: iconBronzebeak,
  ClockworkHeavyMelee: iconWretchedThug,
  ClockworkHeavyMelee_Elite: iconWretchedThug,
  CorruptedShadeLarge: iconBloatShade,
  CorruptedShadeLarge_Elite: iconBloatShade,
  CorruptedShadeMedium: iconBloodShade,
  CorruptedShadeMedium_Elite: iconBloodShade,
  CorruptedShadeSmall: iconBlightShade,
  CorruptedShadeSmall_Elite: iconBlightShade,
  DespairElemental: iconBawlder,
  DespairElemental_Elite: iconBawlder,
  Dragon: iconSkyDracon,
  DragonBurrower: iconLandDracon,
  DragonBurrower_Elite: iconLandDracon,
  Dragon_Elite: iconSkyDracon,
  Drunk: iconBoozer,
  Drunk_Elite: iconBoozer,
  FishSwarmerSquad: iconPinhead,
  FishSwarmerSquad_Elite: iconPinhead,
  FishmanMelee: iconLurker,
  FishmanMelee_Elite: iconLurker,
  FishmanRanged: iconHippo,
  FishmanRanged_Elite: iconHippo,
  FogEmitter2: iconSorrowSpiller,
  GoldElemental: iconGoldwraith,
  GoldElemental_Elite: iconGoldwraith,
  Guard: iconWhisper,
  Guard2: iconWetWhisper,
  Guard2_Elite: iconWetWhisper,
  Guard_Elite: iconWhisper,
  HarpyCutter: iconHarpyTalon,
  HarpyCutter_Elite: iconHarpyTalon,
  HarpyDropper: iconHarpyRaptor,
  HarpyDropper_Elite: iconHarpyRaptor,
  Lamia: iconLamia,
  Lamia_Elite: iconLamia,
  Lovesick: iconHoleheart,
  Lovesick_Elite: iconHoleheart,
  LycanSwarmer: null,
  LycanSwarmer_Elite: null,
  Lycanthrope: iconLycaon,
  Lycanthrope_Elite: iconLycaon,
  Mage: iconCasket,
  Mage2: iconBlasket,
  Mage2_Elite: iconBlasket,
  Mage_Elite: iconCasket,
  Mati: iconEyesore,
  Mati_Elite: iconEyesore,
  Mourner: iconMourner,
  Mourner_Elite: iconMourner,
  Mudman: iconEidolon,
  Mudman_Elite: iconEidolon,
  Radiator: iconSpindle,
  Radiator2: iconSopSpindle,
  Radiator2_Elite: iconSopSpindle,
  Radiator_Elite: iconSpindle,
  SatyrCrossbow2: iconSatyrRaider,
  SatyrCrossbow2_Elite: iconSatyrRaider,
  SatyrLancer: iconSatyrHoplite,
  SatyrLancer2: iconSatyrGoldpike,
  SatyrLancer2_Elite: iconSatyrGoldpike,
  SatyrLancer_Elite: iconSatyrHoplite,
  SatyrRatCatcher: iconSatyrVierophant,
  SatyrRatCatcher_Elite: iconSatyrVierophant,
  SatyrSapper: iconSatyrSapper,
  SatyrSapper_Elite: iconSatyrSapper,
  Scimiterror: iconSeesword,
  Scimiterror_Elite: iconSeesword,
  Screamer: iconWailer,
  Screamer2: null,
  Screamer_Elite: iconWailer,
  SentryBot: iconAutoSeeker,
  SentryBot_Elite: iconAutoSeeker,
  SiegeVine: iconThornWeeper,
  SiegeVine_Elite: iconThornWeeper,
  Simple: iconPolyp,
  SimpleSquad: iconPolyp,
  SimpleSquad_Elite: iconPolyp,
  Simple_Elite: iconPolyp,
  SpreadShotUnit: iconWretchedWitch,
  SpreadShotUnit_Elite: iconWretchedWitch,
  Stalker: iconStalker,
  Stalker_Elite: iconStalker,
  Stickler: iconStickler,
  Stickler_Elite: iconStickler,
  Swab: iconAnchor,
  Swab_Elite: iconAnchor,
  SwarmerClockwork: iconSandskull,
  SwarmerClockwork_Elite: iconSandskull,
  Swarmer_Elite: iconNumbskull,
  TimeElemental: iconTempus,
  TimeElemental_Elite: iconTempus,
  Treant2: null,
  Turtle: iconShellback,
  Turtle_Elite: iconShellback,
  WaterElemental: iconDroplet,
  WaterElemental_Elite: iconDroplet,
  WaterUnit: iconSeaSerpent,
  WaterUnit_Elite: iconSeaSerpent,
  Zombie: iconShambler,
  ZombieAssassin: iconCutthroat,
  ZombieAssassin_Elite: iconCutthroat,
  ZombieCrewman: iconSeaShambler,
  ZombieCrewman_Elite: iconSeaShambler,
  ZombieHeavyRanged: iconLubber,
  ZombieHeavyRanged_Elite: iconLubber,
  ZombieOlympus: iconSnowShambler,
  ZombieOlympus_Elite: iconSnowShambler,
  ZombieSpawner: null,
  ZombieSpawner_Elite: null,
  Zombie_Elite: iconShambler,
};
