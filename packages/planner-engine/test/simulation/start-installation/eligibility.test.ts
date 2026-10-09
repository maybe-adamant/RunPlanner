import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument, RunStartPoint } from '@run-planner/engine/authored-project';
import {
  authoredStartPointEligibility,
  simulateProject,
  startPointDomain,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

const golden = createGoldenFGHIProject();
const evaluation = simulateProject(catalog, golden);
const withStartPoint = (startPoint: RunStartPoint): ProjectDocument => ({
  ...golden,
  route: { ...golden.route, loadout: { ...golden.route.loadout, runModifiers: { startPoint } } },
});

describe('start point eligibility', () => {
  it('lists every itinerary Opening and Preboss with its installation availability', () => {
    const domain = startPointDomain(catalog, golden, evaluation);
    expect(domain.map(({ biomeKey, point }) => `${biomeKey}:${point}`)).toEqual(
      golden.route.itineraryBiomeKeys.flatMap((biomeKey) => [
        `${biomeKey}:opening`,
        `${biomeKey}:preboss`,
      ]),
    );
    expect(domain[0]!.status).toEqual({
      availability: 'unavailable',
      reason: { kind: 'routeStart' },
    });
    expect(domain.slice(1).every((option) => option.status.availability === 'available')).toBe(
      true,
    );
  });

  it('assesses the authored start point, keeping a dangling biome as not on the itinerary', () => {
    expect(authoredStartPointEligibility(catalog, golden, evaluation)).toEqual({ kind: 'unset' });
    const eligible = authoredStartPointEligibility(
      catalog,
      withStartPoint({ biomeKey: 'H', point: 'preboss', gold: 10 }),
      evaluation,
    );
    expect(eligible).toMatchObject({
      kind: 'eligible',
      startPoint: { biomeKey: 'H', point: 'preboss', gold: 10 },
    });
    expect(eligible.kind === 'eligible' && eligible.installation.startPoint).toEqual({
      biomeKey: 'H',
      kind: 'preboss',
    });
    for (const [startPoint, reason] of [
      [{ biomeKey: 'N', point: 'opening' }, 'notOnItinerary'],
      [{ biomeKey: 'F', point: 'opening' }, 'routeStart'],
    ] as const)
      expect(
        authoredStartPointEligibility(catalog, withStartPoint(startPoint), evaluation),
      ).toEqual({ kind: 'ineligible', startPoint, reason: { kind: reason } });
  });
});
