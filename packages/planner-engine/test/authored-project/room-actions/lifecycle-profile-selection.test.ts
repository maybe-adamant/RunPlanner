import { describe, expect, it } from 'vitest';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import { simulateProject } from '@run-planner/engine/simulation';

import { semanticAddressKey } from '../../../src/authored-project/addresses';
import type {
  AuthoredBiomePlan,
  ProjectDocument,
  RoomOccurrence,
} from '../../../src/authored-project/model';
import { occurrenceLifecycle } from '../../../src/authored-project/room-actions/defaults';
import { roomLifecycleProfileKey } from '../../../src/authored-project/room-actions/lifecycle-profile';
import { resolveRoutePosition } from '../../../src/authored-project/route-context';
import { equivalenceCorpus } from '../../equivalence/corpus';

/**
 * Witness that a room's lifecycle and producer presence are one fact: for
 * every corpus room, the reward materialization builds matches the published
 * `runsProducer`, and command-time defaults choose the same lifecycle and
 * producer for the same occurrence.
 */

interface FoundRoom {
  readonly room: Record<string, unknown>;
  readonly hubTarget: boolean;
}

interface CorpusRoom extends FoundRoom {
  readonly name: string;
  readonly catalog: Catalog;
  readonly project: ProjectDocument;
  readonly plan: AuthoredBiomePlan;
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

function corpusRooms(): readonly CorpusRoom[] {
  const rooms: CorpusRoom[] = [];
  for (const entry of equivalenceCorpus()) {
    const project = entry.project();
    const result = simulateProject(entry.catalog, project);
    const seen = new Set<string>();
    for (const evaluation of result.route.biomes) {
      const plan = project.route.biomes.find((biome) => biome.biomeKey === evaluation.biomeKey);
      if (plan === undefined) continue;
      const found: FoundRoom[] = [];
      for (const key of ['snapshot', 'materializedPrefix', 'assessmentPrefix'] as const)
        if (key in evaluation)
          materializedRooms((evaluation as unknown as Record<string, unknown>)[key], false, found);
      for (const { room, hubTarget } of found) {
        const identity = semanticAddressKey(room['origin'] as never);
        if (seen.has(identity)) continue;
        seen.add(identity);
        rooms.push({ name: entry.name, catalog: entry.catalog, project, plan, room, hubTarget });
      }
    }
  }
  return rooms;
}

function occurrenceOf(room: CorpusRoom): RoomOccurrence {
  const occurrence = room.plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === room.room['occurrenceId'],
  );
  if (occurrence === undefined) throw new Error(`${room.name}: no authored occurrence`);
  return occurrence;
}

/** The command-time lifecycle and producer for the same occurrence. */
function commandTime(room: CorpusRoom): ReturnType<typeof occurrenceLifecycle> {
  return occurrenceLifecycle(
    room.catalog,
    resolveRoutePosition(room.catalog, room.project.route, room.plan.biomeKey),
    room.plan,
    room.plan.topology!,
    occurrenceOf(room),
  );
}

function hasReward(room: CorpusRoom): boolean {
  return (
    room.room['incomingReward'] !== undefined || room.room['unresolvedIncomingReward'] !== undefined
  );
}

function label(room: CorpusRoom): string {
  return `${room.name} ${room.plan.biomeKey}:${String(room.room['gameName'])}`;
}

function isFirstBiome(room: CorpusRoom): boolean {
  return resolveRoutePosition(room.catalog, room.project.route, room.plan.biomeKey).isFirst;
}

const rooms = corpusRooms();

function find(description: string, predicate: (room: CorpusRoom) => boolean): CorpusRoom {
  const room = rooms.find(predicate);
  if (room === undefined) throw new Error(`the corpus has no ${description}`);
  return room;
}

