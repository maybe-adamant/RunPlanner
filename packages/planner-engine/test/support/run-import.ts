import { readFileSync } from 'node:fs';

import { expect } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createRewardWheelOfferAddress,
  type OccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
  type RoomOccurrence,
  type SemanticAddress,
} from '../../src/authored-project';
import type { ResolvedRewardOffer } from '../../src/reward-kernel';
import { decodeRunRecord, type RunRecord } from '../../src/run-record';
import { occurrenceSnapshot, storeCounts } from '../../src/simulation/run-import/conformance';
import {
  simulateProjectAssembly,
  type RunImportReport,
  type RunImportReportEntry,
} from '../../src/simulation';

export function fixture(name: string): RunRecord {
  return decodeRunRecord(
    JSON.parse(
      readFileSync(
        new URL(`../run-record/fixtures/${name}.run-record.json`, import.meta.url),
        'utf8',
      ),
    ),
  );
}

export function occurrence(project: ProjectDocument, occurrenceId: string): RoomOccurrence {
  for (const biome of project.route.biomes)
    for (const entry of biome.topology?.occurrences ?? [])
      if (entry.occurrenceId === occurrenceId) return entry;
  throw new Error(`missing occurrence ${occurrenceId}`);
}

export function reward(project: ProjectDocument, occurrenceId: string) {
  const state = occurrence(project, occurrenceId).state;
  if (!('reward' in state) || state.reward === null)
    throw new Error(`${occurrenceId} has no reward`);
  return state.reward;
}

/** Report entries counted by reason, then area, so coverage changes show as a diff. */
export function grouped(report: RunImportReport) {
  const counts: Record<string, Record<string, number>> = {};
  for (const entry of report.entries) {
    const byArea = (counts[entry.reason] ??= {});
    byArea[entry.area] = (byArea[entry.area] ?? 0) + 1;
  }
  return counts;
}

/** The occurrence an address names, found through its nested owners. */
function occurrenceOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const field of ['occurrenceId', 'sourceOccurrenceId'])
    if (typeof record[field] === 'string') return record[field];
  for (const nested of Object.values(record)) {
    const found = occurrenceOf(nested);
    if (found !== undefined) return found;
  }
  return undefined;
}

function describeAddress(address: SemanticAddress | undefined): string {
  if (address === undefined) return '-';
  const record = address as unknown as Record<string, unknown>;
  const detail = ['exitKey', 'phaseKey', 'slotKey', 'acquisitionRole', 'hubKey']
    .flatMap((field) => (typeof record[field] === 'string' ? [record[field]] : []))
    .join('/');
  return `${address.kind}@${occurrenceOf(address) ?? ('biomeKey' in address ? address.biomeKey : '-')}${detail === '' ? '' : `:${detail}`}`;
}

function describeCommand(command: ProjectCommand | undefined): string {
  if (command === undefined) return '';
  const record = command as unknown as Record<string, unknown>;
  const value = record['value'] as Record<string, unknown> | undefined;
  const shown =
    record['gameName'] ??
    record['encounterKey'] ??
    (typeof value?.['rewardType'] === 'string' ? value['rewardType'] : undefined) ??
    (Array.isArray(value?.['options'])
      ? `${(value['options'] as { traitKey: string }[]).map((option) => option.traitKey).join('|')}#${String(value['selectedOptionKey'])}`
      : undefined) ??
    (typeof value?.['kind'] === 'string' ? value['kind'] : undefined) ??
    '';
  return ` -> ${command.kind}(${occurrenceOf(command) ?? ''}${shown === '' ? '' : ` ${String(shown)}`})`;
}

/** One stable line per entry: reason, area, record room and door, owner and applied value. */
export function describeEntry(entry: RunImportReportEntry): string {
  const where =
    entry.record === undefined
      ? 'r-'
      : `r${entry.record.roomIndex}${entry.record.door === undefined ? '' : `d${entry.record.door}`}`;
  return `${entry.reason} ${entry.area} ${where} ${describeAddress(entry.address)}${describeCommand(entry.applied)}`;
}

/** The refused and assumed values, one stable line each, so a swapped door or encounter shows. */
export function entryLines(report: RunImportReport): readonly string[] {
  return report.entries
    .filter((entry) => entry.reason === 'refused' || entry.reason === 'assumption')
    .map(describeEntry);
}

