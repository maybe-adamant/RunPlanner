import { describe, expect, it } from 'vitest';

import {
  createBiomeAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import { createAuthoringSession } from '@run-planner/engine/authoring';
import {
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';

import { equivalenceCorpus } from '../equivalence/corpus';
import { corpusRooms } from '../support/lifecycle-snapshots';

/**
 * Moving a row past the row whose verb starts a fight (an Opening or Devotion
 * gate pickup, a Ship wheel choice, a Fields cage) carries the fight with it:
 * the Combat marker stands at its trigger row's rank, the walk follows the
 * Timeline order, and the fight never starts before its trigger row.
 */

interface TriggerCase {
  readonly name: string;
  /** The equivalence corpus entry holding the room. */
  readonly corpus: string;
  readonly biomeKey: string;
  readonly occurrenceId: string;
  readonly phaseKey: string;
  readonly trigger: string;
  /** The row moved and its new index. */
  readonly moved: (triggerKey: string, rows: readonly string[]) => string;
  readonly toIndex: number;
}

const cases: readonly TriggerCase[] = [
  {
    name: 'a Devotion gate pickup moved behind a delivery',
    corpus: 'checkpoint/surface-no-hermes-shrine-delivery',
    biomeKey: 'O',
    occurrenceId: 'surface-o-devotion',
    phaseKey: 'Encounter',
    trigger: roomActionKey({
      kind: 'interactIncomingReward',
      producerPoint: 'beforeCombat',
      acquisitionRole: 'chosenSource',
    }),
    moved: (_trigger, rows) => rows.at(-1)!,
    toIndex: 0,
  },
  {
    name: 'a Ship wheel choice moved ahead of an Intro delivery',
    corpus: 'execution/surface-shrine-deliveries',
    biomeKey: 'O',
    occurrenceId: 'surface-o-combat01',
    phaseKey: 'Combat1',
    trigger: roomActionKey({ kind: 'chooseRewardWheel', wheelKey: 'wheel1' }),
    moved: (trigger) => trigger,
    toIndex: 0,
  },
  {
    name: 'a Fields cage moved ahead of an earlier cage',
    corpus: 'execution/fresh-file-fghi',
    biomeKey: 'H',
    occurrenceId: 'golden-h-combat02',
    phaseKey: 'Cage01',
    trigger: roomActionKey({ kind: 'completeFieldsCage', phaseKey: 'Cage01' }),
    moved: (trigger) => trigger,
    toIndex: 0,
  },
];

function roomOf(assembly: ProjectEvaluationAssembly, occurrenceId: string) {
  const room = corpusRooms(assembly).find((candidate) => candidate.occurrenceId === occurrenceId);
  if (room === undefined) throw new Error(`${occurrenceId} is not evaluated`);
  return room;
}

/** The Timeline in display order, as fight starts and the rows the walk records. */
function timelineOrder(assembly: ProjectEvaluationAssembly, occurrenceId: string): string[] {
  return roomOf(assembly, occurrenceId).roomLifecycleTimeline.entries.flatMap((entry) => {
    if (entry.kind === 'boundary')
      return entry.boundary.kind === 'encounterStarted' ? [`start ${entry.boundary.phaseKey}`] : [];
    if (entry.kind !== 'action') return [];
    const reference = entry.action.reference;
    switch (reference.kind) {
      case 'interactIncomingReward':
        return [`producer ${reference.producerPoint}`];
      case 'interactLocalReward':
        return [`acquire localReward:${reference.groupKey}:${reference.slotKey}`];
      case 'interactAcquisitionEntry':
        return [`acquire acquisitionEntry:${reference.siteKey}:${reference.entryKey}`];
      case 'interactWheelReward':
        return [`wheel ${reference.wheelKey}`];
      default:
        return [];
    }
  });
}

/** The walk's published history of the room, in the same vocabulary. */
function walkOrder(
  assembly: ProjectEvaluationAssembly,
  biomeKey: string,
  occurrenceId: string,
): string[] {
  const evaluated = assembly.evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  const events = evaluated !== undefined && 'history' in evaluated ? evaluated.history.events : [];
  return events.flatMap((event) => {
    if (
      !('origin' in event) ||
      event.origin.kind !== 'occurrence' ||
      event.origin.occurrenceId !== occurrenceId
    )
      return [];
    switch (event.kind) {
      case 'encounterStarted':
        return [`start ${event.phaseKey}`];
      case 'producerPointReached':
        return [`producer ${event.point}`];
      case 'acquisitionPointReached':
        return [`acquire ${event.point}`];
      case 'offerPointAcquired':
        return [`wheel ${event.offerPoint}`];
      default:
        return [];
    }
  });
}

function combatMarkerRank(
  assembly: ProjectEvaluationAssembly,
  occurrenceId: string,
  phaseKey: string,
) {
  const marker = roomOf(assembly, occurrenceId).roomLifecycleTimeline.entries.find(
    (entry) =>
      entry.kind === 'boundary' &&
      entry.boundary.kind === 'encounterStarted' &&
      entry.boundary.phaseKey === phaseKey,
  );
  return marker?.kind === 'boundary' ? { rank: marker.rank, placement: marker.placement } : marker;
}

function rowRank(assembly: ProjectEvaluationAssembly, occurrenceId: string, key: string) {
  return roomOf(assembly, occurrenceId).roomActionRoster.rows.find((row) => row.key === key)?.rank;
}

describe('moving a row across a fight trigger', () => {
  const corpus = equivalenceCorpus();
  for (const testCase of cases) {
    it(testCase.name, () => {
      const entry = corpus.find((candidate) => candidate.name === testCase.corpus);
      if (entry === undefined) throw new Error(`no corpus entry ${testCase.corpus}`);
      const start = simulateProjectAssembly(entry.catalog, entry.project());
      const id = testCase.occurrenceId;
      const room = roomOf(start, id);
      const moved = testCase.moved(
        testCase.trigger,
        room.roomActionRoster.rows.map((row) => row.key),
      );
      const session = createAuthoringSession(entry.catalog, start);
      const outcome = session.apply({
        kind: 'MoveRoomAction',
        action: createRoomActionAddress(
          createBiomeAddress(room.origin.routeKey, testCase.biomeKey),
          createOccurrenceId(id),
          moved,
        ),
        toIndex: testCase.toIndex,
      });
      expect(outcome.kind).toBe('applied');
      const after = session.current();

      // The Combat marker stands right after its trigger row, wherever the row moves.
      for (const assembly of [start, after])
        expect(combatMarkerRank(assembly, id, testCase.phaseKey)).toEqual({
          rank: rowRank(assembly, id, testCase.trigger),
          placement: 'after',
        });
      expect(rowRank(after, id, testCase.trigger)).not.toBe(rowRank(start, id, testCase.trigger));
      // The authored plan walks its whole Timeline.
      expect(walkOrder(start, testCase.biomeKey, id)).toEqual(timelineOrder(start, id));

      for (const assembly of [start, after]) {
        const timeline = timelineOrder(assembly, id);
        const walk = walkOrder(assembly, testCase.biomeKey, id);
        // The walk runs the Timeline's order, as far as it gets.
        expect(walk).toEqual(timeline.slice(0, walk.length));
        // The fight starts only after every row ranked before its trigger.
        const fight = walk.indexOf(`start ${testCase.phaseKey}`);
        if (fight >= 0)
          expect(walk.slice(0, fight)).toEqual(
            timeline.slice(0, timeline.indexOf(`start ${testCase.phaseKey}`)),
          );
      }
    });
  }
});
