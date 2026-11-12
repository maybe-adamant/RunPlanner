import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';
import { candidateBiome, candidateBiomeRooms } from '../candidates/evaluated-biome';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { ProjectEvaluationAssembly, RoomStopCoverage } from './evaluation-products';

/** One room as the evaluated biome holds it; undefined for a room it does not hold. */
export function authoredRoom(
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): CanonicalAuthoredRoom | undefined {
  const biome = candidateBiome(assembly.evaluation, occurrence.routeKey, occurrence.biomeKey);
  if (biome === undefined) return undefined;
  const key = semanticAddressKey(occurrence);
  return candidateBiomeRooms(biome).find((room) => semanticAddressKey(room.origin) === key);
}

/**
 * How far the walk went through a room's Timeline: every entry of a room it
 * walked through, none of a room its assessed history does not reach, and in
 * the room it stopped in, the entries before its stop. An entry at an `entry`
 * stop is blocking: the walk reached it and blocks on its own contact there.
 */
export interface RoomWalk {
  readonly entry: (entryIndex: number) => 'settled' | 'blocking' | 'unreached';
  /** The walk never entered the room's Timeline: its assessed history does not reach the room. */
  readonly unreached?: true;
  /** Where the walk stopped, in the room it stopped in. */
  readonly stop?: RoomStopCoverage;
  /** The index of the stop's entry in the room's Timeline entries. */
  readonly stopIndex?: number;
}

export function roomWalk(
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): RoomWalk {
  const all: RoomWalk = { entry: () => 'settled' };
  const biome = assembly.evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === occurrence.biomeKey,
  );
  if (biome === undefined || biome.coverage.kind !== 'prefix') return all;
  const key = semanticAddressKey(occurrence);
  if (
    'history' in biome &&
    !biome.history.rooms.some((room) => semanticAddressKey(room.origin) === key)
  )
    return { entry: () => 'unreached', unreached: true };
  const stop = biome.coverage.roomStop;
  if (stop === undefined || semanticAddressKey(stop.room) !== key) return all;
  const stopIndex = biome.roomStopEntryIndex;
  if (stopIndex === undefined) throw new Error(`${key} stopped with no resolved Timeline entry`);
  return {
    stop,
    stopIndex,
    entry: (entryIndex) =>
      entryIndex < stopIndex
        ? 'settled'
        : entryIndex === stopIndex && stop.at === 'entry'
          ? 'blocking'
          : 'unreached',
  };
}