/** The run-state differences from the entry saves, one stable line each. */
export function mismatchLines(report: RunImportReport): readonly string[] {
  return report.entries
    .filter((entry) => entry.reason === 'mismatch')
    .map(
      (entry) =>
        `${entry.area} r${entry.record?.roomIndex ?? '-'} ${entry.mismatch?.field}: ${entry.mismatch?.expected} | ${entry.mismatch?.actual}`,
    );
}

/** The project with a ship's unpicked wheel offers replaced, by wheel. */
export function withWheelOffers(
  project: ProjectDocument,
  occurrenceId: string,
  values: Readonly<Record<string, ResolvedRewardOffer>>,
): ProjectDocument {
  const ship = occurrence(project, occurrenceId);
  const biome = project.route.biomes.find((entry) =>
    entry.topology?.occurrences.some((candidate) => candidate.occurrenceId === occurrenceId),
  )!;
  return Object.entries(values).reduce((current, [wheelKey, value]) => {
    const wheel = ship.state.kind === 'shipCombat' ? ship.state.wheels[wheelKey] : undefined;
    if (wheel === undefined) throw new Error(`${occurrenceId} has no ${wheelKey}`);
    return applyProjectCommand(current, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(
        createBiomeAddress(project.route.routeKey, biome.biomeKey),
        ship.occurrenceId,
        wheelKey,
        `offer${3 - wheel.pickedOfferIndex}`,
      ),
      value,
    });
  }, project);
}

/** What later rooms read of a ship's draws as it is left: stores, priorities, god pool and rerolls. */
export function shipExitState(project: ProjectDocument, occurrenceId: string) {
  const assembly = simulateProjectAssembly(catalog, project);
  const biomeKey = project.route.biomes.find((entry) =>
    entry.topology?.occurrences.some((candidate) => candidate.occurrenceId === occurrenceId),
  )!.biomeKey;
  const snapshot = occurrenceSnapshot(
    assembly,
    { biomeKey, occurrenceId: occurrenceId as OccurrenceId },
    'beforeRoomExit',
  );
  if (snapshot === undefined) throw new Error(`${occurrenceId} was not left`);
  return {
    stores: Object.fromEntries(
      [...storeCounts(catalog, project.route.routeKey, snapshot)].map(([key, { counts }]) => [
        key,
        counts,
      ]),
    ),
    priorities: snapshot.rewardPriorities,
    godPool: snapshot.godPool,
    rerolls: snapshot.rerolls.remaining,
  };
}

/** Rooms the imported plan enters, in order, read from the evaluated route history. */
export function enteredRooms(project: ProjectDocument): readonly string[] {
  const evaluation = simulateProjectAssembly(catalog, project).evaluation;
  expect(evaluation.status).toBe('valid');
  const last = [...evaluation.route.biomes].reverse().find((biome) => 'history' in biome);
  if (last === undefined || !('history' in last)) throw new Error('no evaluated history');
  return last.history.ledgers.roomAppearances.map((appearance) => appearance.gameName);
}

/** The Sea Star duplicate pickups authored in an occurrence. */
export function seaStarDuplicates(project: ProjectDocument, occurrenceId: string) {
  return Object.entries(occurrence(project, occurrenceId).acquisitionSites ?? {})
    .flatMap(([siteKey, site]) =>
      siteKey.startsWith('seaStarDuplicate:') ? Object.values(site.pickupEntries ?? {}) : [],
    )
    .flatMap((entry) => (entry === null ? [] : [entry]));
}

export function generatedCustomizations(project: ProjectDocument): number {
  return project.route.biomes
    .flatMap((biome) => biome.topology?.occurrences ?? [])
    .flatMap((entry) => Object.values(entry.encounters.customizationByPhase ?? {}))
    .flatMap((byDecision) => Object.values(byDecision))
    .filter((value) => value.kind === 'generated').length;
}

/** Every authored trait option of `traitKey` within a value, however deeply its owner nests it. */
export function authoredOptions(
  value: unknown,
  traitKey: string,
): readonly Record<string, unknown>[] {
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  return [
    ...(record['traitKey'] === traitKey ? [record] : []),
    ...Object.values(record).flatMap((nested) => authoredOptions(nested, traitKey)),
  ];
}
