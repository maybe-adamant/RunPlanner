import { catalog } from '@run-planner/hades2-catalog';
import { traitMaxHealthRollWidth } from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { compareImportToRecord } from '../../src/conformance';
import { projectFromRunRecord, type RunImport } from '../../src/import';
import { RecordOccurrences } from '../../src/occurrences';
import type { RunImportReportEntry, RunImportRoomUncheckedReason } from '../../src/report';
import type { RunRecord } from '../../src/run-record';
import { timedCalls } from './authoring-timing';
import { describeEntry, occurrenceOf } from './run-import';

/**
 * Where a record room stands after the import, judged at its next entry save:
 * `exact` no entry touched it, `solved` an importer solver settled it,
 * `guessed` an assumption or guess touched it, `mismatch` the save differs (the
 * plan stops there), `unchecked` no next entry save compares it.
 */
export type RoomBucket = 'exact' | 'solved' | 'guessed' | 'mismatch' | 'unchecked';

export const ROOM_BUCKETS: readonly RoomBucket[] = [
  'exact',
  'solved',
  'guessed',
  'mismatch',
  'unchecked',
];

export interface RoomRow {
  readonly roomIndex: number;
  readonly name: string;
  readonly bucket: RoomBucket;
  readonly unchecked?: RunImportRoomUncheckedReason;
  /** `family:reason` of each fact family the next entry save holds that nothing compares. */
  readonly uncheckedFamilies: readonly string[];
  /** The verdict when the walk first reached the next save, where later authoring changed it. */
  readonly whenReached?: 'accepted' | 'mismatch';
  /** The record-supported solvers that apply to the room. */
  readonly solvers: readonly string[];
  /**
   * `family:field` of each difference at the room's next entry save, solver
   * mismatches included; a trait's family names how it differs.
   */
  readonly differences: readonly string[];
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
    const acceptance = imported.report.rooms![roomIndex]!;
    if (acceptance.verdict === 'unchecked')
      return {
        ...base,
        bucket: 'unchecked',
        unchecked: acceptance.reason,
        uncheckedFamilies: [],
        differences: solverMismatches,
      };
    const key = ({ family, field }: { family: string; field: string }) => `${family}:${field}`;
    const differences = [
      ...solverMismatches,
      ...[...acceptance.introduced, ...acceptance.carried].map(key),
    ];
    const bucket: RoomBucket =
      differences.length > 0
        ? 'mismatch'
        : guesses.length > 0
          ? 'guessed'
          : solvers.length > 0
            ? 'solved'
            : 'exact';
    return {
      ...base,
      bucket,
      differences,
      uncheckedFamilies: acceptance.unchecked.map(({ family, reason }) => `${family}:${reason}`),
      ...(acceptance.whenReached === undefined ? {} : { whenReached: acceptance.whenReached }),
    };
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
    `run | kind | rooms | ${ROOM_BUCKETS.join(' | ')} | orderOnly | first mismatch | solver rooms | unchecked by reason | revised after reach | import s | cold eval ms | applies | apply p50/p95 ms | apply total s | room p50/p95 ms | probes | candidates ms`,
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
        tally(
          rows.flatMap((row) => (row.whenReached === undefined ? [] : [`from ${row.whenReached}`])),
        ),
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
    }${row.differences.length === 0 ? '' : ` differences=${row.differences.join(',')}`}${row.uncheckedFamilies.length === 0 ? '' : ` uncheckedFamilies=${row.uncheckedFamilies.join(',')}`}${
      row.whenReached === undefined ? '' : ` whenReached=${row.whenReached}`
    }`,
    ...row.entries.map((entry) => `    ${entry}`),
  ]);
}

/** Difference families over the measured rooms, most frequent first. */
export function differenceFamilies(
  measurements: readonly RunMeasurement[],
): readonly (readonly [string, number])[] {
  const counts = new Map<string, number>();
  for (const { rows } of measurements)
    for (const row of rows)
      for (const family of new Set(row.differences.map((key) => key.split(':')[0]!)))
        counts.set(family, (counts.get(family) ?? 0) + 1);
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}
