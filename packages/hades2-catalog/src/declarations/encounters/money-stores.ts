import type { EncounterMoneyStore } from '@run-planner/engine/catalog-schema';

// Native MoneyDropCapMin / MoneyDropCapMax / MoneyDropCapDepthRamp, resolved through
// InheritFrom (RunData.lua:1363-1403). RunLogic.lua:1186-1190 draws the store only for a
// `Generated` encounter; every other encounter pays its kill drops uncapped.

const store = (capMin: number, capMax: number, runDepthRamp = 0): EncounterMoneyStore =>
  Object.freeze({ capMin, capMax, runDepthRamp });

/** EncounterData.lua:145-147 `Generated`: GeneratedF, its intros and the Anomaly. */
export const generatedMoneyStore = store(10, 15, 0.5);
/** EncounterData_Generated.lua:26-28 `GeneratedG`. */
export const oceanusMoneyStore = store(15, 25);
/** EncounterData_Generated.lua:165-167 `GeneratedH_Passive`. */
export const fieldsPassiveMoneyStore = store(10, 30);
/**
 * EncounterData_Story.lua:1915-1924 `NemesisRandomEvent`: `MoneyDropStore = 25`
 * set in data "for Fields where this is the room's encounter", never drawn.
 */
export const nemesisEventMoneyStore: EncounterMoneyStore = Object.freeze({
  capMin: 25,
  capMax: 25,
  runDepthRamp: 0,
  undrawn: true,
});
/** EncounterData_Generated.lua:247-249 `GeneratedH`. */
export const fieldsMoneyStore = store(30, 45);
/** EncounterData_Generated.lua:443-445 `GeneratedI`. */
export const tartarusMoneyStore = store(35, 45);
/** EncounterData_Generated.lua:701-703 `GeneratedN`. */
export const ephyraMoneyStore = store(15, 25);
/** EncounterData_Generated.lua:852-854 `GeneratedO`. */
export const thessalyMoneyStore = store(20, 30);
/** EncounterData_Generated.lua:1026-1028 `GeneratedP`. */
export const olympusMoneyStore = store(25, 35);
/** EncounterData_Generated.lua:1318-1320 `GeneratedQ`. */
export const summitMoneyStore = store(60, 85);
/** EncounterData_Devotion.lua:25-27 `BaseDevotion`. */
export const devotionMoneyStore = store(20, 30);
/**
 * A fixed store of 30: `BaseArtemisCombat` (EncounterData_Artemis.lua:64-66),
 * `BaseAthenaCombat` (EncounterData_Athena.lua:57-59), `BaseIcarusCombat`
 * (EncounterData_Icarus.lua:54-56) and `BaseNemesisCombat` (EncounterData_Nemesis.lua:66-68).
 */
export const godCombatMoneyStore = store(30, 30);
/** EncounterData_Heracles.lua:176-177 `HeraclesCombatP`. */
export const heraclesOlympusMoneyStore = store(100, 145);
/**
 * A fixed miniboss store of 15: Treant and FogEmitter (EncounterData.lua:726-728,
 * 818-820), Assassin, Vampire, Lamia, SatyrCrossbow, Boar, RatCatcher and
 * GoldElemental (EncounterData_MiniBoss.lua:30, 283, 354, 426, 498, 692, 750).
 */
export const minibossMoneyStore = store(15, 15);
/** EncounterData_MiniBoss.lua:101, 180: WaterUnit and Jellyfish. */
export const oceanusMinibossMoneyStore = store(25, 25);
/** EncounterData_MiniBoss.lua:835: Dragon. */
export const dragonMinibossMoneyStore = store(15, 25);
