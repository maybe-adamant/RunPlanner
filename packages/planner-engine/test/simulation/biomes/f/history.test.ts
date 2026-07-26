import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { type ProjectDocument } from '@run-planner/engine/authored-project';
import {
  composeBiomeHistory,
  evaluateBiomeCompleteness,
  materializeBiome,
} from '@run-planner/engine/simulation';

import { createCompleteFTakeoverProject, fBiome } from '../../support/f-takeover-project';

function fPlan(project: ProjectDocument) {
  const plan = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'F');
  if (plan === undefined) throw new Error('missing F takeover plan');
  return plan;
}

function history(project = createCompleteFTakeoverProject()) {
  const completeness = evaluateBiomeCompleteness(catalog, fBiome, fPlan(project));
  if (completeness.completion !== 'complete') throw new Error('F fixture is incomplete');
  return composeBiomeHistory(catalog, materializeBiome(catalog, fBiome, completeness));
}

describe('F takeover history', () => {
  it('creates every physical target at its source outgoing checkpoint', () => {
    const result = history();
    const created = result.events.filter((event) => event.kind === 'roomCreated');

    expect(
      created.map((event) =>
        event.source === 'generatedTarget'
          ? [
              event.source,
              event.gameName,
              event.generationIndex,
              event.generationCount,
              event.picked,
            ]
          : [event.source, event.gameName],
      ),
    ).toEqual([
      ['biomeEntry', 'F_Opening01'],
      ['generatedTarget', 'F_Combat02', 1, 1, true],
      ['generatedTarget', 'F_PreBoss01', 1, 2, true],
      ['generatedTarget', 'F_PreBoss01', 2, 2, false],
      ['layoutCompletion', 'F_Boss01'],
      ['layoutCompletion', 'F_PostBoss01'],
    ]);
  });

  it('enters only the selected Preboss while retaining the unpicked peer creation', () => {
    const result = history();

    expect(result.ledgers.roomAppearances.map((entry) => entry.gameName)).toEqual([
      'F_Opening01',
      'F_Combat02',
      'F_PreBoss01',
      'F_Boss01',
      'F_PostBoss01',
    ]);
    expect(
      result.ledgers.roomAppearances.filter((entry) => entry.origin.kind === 'occurrence'),
    ).toHaveLength(3);
    expect(
      result.ledgers.roomCreations.filter((event) => event.gameName === 'F_PreBoss01'),
    ).toHaveLength(2);
  });

  it('walks selected Preboss and completion rooms before biome completion and resets', () => {
    const result = history();
    const completion = result.events.findIndex((event) => event.kind === 'biomeCompleted');
    const postbossCommit = result.events.findIndex(
      (event) =>
        event.kind === 'roomCommitted' &&
        event.origin.kind === 'completionRoom' &&
        event.origin.role === 'postboss',
    );
    const reset = result.events.findIndex((event) => event.kind === 'biomeCounterReset');

    expect(postbossCommit).toBeGreaterThan(0);
    expect(completion).toBeGreaterThan(postbossCommit);
    expect(reset === -1 || reset > completion).toBe(true);
  });

  it('is deterministic and does not mutate the canonical snapshot', () => {
    const project = createCompleteFTakeoverProject();
    const completeness = evaluateBiomeCompleteness(catalog, fBiome, fPlan(project));
    if (completeness.completion !== 'complete') throw new Error('F fixture is incomplete');
    const snapshot = materializeBiome(catalog, fBiome, completeness);
    const before = JSON.parse(JSON.stringify(snapshot));
    const first = composeBiomeHistory(catalog, snapshot);
    const second = composeBiomeHistory(catalog, snapshot);

    expect(first).toEqual(second);
    expect(snapshot).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.events)).toBe(true);
  });
});