describe('room lifecycle and producer over the equivalence corpus', () => {
  it('materializes a reward exactly where the room runs a producer, and commands agree', () => {
    const disagreements = rooms.flatMap((room) => {
      if (room.room['kind'] === 'hub') {
        const declaration = room.catalog.rooms.byKey[room.room['gameName'] as string]!;
        return room.room['runsProducer'] === false &&
          declaration.incomingReward.kind === 'none' &&
          room.room['lifecycleProfileKey'] === roomLifecycleProfileKey(declaration, 'ordinary')
          ? []
          : [`${label(room)} Hub board`];
      }
      const command = commandTime(room);
      const runs = room.room['runsProducer'];
      return [
        ...(hasReward(room) === runs ? [] : [`${label(room)} reward ${hasReward(room)}`]),
        ...(command.producer === runs ? [] : [`${label(room)} command producer`]),
        ...(command.lifecycleProfileKey === room.room['lifecycleProfileKey']
          ? []
          : [`${label(room)} command ${command.lifecycleProfileKey}`]),
      ];
    });
    expect(rooms.length).toBeGreaterThan(500);
    expect(disagreements).toEqual([]);
  });

  it('runs the loadout reward at a route start holding it, and none at one without it', () => {
    const holding = find(
      'route start holding the loadout reward',
      (room) => room.room['entry'] === true && room.room['incomingReward'] !== undefined,
    );
    expect(holding.room['runsProducer']).toBe(true);
    expect(commandTime(holding).producer).toBe(true);
    const fresh = find(
      'first route start without the loadout reward',
      (room) => room.room['entry'] === true && isFirstBiome(room) && !hasReward(room),
    );
    expect(fresh.room['runsProducer']).toBe(false);
    expect(commandTime(fresh).producer).toBe(false);
    const later = find(
      'later biome start',
      (room) => room.room['entry'] === true && !isFirstBiome(room),
    );
    expect(later.room['runsProducer']).toBe(false);
    expect(commandTime(later).producer).toBe(false);
  });

  it('runs the run-start reward at a Dream Intro', () => {
    const intro = find(
      'Dream Intro',
      (room) =>
        room.project.route.routeKey === 'Dream' &&
        room.room['entry'] === true &&
        room.room['roomKind'] === 'Intro' &&
        isFirstBiome(room),
    );
    expect(hasReward(intro)).toBe(true);
    expect(intro.room['runsProducer']).toBe(true);
    expect(commandTime(intro).producer).toBe(true);
  });

  it('runs no producer in a forced-Goal Clockwork combat room', () => {
    const goal = find(
      'forced-Goal Clockwork combat room',
      (room) =>
        room.room['forcedRewardType'] === 'ClockworkGoal' && room.room['roomKind'] === 'Combat',
    );
    expect(goal.room).toMatchObject({
      runsProducer: false,
      lifecycleProfileKey: 'StandardRewardRoom',
    });
    expect(hasReward(goal)).toBe(false);
    expect(commandTime(goal)).toEqual({
      lifecycleProfileKey: 'StandardRewardRoom',
      producer: false,
    });
  });

  it("keeps the shop's producer in a Preboss whose door forces the Goal", () => {
    const preboss = find(
      'forced-Goal Preboss',
      (room) =>
        room.room['forcedRewardType'] === 'ClockworkGoal' && room.room['roomKind'] === 'Preboss',
    );
    expect(preboss.room).toMatchObject({
      runsProducer: true,
      lifecycleProfileKey: 'PrebossShopRoom',
      incomingReward: { producerKind: 'shop' },
    });
    expect(commandTime(preboss)).toEqual({
      lifecycleProfileKey: 'PrebossShopRoom',
      producer: true,
    });
  });

  it('runs a Hub target in its Hub-target lifecycle, and the Hub board without a producer', () => {
    for (const kind of ['Miniboss', 'Story'] as const) {
      const target = find(
        `${kind} Hub target`,
        (room) => room.hubTarget && room.room['roomKind'] === kind,
      );
      expect(target.room).toMatchObject({
        runsProducer: true,
        lifecycleProfileKey: 'EphyraMainRoom',
      });
      expect(commandTime(target)).toEqual({
        lifecycleProfileKey: 'EphyraMainRoom',
        producer: true,
      });
    }
    const board = find('Hub board', (room) => room.room['kind'] === 'hub');
    expect(board.room).toMatchObject({
      runsProducer: false,
      lifecycleProfileKey: 'EphyraHubRoom',
    });
  });

  it('runs the producer of a reward not chosen yet', () => {
    const unresolved = find(
      'room with an unchosen reward',
      (room) => room.room['unresolvedIncomingReward'] !== undefined,
    );
    expect(unresolved.room['runsProducer']).toBe(true);
    expect(commandTime(unresolved).producer).toBe(true);
  });
});
