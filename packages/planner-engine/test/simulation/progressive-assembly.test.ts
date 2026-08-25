import { describe, expect, it } from 'vitest';

import * as fixture from './support/progressive-biome-fixtures';

const {
  catalog,
  createBiomeAddress,
  createGoldenFGHIProject,
  loadSurfaceNOPQProject,
  roomActionDomainForOccurrence,
  roomActionKey,
  simulateProject,
  structurallyActiveOccurrenceIds,
} = fixture;

describe('progressive assembly witness', () => {
  it('strengthens the same complete routes to canonical products and remains deterministic', () => {
    const underworld = createGoldenFGHIProject();
    const surface = loadSurfaceNOPQProject();
    const firstUnderworld = simulateProject(catalog, underworld);
    const secondUnderworld = simulateProject(catalog, underworld);
    const surfaceResult = simulateProject(catalog, surface);

    expect(secondUnderworld).toEqual(firstUnderworld);
    for (const { result, routeKey } of [
      { result: firstUnderworld, routeKey: 'Underworld' },
      { result: surfaceResult, routeKey: 'Surface' },
    ] as const) {
      const evaluatedRoute = result.routes.find((candidate) => candidate.routeKey === routeKey);
      if (evaluatedRoute === undefined) throw new Error(`missing ${routeKey} route`);
      expect(evaluatedRoute.processing.active).toBeNull();
      expect(evaluatedRoute.processing.blockedSuffix).toEqual([]);
      expect(evaluatedRoute.biomes).toHaveLength(4);
      expect(evaluatedRoute.biomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            authoring: 'complete',
            validity: 'valid',
            coverage: { kind: 'complete' },
          }),
        ]),
      );
    }
    expect(Object.isFrozen(firstUnderworld)).toBe(true);
    expect(Object.isFrozen(firstUnderworld.routes)).toBe(true);
  });

  it('keeps every active occurrence in the representative F-through-Q fixtures closed over required actions', () => {
    const missing: string[] = [];
    for (const project of [createGoldenFGHIProject(), loadSurfaceNOPQProject()]) {
      for (const route of project.routes) {
        for (const plan of route.biomes) {
          if (plan.topology === null) continue;
          const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
          for (const occurrenceId of structurallyActiveOccurrenceIds(plan.topology)) {
            const resolved = roomActionDomainForOccurrence(project, catalog, biome, occurrenceId);
            if (resolved === undefined)
              throw new Error(`missing active ${plan.biomeKey} occurrence`);
            const authored = new Set(resolved.occurrence.roomActions.order.map(roomActionKey));
            for (const contribution of resolved.domain.contributions) {
              if (
                contribution.kind === 'action' &&
                contribution.participation === 'required' &&
                !authored.has(roomActionKey(contribution.reference))
              ) {
                missing.push(
                  `${route.routeKey}/${plan.biomeKey}/${occurrenceId}/${roomActionKey(contribution.reference)}`,
                );
              }
            }
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
