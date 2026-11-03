import { catalog } from '@run-planner/hades2-catalog';
import { traitMaxHealthRollWidth } from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  compareEntrySaves,
  compareImportToRecord,
  recordedEntryStates,
} from '../../src/conformance';
import { projectFromRunRecord, type RunImport } from '../../src/import';
import { RecordOccurrences } from '../../src/occurrences';
import type { RunImportReportEntry } from '../../src/report';
import type { RunRecord } from '../../src/run-record';
import { timedCalls } from './authoring-timing';
import { describeEntry, occurrenceOf } from './run-import';

/**
 * Where a record room stands after the import, judged at its next entry save:
 * `exact` no entry touched it, `solved` an importer solver settled it,
 * `guessed` an assumption or guess touched it, `mismatch` the room introduced
 * or changed a difference, `carried` only an earlier difference persists,
 * `unchecked` no next entry save compares it.
 */
export type RoomBucket = 'exact' | 'solved' | 'guessed' | 'mismatch' | 'carried' | 'unchecked';

export const ROOM_BUCKETS: readonly RoomBucket[] = [
  'exact',
  'solved',
  'guessed',
  'mismatch',
  'carried',
  'unchecked',
];

export type UncheckedReason = 'noEntrySaves' | 'lastRoom' | 'stopped' | 'revisited' | 'unreached';

export interface RoomRow {
  readonly roomIndex: number;
  readonly name: string;
  readonly bucket: RoomBucket;
  readonly unchecked?: UncheckedReason;
  /** The record-supported solvers that apply to the room. */
  readonly solvers: readonly string[];
  /**
   * `family:field` of each difference the room introduced or changed, solver
   * mismatches included; a trait's family names how it differs.
   */
  readonly introduced: readonly string[];
  /** `family:field` of each earlier difference that persists through the room. */
  readonly carried: readonly string[];
  /** Report entries that concern the room, other than the comparison's own. */
  readonly entries: readonly string[];
  /** The room is guessed only by its native action order. */
  readonly orderOnly: boolean;
}

export interface RunTiming {
  readonly importMs: number;
  /** One cold evaluation of the imported plan. */
  readonly evaluateMs: number;
  readonly applies: number;
  readonly applyMedianMs: number;
  readonly applyP95Ms: number;
  readonly applyTotalMs: number;
  /** Authoring time per record room: every apply whose command names the room. */
  readonly roomMedianMs: number;
  readonly roomP95Ms: number;
  readonly probes: number;
  readonly candidatesMs: number;
}

export interface RunMeasurement {
  readonly name: string;
  readonly kind: RunImport['kind'];
  readonly rows: readonly RoomRow[];
  readonly timing: RunTiming;
}

/** A difference's family: its area, and for a trait whether it is missing, extra, or graded otherwise. */
function family(area: string, expected: string, actual: string): string {
  if (area !== 'traits') return area;
  if (expected === 'absent') return 'traits.extra';
  if (actual === 'absent') return 'traits.missing';
  const rarity = (grade: string) => (grade.startsWith('level') ? '' : grade.split(' ')[0]);
  return rarity(expected) === rarity(actual) ? 'traits.level' : 'traits.rarity';
}

const quantile = (values: readonly number[], q: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
};

/** The record room each topology occurrence descends from, for occurrences the record never names. */
function parentRooms(imported: RunImport, occurrences: RecordOccurrences) {
  const parent = new Map<string, string>();
  for (const biome of imported.project.route.biomes) {
    const topology = biome.topology;
    if (topology === undefined || topology === null) continue;
    for (const decision of topology.decisions)
      if (decision.kind === 'exit' && decision.source.kind === 'occurrence')
        for (const target of decision.normal.targets)
          parent.set(target.occurrenceId, decision.source.occurrenceId);
    for (const link of topology.fixedRoomLinks)
      parent.set(link.targetOccurrenceId, link.sourceOccurrenceId);
    for (const occurrence of topology.occurrences)
      for (const exit of occurrence.additionalExits)
        parent.set(exit.occurrenceId, occurrence.occurrenceId);
  }
  return (occurrenceId: string): number | undefined => {
    for (
      let id: string | undefined = occurrenceId, steps = 0;
      id !== undefined && steps < 50;
      steps += 1
    ) {
      const room = occurrences.roomIndexOfOccurrence(id);
      if (room !== undefined) return room;
      id = parent.get(id);
    }
    return undefined;
  };
}

const CHECK_REASONS = new Set(['mismatch', 'stopped']);

