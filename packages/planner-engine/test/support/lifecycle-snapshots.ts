import { readFileSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';

import type { ProjectDocument } from '@run-planner/engine/authored-project';
import {
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import type { RoomHistoryOrigin } from '../../src/simulation/lifecycle/model';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import {
  candidateBiome,
  candidateBiomeRooms,
} from '../../src/simulation/candidates/evaluated-biome';
import { equivalenceCorpus, type EquivalenceEntry } from '../equivalence/corpus';

/**
 * Checked-in lifecycle witnesses over the equivalence corpus. Each is a plain
 * JSON tree with one line per row or room, in corpus and room order;
 * `LIFECYCLE_SNAPSHOT_WRITE=1` rewrites them from the current code.
 */
export const writingLifecycleSnapshots = process.env.LIFECYCLE_SNAPSHOT_WRITE === '1';

export interface CorpusAssembly {
  readonly entry: EquivalenceEntry;
  readonly project: ProjectDocument;
  readonly assembly: ProjectEvaluationAssembly;
}

/** Simulates every corpus entry in corpus order. */
export function* corpusAssemblies(): Generator<CorpusAssembly> {
  for (const entry of equivalenceCorpus()) {
    const project = entry.project();
    yield { entry, project, assembly: simulateProjectAssembly(entry.catalog, project) };
  }
}

/** Every authored room the evaluation retains, biome by biome, in its canonical order. */
export function corpusRooms(assembly: ProjectEvaluationAssembly): readonly CanonicalAuthoredRoom[] {
  const { route } = assembly.evaluation;
  return route.biomes.flatMap((biome) => {
    const evaluated = candidateBiome(assembly.evaluation, route.routeKey, biome.biomeKey);
    return evaluated === undefined ? [] : candidateBiomeRooms(evaluated);
  });
}

/** A room's stable label within its entry: its biome, occurrence and game name. */
export function roomLabel(origin: RoomHistoryOrigin, gameName?: string): string {
  const id = origin.kind === 'occurrence' ? origin.occurrenceId : origin.kind;
  return `${origin.biomeKey}/${id}${gameName === undefined ? '' : ` ${gameName}`}`;
}

/** A key part with its URI encoding and nested JSON quoting removed, for reading. */
export function readable(part: string): string {
  let decoded = part;
  for (let pass = 0; pass < 3 && /%[0-9A-F]{2}/i.test(decoded); pass += 1)
    decoded = decodeURIComponent(decoded);
  return decoded.replaceAll(/[\\"]/g, '');
}

/** A room-action key in compact form: its readable JSON parts joined by colons. */
export function compactActionKey(key: string): string {
  const parts = JSON.parse(key) as readonly unknown[];
  return parts.map((part) => readable(String(part))).join(':');
}

/** One room's witness in one corpus entry. */
export interface RoomWitness<Content extends object> {
  readonly entry: string;
  readonly room: string;
  readonly content: Content;
}

/**
 * Groups witnesses by room, then by identical content: corpus entries share
 * most rooms, so each distinct variant is written once with the entries that
 * hold it, in first-appearance order.
 */
export function byRoomVariant<Content extends object>(
  witnesses: readonly RoomWitness<Content>[],
): Record<string, readonly ({ readonly entries: readonly string[] } & Content)[]> {
  const rooms = new Map<string, Map<string, { entries: string[]; content: Content }>>();
  for (const { entry, room, content } of witnesses) {
    const variants = rooms.get(room) ?? new Map<string, { entries: string[]; content: Content }>();
    const key = JSON.stringify(content);
    const variant = variants.get(key) ?? { entries: [], content };
    if (variant.entries.includes(entry)) throw new Error(`${entry} repeats room ${room}`);
    variant.entries.push(entry);
    variants.set(key, variant);
    rooms.set(room, variants);
  }
  return Object.fromEntries(
    [...rooms].map(([room, variants]) => [
      room,
      [...variants.values()].map(({ entries, content }) => ({ entries, ...content })),
    ]),
  );
}

/** Adds a key, refusing a collision so no line is silently overwritten. */
export function setUnique<T>(target: Record<string, T>, key: string, value: T): void {
  if (Object.hasOwn(target, key)) throw new Error(`duplicate snapshot key ${key}`);
  target[key] = value;
}

function differences(expected: unknown, actual: unknown, path: string, out: string[]): void {
  if (out.length >= 40) return;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    for (let index = 0; index < Math.max(expected.length, actual.length); index += 1)
      differences(expected[index], actual[index], `${path}[${index}]`, out);
    return;
  }
  if (
    typeof expected === 'object' &&
    expected !== null &&
    typeof actual === 'object' &&
    actual !== null &&
    !Array.isArray(expected) &&
    !Array.isArray(actual)
  ) {
    const before = expected as Record<string, unknown>;
    const after = actual as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    for (const key of keys) differences(before[key], after[key], `${path} > ${key}`, out);
    if (JSON.stringify(Object.keys(before)) !== JSON.stringify(Object.keys(after)))
      out.push(`${path}: key order changed`);
    return;
  }
  const left = JSON.stringify(expected);
  const right = JSON.stringify(actual);
  if (left !== right) out.push(`${path}\n    - ${left}\n    + ${right}`);
}

/**
 * Compares a witness with its checked-in snapshot, naming each changed line,
 * or rewrites the snapshot when `LIFECYCLE_SNAPSHOT_WRITE=1`.
 */
export async function assertLifecycleSnapshot(path: string, actual: unknown): Promise<void> {
  if (writingLifecycleSnapshots) {
    const options = await resolveConfig(path);
    writeFileSync(path, await format(JSON.stringify(actual), { ...options, filepath: path }));
    return;
  }
  const expected = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const found: string[] = [];
  differences(expected, actual, '$', found);
  if (found.length > 0)
    throw new Error(
      `${path} differs (first ${found.length}; LIFECYCLE_SNAPSHOT_WRITE=1 rewrites it for an intended change):\n  ${found.join('\n  ')}`,
    );
}
