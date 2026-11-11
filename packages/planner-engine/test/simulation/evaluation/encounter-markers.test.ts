import { describe, expect, it } from 'vitest';

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
  return entry?.kind === 'boundary' ? entry.markers : undefined;
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