/** Imports `record` and buckets each of its rooms at its next entry save. */
export function measureRun(name: string, record: RunRecord): RunMeasurement {
  const began = performance.now();
  const { result: imported, samples: taken } = timedCalls(() =>
    projectFromRunRecord(catalog, record),
  );
  const importMs = performance.now() - began;

  const occurrences = new RecordOccurrences(catalog, record);
  occurrences.bindEngineOccurrences(imported.project);
  const assembly = simulateProjectAssembly(catalog, imported.project);
  // A copy shares no object with the walk's evaluations, so nothing is reused.
  const copy = structuredClone(imported.project);
  const evaluateBegan = performance.now();
  simulateProjectAssembly(catalog, copy);
  const evaluateMs = performance.now() - evaluateBegan;
  const throughRoom =
    imported.kind === 'stopped' ? (imported.stop.record?.roomIndex ?? 0) : record.rooms.length;
  const comparisons = compareEntrySaves(catalog, record, occurrences, assembly, throughRoom);

  // The comparison's own entries are the report's trailing mismatches; the rest are the walk's.
  const compared = compareImportToRecord(catalog, record, occurrences, assembly, throughRoom).map(
    (entry) => JSON.stringify(entry),
  );
  const walkEntries: RunImportReportEntry[] = [];
  for (const entry of imported.report.entries) {
    const at = compared.indexOf(JSON.stringify(entry));
    if (entry.reason === 'mismatch' && entry.address === undefined && at >= 0)
      compared.splice(at, 1);
    else walkEntries.push(entry);
  }

  const roomOf = parentRooms(imported, occurrences);
  const byRoom = new Map<number, RunImportReportEntry[]>();
  for (const entry of walkEntries) {
    const occurrenceId = entry.address === undefined ? undefined : occurrenceOf(entry.address);
    const roomIndex =
      entry.record?.roomIndex ?? (occurrenceId === undefined ? undefined : roomOf(occurrenceId));
    if (roomIndex === undefined) continue;
    byRoom.set(roomIndex, [...(byRoom.get(roomIndex) ?? []), entry]);
  }

  const states = recordedEntryStates(record);
  const comparisonAt = new Map(comparisons.map((comparison) => [comparison.roomIndex, comparison]));
  const rows: RoomRow[] = record.rooms.map((room, roomIndex) => {
    const entries = byRoom.get(roomIndex) ?? [];
    const guesses = entries.filter((entry) => !CHECK_REASONS.has(entry.reason));
    const solverMismatches = entries
      .filter((entry) => entry.reason === 'mismatch')
      .map((entry) => `${entry.area}.solver:${entry.mismatch?.field ?? '-'}`);
    const solvers = [
      ...(room.wheels === undefined ? [] : ['wheels']),
      ...((room.rerolls ?? 0) > 0 ? ['rerolls'] : []),
      ...(room.traits.acquired.some(
        (trait) => traitMaxHealthRollWidth(catalog, trait.name) !== undefined,
      )
        ? ['maxHealth']
        : []),
    ];
    const base = {
      roomIndex,
      name: room.name,
      solvers,
      entries: entries.map(describeEntry),
      orderOnly: guesses.length > 0 && guesses.every((entry) => entry.area === 'roomActionOrder'),
    };
    const unchecked = (reason: UncheckedReason): RoomRow => ({
      ...base,
      bucket: 'unchecked',
      unchecked: reason,
      introduced: solverMismatches,
      carried: [],
    });
    if (states.length === 0) return unchecked('noEntrySaves');
    if (roomIndex >= throughRoom) return unchecked('stopped');
    if (occurrences.visitsOf(occurrences.occurrenceOf(roomIndex)).length > 1)
      return unchecked('revisited');
    if (roomIndex === record.rooms.length - 1) return unchecked('lastRoom');
    const next = comparisonAt.get(roomIndex + 1);
    if (next === undefined) return unchecked('unreached');
    // A difference is the room's own unless the comparison before it held it unchanged.
    const before = comparisons.filter((comparison) => comparison.roomIndex <= roomIndex).at(-1);
    const held = new Map(
      (before?.differences ?? []).map((difference) => [
        `${difference.area}:${difference.field}`,
        difference.persists,
      ]),
    );
    const introduced = [...solverMismatches];
    const carried: string[] = [];
    for (const { area, field, expected, actual, persists } of next.differences)
      (held.get(`${area}:${field}`) === persists ? carried : introduced).push(
        `${family(area, expected, actual)}:${field}`,
      );
    const bucket: RoomBucket =
      introduced.length > 0
        ? 'mismatch'
        : carried.length > 0
          ? 'carried'
          : guesses.length > 0
            ? 'guessed'
            : solvers.length > 0
              ? 'solved'
              : 'exact';
    return { ...base, bucket, introduced, carried };
  });

  const applies = taken.filter((sample) => sample.call === 'apply');
  const roomMs = new Map<number, number>();
  for (const sample of applies) {
    const occurrenceId = occurrenceOf(sample.command);
    const roomIndex = occurrenceId === undefined ? undefined : roomOf(occurrenceId);
    if (roomIndex !== undefined) roomMs.set(roomIndex, (roomMs.get(roomIndex) ?? 0) + sample.ms);
  }
  const applyMs = applies.map((sample) => sample.ms);
  return {
    name,
    kind: imported.kind,
    rows,
    timing: {
      importMs,
      evaluateMs,
      applies: applies.length,
      applyMedianMs: quantile(applyMs, 0.5),
      applyP95Ms: quantile(applyMs, 0.95),
      applyTotalMs: applyMs.reduce((total, ms) => total + ms, 0),
      roomMedianMs: quantile([...roomMs.values()], 0.5),
      roomP95Ms: quantile([...roomMs.values()], 0.95),
      probes: taken.filter((sample) => sample.call === 'probe').length,
      candidatesMs: taken
        .filter((sample) => sample.call === 'candidates')
        .reduce((total, sample) => total + sample.ms, 0),
    },
  };
}

