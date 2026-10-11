/**
 * Native CurrentRun.BiomeEncounterDepth. It is unset from StartNewRun until the
 * first counting StartEncounter; EndBiomeRecords sets 1 on every later biome
 * entry (RunLogic.lua:1927). Each native reader defaults an unset value itself.
 */
export const BIOME_ENTRY_ENCOUNTER_DEPTH = 1;

/**
 * `difficulty`: GenerateEncounter and CalculateActiveEnemyCap `or 0`
 * (RunLogic.lua:1201, EncounterLogic.lua:1329); `typeCount`: FillEnemyTypes
 * `or 1` (RunLogic.lua:1323); `requirement`: GameStateRequirements compare nil
 * as 0 (RequirementsLogic.lua:633).
 */
export type BiomeEncounterDepthReader = 'difficulty' | 'typeCount' | 'requirement';

export function readBiomeEncounterDepth(
  depth: number | undefined,
  reader: BiomeEncounterDepthReader,
): number {
  if (depth !== undefined) return depth;
  return reader === 'typeCount' ? 1 : 0;
}

/** StartEncounter's `(BiomeEncounterDepth or 1) + 1` (RoomLogic.lua:1902). */
export function biomeEncounterDepthAfterStart(depth: number | undefined): number {
  return (depth ?? 1) + 1;
}

/** A `BiomeEncounterDepth == 1` gate (EncounterData_Generated.lua:504); unset reads 0. */
export function atBiomeEntryEncounterDepth(depth: number | undefined): boolean {
  return readBiomeEncounterDepth(depth, 'requirement') === BIOME_ENTRY_ENCOUNTER_DEPTH;
}
