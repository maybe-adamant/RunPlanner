import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createProjectDocument,
  decodeProjectDocument,
  encodeProjectDocument,
  resolveRoutePosition,
  resolveCompletionBoss,
  applyProjectCommand,
  createRouteAddress,
} from '@run-planner/engine/authored-project';

describe('authored route context', () => {
  it('expands a configured prefix along the supplied itinerary without changing it', () => {
    const initial = createProjectDocument(catalog, {
      projectId: 'mixed-prefix',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['Q', 'F', 'N', 'I'],
      configuredBiomeCount: 1,
    });
    const expanded = applyProjectCommand(initial, catalog, {
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Dream'),
      configuredBiomeCount: 3,
    });
    expect(expanded.route.biomes.map((biome) => biome.biomeKey)).toEqual(['Q', 'F', 'N']);
    expect(expanded.route.itineraryBiomeKeys).toEqual(initial.route.itineraryBiomeKeys);
    expect(resolveRoutePosition(catalog, expanded.route, 'N').isLast).toBe(false);
    expect(resolveRoutePosition(catalog, expanded.route, 'I').isLast).toBe(true);
  });

  it('resolves Rivals from itinerary position rather than the biome preset', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'mixed-rivals',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['H', 'F', 'N', 'I'],
    });
    expect(
      resolveCompletionBoss(catalog, resolveRoutePosition(catalog, project.route, 'H'), 1).gameName,
    ).toBe('H_Boss02');
    expect(
      resolveCompletionBoss(catalog, resolveRoutePosition(catalog, project.route, 'F'), 1).gameName,
    ).toBe('F_Boss01');
  });

  it.each([['F', 'F'], ['Unknown'], ['F', 'G', 'H', 'I', 'N']])(
    'rejects a structurally invalid itinerary %j',
    (...itineraryBiomeKeys) => {
      expect(() =>
        createProjectDocument(catalog, {
          projectId: 'bad-itinerary',
          routeKey: 'Dream',
          itineraryBiomeKeys,
        }),
      ).toThrow();
    },
  );

  it('keeps an ordinary full itinerary distinct from its configured prefix', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'ordinary-prefix',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });

    expect(project.route.itineraryBiomeKeys).toEqual(['F', 'G', 'H', 'I']);
    expect(project.route.biomes.map((biome) => biome.biomeKey)).toEqual(['F']);
    expect(resolveRoutePosition(catalog, project.route, 'F')).toMatchObject({
      ordinal: 1,
      isFirst: true,
      isLast: false,
      nextBiomeKey: 'G',
      completion: { kind: 'resolved', prebossRoomGameName: 'F_PreBoss01' },
    });
  });

  it('structurally decodes a supplied Dream itinerary without treating it as terminal mapping', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'dream-context',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['N', 'F', 'O', 'G'],
      configuredBiomeCount: 2,
    });
    const decoded = decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);

    expect(decoded.route.biomes.map((biome) => biome.biomeKey)).toEqual(['N', 'F']);
    expect(resolveRoutePosition(catalog, decoded.route, 'F')).toEqual({
      routeKey: 'Dream',
      itineraryBiomeKeys: ['N', 'F', 'O', 'G'],
      biomeKey: 'F',
      ordinal: 2,
      previousBiomeKey: 'N',
      nextBiomeKey: 'O',
      isFirst: false,
      isLast: false,
      completion: { kind: 'deferred' },
    });
  });
});
