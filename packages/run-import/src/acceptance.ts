import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import type { RunRecord } from './run-record/model';
import type { RecordOccurrences } from './occurrences';
import {
  compareEntrySave,
  type EntryComparison,
  type EntrySaves,
  type EntryUnchecked,
} from './conformance';
import type { RunImportRoomAcceptance, RunImportRoomDifference } from './report';

/** A difference's family: its area, and for a trait whether it is missing, extra, or graded otherwise. */
function family(area: string, expected: string, actual: string): string {
  if (area !== 'traits') return area;
  if (expected === 'absent') return 'traits.extra';
  if (actual === 'absent') return 'traits.missing';
  const rarity = (grade: string) => (grade.startsWith('level') ? '' : grade.split(' ')[0]);
  return rarity(expected) === rarity(actual) ? 'traits.level' : 'traits.rarity';
}

type Comparison = EntryComparison | EntryUnchecked;

/**
 * Judges a record room at its next entry save, `comparisonAt` giving each
 * room's entry comparison. A difference is the room's own unless the latest
 * compared save at or before the room held it unchanged.
 */
function judge(
  record: RunRecord,
  saves: EntrySaves,
  roomIndex: number,
  comparisonAt: (roomIndex: number) => Comparison,
): RunImportRoomAcceptance {
  if (saves.states.length === 0) return { roomIndex, verdict: 'unchecked', reason: 'noEntrySaves' };
  if (roomIndex >= record.rooms.length - 1)
    return { roomIndex, verdict: 'unchecked', reason: 'lastRoom' };
  const next = comparisonAt(roomIndex + 1);
  if (next.kind === 'unchecked')
    return {
      roomIndex,
      verdict: 'unchecked',
      reason: next.reason === 'noEntrySaves' ? 'unreached' : next.reason,
    };
  let before: EntryComparison | undefined;
  for (let index = roomIndex; index >= 0 && before === undefined; index -= 1) {
    const comparison = comparisonAt(index);
    if (comparison.kind === 'compared') before = comparison;
  }
  const held = new Map(
    (before?.differences ?? []).map((difference) => [
      `${difference.area}:${difference.field}`,
      difference.persists,
    ]),
  );
  const introduced: RunImportRoomDifference[] = [];
  const carried: RunImportRoomDifference[] = [];
  for (const { area, field, expected, actual, persists } of next.differences)
    (held.get(`${area}:${field}`) === persists ? carried : introduced).push({
      area,
      family: family(area, expected, actual),
      field,
      expected,
      actual,
    });
  return {
    roomIndex,
    verdict: next.differences.length === 0 ? 'accepted' : 'mismatch',
    introduced,
    carried,
    unchecked: next.unchecked,
  };
}

/** Judges one record room against the plan as it stands. */
export function judgeRoom(
  catalog: Catalog,
  record: RunRecord,
  saves: EntrySaves,
  occurrences: RecordOccurrences,
  assembly: ProjectEvaluationAssembly,
  roomIndex: number,
): RunImportRoomAcceptance {
  const comparisons = new Map<number, Comparison>();
  return judge(record, saves, roomIndex, (index) => {
    let comparison = comparisons.get(index);
    if (comparison === undefined) {
      comparison = compareEntrySave(catalog, record, saves, occurrences, assembly, index);
      comparisons.set(index, comparison);
    }
    return comparison;
  });
}

/** Judges every record room against the plan; rooms from `throughRoom` on are past its end. */
export function judgeRooms(
  catalog: Catalog,
  record: RunRecord,
  saves: EntrySaves,
  occurrences: RecordOccurrences,
  assembly: ProjectEvaluationAssembly,
  throughRoom: number,
): readonly RunImportRoomAcceptance[] {
  const comparisons = record.rooms.map((_, index) =>
    compareEntrySave(catalog, record, saves, occurrences, assembly, index),
  );
  return record.rooms.map((_, roomIndex) =>
    roomIndex >= throughRoom && saves.states.length > 0
      ? { roomIndex, verdict: 'unchecked', reason: 'stopped' }
      : judge(record, saves, roomIndex, (index) => comparisons[index]!),
  );
}

/** Whether a room began or changed no difference at its next entry save. */
export const introducesNothing = (acceptance: RunImportRoomAcceptance): boolean =>
  acceptance.verdict !== 'unchecked' && acceptance.introduced.length === 0;
