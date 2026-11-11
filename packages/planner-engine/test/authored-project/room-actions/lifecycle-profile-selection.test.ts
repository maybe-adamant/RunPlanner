import { describe, expect, it } from 'vitest';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import { simulateProject } from '@run-planner/engine/simulation';

import { semanticAddressKey } from '../../../src/authored-project/addresses';
import type { ProjectDocument, RoomOccurrence } from '../../../src/authored-project/model';
import { roomLifecycleProfileKey } from '../../../src/authored-project/room-actions/lifecycle-profile';
import { resolveEntryDeclaration } from '../../../src/authored-project/room-state/entry-resolution';
import { equivalenceCorpus } from '../../equivalence/corpus';

/**
 * Witness that the walk runs the lifecycle the catalog selector chooses: for
 * every corpus room, the selector over its route-resolved declaration, Hub
 * role and occurrence names the profile the materialized room carries.
 */

interface FoundRoom {
  readonly room: Record<string, unknown>;
  readonly hubTarget: boolean;
}

/** Every materialized room in a canonical biome or prefix, marking Hub board targets. */
function materializedRooms(value: unknown, hubTarget: boolean, found: FoundRoom[]): void {
  if (Array.isArray(value)) {
    for (const item of value) materializedRooms(item, hubTarget, found);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (
    typeof record['lifecycleProfileKey'] === 'string' &&
    (record['kind'] === 'authored' || record['kind'] === 'hub')
  )
    found.push({ room: record, hubTarget });
  for (const [key, child] of Object.entries(record)) {
    if (key === 'origin' || key === 'incomingReward') continue;
    materializedRooms(child, key === 'room' && 'hubSlotKey' in record, found);
  }
}

/** Each corpus room the selector and the walk choose differently, with both profiles. */
function disagreements(name: string, catalog: Catalog, project: ProjectDocument): string[] {
  const result = simulateProject(catalog, project);
  const seen = new Set<string>();
  const found: string[] = [];
  const { routeKey, itineraryBiomeKeys } = project.route;
  for (const evaluation of result.route.biomes) {
    const plan = project.route.biomes.find((biome) => biome.biomeKey === evaluation.biomeKey);
    const occurrences = new Map<string, RoomOccurrence>(
      (plan?.topology?.occurrences ?? []).map((occurrence) => [
        occurrence.occurrenceId,
        occurrence,
      ]),
    );
    const rooms: FoundRoom[] = [];
    for (const key of ['snapshot', 'materializedPrefix', 'assessmentPrefix'] as const)
      if (key in evaluation)
        materializedRooms((evaluation as unknown as Record<string, unknown>)[key], false, rooms);
    for (const { room, hubTarget } of rooms) {
      const identity = `${evaluation.biomeKey}\u0000${semanticAddressKey(room['origin'] as never)}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const gameName = room['gameName'] as string;
      const raw = catalog.rooms.byKey[gameName];
      if (raw === undefined) throw new Error(`${name}: unknown room ${gameName}`);
      const declaration = resolveEntryDeclaration(raw, {
        routeKey,
        isFirst: itineraryBiomeKeys.indexOf(evaluation.biomeKey) === 0,
      });
      const occurrence =
        room['kind'] === 'hub' ? undefined : occurrences.get(room['occurrenceId'] as string);
      if (room['kind'] !== 'hub' && occurrence === undefined)
        throw new Error(`${name}: ${gameName} has no authored occurrence`);
      const role = 'localVisit' in room ? 'localVisit' : hubTarget ? 'hubTarget' : 'ordinary';
      const selector = roomLifecycleProfileKey(declaration, role, occurrence);
      const walk = room['lifecycleProfileKey'] as string;
      if (selector !== walk)
        found.push(`${name} ${evaluation.biomeKey}:${gameName} ${role}: ${selector} vs ${walk}`);
    }
  }
  return found;
}

const corpus = equivalenceCorpus();

describe('lifecycle-profile selection over the equivalence corpus', () => {
  it('runs the selected lifecycle in every room', () => {
    expect(
      corpus.flatMap((entry) => disagreements(entry.name, entry.catalog, entry.project())),
    ).toEqual([]);
  });
});