/** Rooms per bucket. */
export function bucketCounts(rows: readonly RoomRow[]): Readonly<Record<RoomBucket, number>> {
  const counts = Object.fromEntries(ROOM_BUCKETS.map((bucket) => [bucket, 0])) as Record<
    RoomBucket,
    number
  >;
  for (const row of rows) counts[row.bucket] += 1;
  return counts;
}

const ms = (value: number) => value.toFixed(value < 10 ? 1 : 0);

/** One table line per run: bucket counts, unchecked reasons and timing. */
export function summaryLines(measurements: readonly RunMeasurement[]): readonly string[] {
  const lines = [
    `run | kind | rooms | ${ROOM_BUCKETS.join(' | ')} | orderOnly | first mismatch | solver rooms | unchecked by reason | import s | cold eval ms | applies | apply p50/p95 ms | apply total s | room p50/p95 ms | probes | candidates ms`,
  ];
  const tally = (values: readonly string[]) => {
    const counts: Record<string, number> = {};
    for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
    return (
      Object.entries(counts)
        .map(([value, count]) => `${value} ${count}`)
        .join(', ') || '-'
    );
  };
  for (const { name, kind, rows, timing } of measurements) {
    const counts = bucketCounts(rows);
    const first = rows.find((row) => row.bucket === 'mismatch');
    lines.push(
      [
        name,
        kind,
        rows.length,
        ...ROOM_BUCKETS.map((bucket) => counts[bucket]),
        rows.filter((row) => row.bucket === 'guessed' && row.orderOnly).length,
        first === undefined ? '-' : `r${first.roomIndex}`,
        tally(rows.filter((row) => row.solvers.length > 0).map((row) => row.bucket)),
        tally(rows.flatMap((row) => (row.unchecked === undefined ? [] : [row.unchecked]))),
        (timing.importMs / 1000).toFixed(1),
        ms(timing.evaluateMs),
        timing.applies,
        `${ms(timing.applyMedianMs)}/${ms(timing.applyP95Ms)}`,
        (timing.applyTotalMs / 1000).toFixed(1),
        `${ms(timing.roomMedianMs)}/${ms(timing.roomP95Ms)}`,
        timing.probes,
        ms(timing.candidatesMs),
      ].join(' | '),
    );
  }
  return lines;
}

/** Each room's bucket, families and the report entries that concern it. */
export function roomLines(measurement: RunMeasurement): readonly string[] {
  return measurement.rows.flatMap((row) => [
    `r${row.roomIndex} ${row.name} ${row.bucket}${row.unchecked === undefined ? '' : `(${row.unchecked})`}${
      row.solvers.length === 0 ? '' : ` solvers=${row.solvers.join(',')}`
    }${row.introduced.length === 0 ? '' : ` introduced=${row.introduced.join(',')}`}${
      row.carried.length === 0 ? '' : ` carried=${row.carried.join(',')}`
    }`,
    ...row.entries.map((entry) => `    ${entry}`),
  ]);
}

/** Introduced difference families over the measured rooms, most frequent first. */
export function introducedFamilies(
  measurements: readonly RunMeasurement[],
): readonly (readonly [string, number])[] {
  const counts = new Map<string, number>();
  for (const { rows } of measurements)
    for (const row of rows)
      for (const family of new Set(row.introduced.map((key) => key.split(':')[0]!)))
        counts.set(family, (counts.get(family) ?? 0) + 1);
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}
