import { describe, expect, it } from 'vitest';

import { roomActionKey, type RoomActionReference } from '@run-planner/engine/authored-project';
import {
  encounterOutcomesForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { equivalenceCorpus } from '../../equivalence/corpus';
import { corpusRooms } from '../../support/lifecycle-snapshots';

function room(entryName: string, gameName: string) {
  const entry = equivalenceCorpus().find((candidate) => candidate.name === entryName);
  if (entry === undefined) throw new Error(`no corpus entry ${entryName}`);
  const assembly = simulateProjectAssembly(entry.catalog, entry.project());
  const found = corpusRooms(assembly).find((candidate) => candidate.gameName === gameName);
  if (found === undefined) throw new Error(`${entryName} enters no ${gameName}`);
  const origin = found.origin as Parameters<
    typeof encounterOutcomesForProjectEvaluationAssembly
  >[2];
  return {
    room: found,
    outcomes: encounterOutcomesForProjectEvaluationAssembly(entry.catalog, assembly, origin) ?? [],
    timeline: found.roomLifecycleTimeline,
  };
}

function markers(timeline: ReturnType<typeof room>['timeline'], phaseKey: string) {
  const entry = timeline.entries.find(
    (candidate: (typeof timeline.entries)[number]) =>
      candidate.kind === 'boundary' &&
      candidate.boundary.kind === 'encounterBegun' &&
      candidate.boundary.phaseKey === phaseKey,
  );
  return entry?.kind === 'boundary' && entry.boundary.kind === 'encounterBegun'
    ? entry.boundary.markers
    : undefined;
}

describe('encounter markers', () => {
  it('merges a gate-free fight whose outcome its encounter hosts', () => {
    const { room: p, outcomes, timeline } = room('execution/surface-nopq', 'P_Combat03');
    expect(p.encounters.aetosWaveByPhase?.Combat).toBeUndefined();
    expect(outcomes.find((outcome) => outcome.phaseKey === 'Combat')).toMatchObject({
      host: { kind: 'encounter' },
      choices: expect.arrayContaining(['aetos']),
    });
    expect(markers(timeline, 'Combat')).toBe('merged');
  });

  it('splits an Anomaly, whose Combat observes its capture', () => {
    const { timeline } = room('execution/fg-anomaly', 'B_Combat01');
    expect(markers(timeline, 'Encounter')).toBe('split');
  });

  it('splits a gated Opening fight', () => {
    const { timeline } = room('execution/f-opening', 'F_Opening01');
    expect(markers(timeline, 'Encounter')).toBe('split');
  });

  it('merges a gate-free fight with nothing to record at its Combat', () => {
    const { outcomes, timeline } = room('execution/f-opening', 'F_Combat02');
    expect(outcomes).toEqual([]);
    expect(markers(timeline, 'Encounter')).toBe('merged');
  });
});

/** Each Timeline boundary of a room by event key, with the row its trigger names. */
function triggers(entryName: string, occurrenceId: string) {
  const entry = equivalenceCorpus().find((candidate) => candidate.name === entryName);
  if (entry === undefined) throw new Error(`no corpus entry ${entryName}`);
  const assembly = simulateProjectAssembly(entry.catalog, entry.project());
  const found = corpusRooms(assembly).find((candidate) => candidate.occurrenceId === occurrenceId);
  if (found === undefined) throw new Error(`${entryName} enters no ${occurrenceId}`);
  const timeline = found.roomLifecycleTimeline;
  const ranks = new Map(
    timeline.entries.flatMap((candidate) =>
      candidate.kind === 'action' ? [[candidate.action.key, candidate.rank] as const] : [],
    ),
  );
  return timeline.entries.flatMap((candidate) => {
    if (candidate.kind !== 'boundary') return [];
    const trigger = candidate.trigger;
    if (trigger !== undefined) {
      // A triggered marker stands right after its trigger row, in its own room.
      expect(trigger).toMatchObject({ kind: 'roomAction', occurrenceId });
      expect([candidate.rank, candidate.placement]).toEqual([
        ranks.get(trigger.actionKey),
        'after',
      ]);
    }
    return [[candidate.boundary.key, trigger?.actionKey] as const];
  });
}

const key = (reference: RoomActionReference) => roomActionKey(reference);

describe('encounter marker triggers', () => {
  it('starts a Fields cage encounter at its Unlock row', () => {
    const cage = key({ kind: 'completeFieldsCage', phaseKey: 'Cage01' });
    expect(triggers('execution/fresh-file-fghi', 'golden-h-combat02')).toEqual(
      expect.arrayContaining([
        ['encounterBegun:Cage01', cage],
        ['encounterStarted:Cage01', cage],
        ['encounterEnd:Cage01', undefined],
      ]),
    );
  });

  it('leaves a cage whose Unlock row is unplaced untriggered', () => {
    const found = triggers('checkpoint/dream-h-artificer-echo', 'dream-user-h-combat04-tail');
    expect(found.some(([event]) => event.startsWith('encounterBegun:'))).toBe(true);
    expect(found.filter(([, trigger]) => trigger !== undefined)).toEqual([]);
  });

  it("starts a Ship phase's Combat at its wheel choice, not as its wheels open", () => {
    expect(triggers('execution/surface-nopq', 'surface-o-combat04')).toEqual(
      expect.arrayContaining([
        ['wheelsOpen:wheel1', undefined],
        ['encounterBegun:Combat1', undefined],
        ['encounterStarted:Combat1', key({ kind: 'chooseRewardWheel', wheelKey: 'wheel1' })],
        ['encounterEnd:Combat1', undefined],
      ]),
    );
  });

  it("starts an Opening room's Combat at its gate pickup", () => {
    const found = triggers('execution/f-opening', 'golden-f-start');
    expect(found).toEqual(
      expect.arrayContaining([
        ['encounterBegun:Encounter', undefined],
        [
          'encounterStarted:Encounter',
          key({
            kind: 'interactIncomingReward',
            producerPoint: 'roomRewardPickup',
            acquisitionRole: 'source',
          }),
        ],
      ]),
    );
  });

  it("starts a Devotion room's Combat at the chosen god's pickup", () => {
    expect(triggers('checkpoint/surface-no-hermes-shrine-delivery', 'surface-o-devotion')).toEqual(
      expect.arrayContaining([
        ['encounterBegun:Encounter', undefined],
        [
          'encounterStarted:Encounter',
          key({
            kind: 'interactIncomingReward',
            producerPoint: 'beforeCombat',
            acquisitionRole: 'chosenSource',
          }),
        ],
      ]),
    );
  });

  it("begins a locked door's fight at its press", () => {
    const triggered = triggers('execution/underworld-g-locked-doors', 'golden-g-b1-e1').filter(
      ([, trigger]) => trigger !== undefined,
    );
    // Its merged Encounter and Combat marker stands right after the press.
    expect(triggered.map(([event]) => event.split(':')[0])).toEqual([
      'encounterBegun',
      'encounterStarted',
    ]);
    expect(new Set(triggered.map(([, trigger]) => JSON.parse(trigger!)[0]))).toEqual(
      new Set(['unlockExit']),
    );
  });

  it('triggers nothing in a room whose fight starts with it', () => {
    const { room: combat } = room('execution/f-opening', 'F_Combat02');
    const found = triggers('execution/f-opening', combat.occurrenceId);
    expect(found).toEqual(expect.arrayContaining([['encounterStarted:Encounter', undefined]]));
    expect(found.filter(([, trigger]) => trigger !== undefined)).toEqual([]);
  });
});
