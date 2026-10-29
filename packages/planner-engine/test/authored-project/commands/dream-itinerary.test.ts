import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createProjectDocument,
  dreamItineraryReplacementDroppedBiomeKeys,
  ProjectCommandContractError,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadDreamMixedHandoffCheckpoint } from '@run-planner/test-fixtures/checkpoints/dream';

const route = { kind: 'route', routeKey: 'Dream' } as const;

function repick(project: ProjectDocument, itineraryBiomeKeys: readonly string[]) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceDreamItinerary',
    route,
    itineraryBiomeKeys,
  });
}

/** Q/F/N authored of Q/F/N/H, with route-level settings in kept and dropped biomes. */
function withRouteSettings(): ProjectDocument {
  const project = loadDreamMixedHandoffCheckpoint();
  const [q, , n] = project.route.biomes;
  const occurrenceIn = (biome: typeof q) => biome!.topology!.occurrences[0]!.occurrenceId;
  return Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      practiceStart: { biomeKey: 'N', point: 'opening' },
      resourcePlacements: {
        ...project.route.resourcePlacements,
        Pickaxe: { biomeKey: 'Q', occurrenceId: occurrenceIn(q) },
        Fishing: { biomeKey: 'N', occurrenceId: occurrenceIn(n) },
      },
      draft: {
        ...project.route.draft,
        storyNpcByBiome: { F: 'Arachne', N: 'Medea', H: 'Echo' },
        fieldNpcsByBiome: { Q: [], N: ['Artemis'] },
        rackKeepsakeByBiome: { F: 'DoorHealReserveKeepsake', H: 'BossPreDamageKeepsake' },
        godBoonsByBiome: { Q: 7, N: 2 },
        godKeys: ['Zeus'],
        basketByGiver: { Zeus: ['ZeusWeaponBoon'] },
      },
    }),
  }) as ProjectDocument;
}

describe('ReplaceDreamItinerary', () => {
  it('keeps the matching prefix and replaces every later biome with a fresh default', () => {
    const project = withRouteSettings();
    const repicked = repick(project, ['Q', 'F', 'O', 'H']);
    expect(repicked.route.itineraryBiomeKeys).toEqual(['Q', 'F', 'O', 'H']);
    expect(repicked.route.biomes.map((biome) => biome.biomeKey)).toEqual(['Q', 'F', 'O']);
    expect(repicked.route.biomes[0]).toEqual(project.route.biomes[0]);
    expect(repicked.route.biomes[1]).toEqual(project.route.biomes[1]);
    // The new tail biome is exactly what a new project's biome would be.
    const fresh = createProjectDocument(catalog, {
      projectId: 'fresh',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['Q', 'F', 'O', 'H'],
      configuredBiomeCount: 3,
    });
    expect(repicked.route.biomes[2]).toEqual(fresh.route.biomes[2]);
  });

  it('drops route-level settings of every dropped position and keeps the rest', () => {
    const project = withRouteSettings();
    const { route: repicked } = repick(project, ['Q', 'F', 'O', 'H']);
    expect(repicked.practiceStart).toBeUndefined();
    expect(repicked.resourcePlacements.Pickaxe).toEqual(project.route.resourcePlacements.Pickaxe);
    expect(repicked.resourcePlacements.Fishing).toBeNull();
    // H stays at the same position but follows a dropped biome, so it is dropped too.
    expect(repicked.draft.storyNpcByBiome).toEqual({ F: 'Arachne' });
    expect(repicked.draft.fieldNpcsByBiome).toEqual({ Q: [] });
    expect(repicked.draft.rackKeepsakeByBiome).toEqual({ F: 'DoorHealReserveKeepsake' });
    expect(repicked.draft.godBoonsByBiome).toEqual({ Q: 7 });
    expect(repicked.draft.basketByGiver).toEqual(project.route.draft.basketByGiver);
  });

  it('keeps a Practice start in a kept biome', () => {
    const project = withRouteSettings();
    const startingInF = Object.freeze({
      ...project,
      route: Object.freeze({
        ...project.route,
        practiceStart: { biomeKey: 'F', point: 'opening' },
      }),
    }) as ProjectDocument;
    expect(repick(startingInF, ['Q', 'F', 'O', 'H']).route.practiceStart).toEqual({
      biomeKey: 'F',
      point: 'opening',
    });
  });

  it('starts over from one fresh biome when the first biome changes', () => {
    const repicked = repick(withRouteSettings(), ['G', 'F', 'N', 'H']);
    expect(repicked.route.biomes.map((biome) => biome.biomeKey)).toEqual(['G', 'F', 'N']);
    expect(Object.values(repicked.route.resourcePlacements)).toEqual([null, null, null, null]);
    expect(repicked.route.draft.storyNpcByBiome).toEqual({});
    expect(repicked.route.practiceStart).toBeUndefined();
  });

  it('keeps a plan with no configured biome empty', () => {
    const empty = createProjectDocument(catalog, {
      projectId: 'empty',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
      configuredBiomeCount: 0,
    });
    const repicked = repick(empty, ['G', 'F', 'N', 'H']);
    expect(repicked.route.itineraryBiomeKeys).toEqual(['G', 'F', 'N', 'H']);
    expect(repicked.route.biomes).toEqual([]);
  });

  it('is a no-op for the same itinerary and refuses an illegal one or a fixed route', () => {
    const project = loadDreamMixedHandoffCheckpoint();
    expect(repick(project, project.route.itineraryBiomeKeys)).toBe(project);
    // P naturally follows O.
    expect(() => repick(project, ['Q', 'F', 'O', 'P'])).toThrow(ProjectCommandContractError);
    expect(() => repick(project, ['Q', 'F', 'O'])).toThrow(ProjectCommandContractError);
    const underworld = createProjectDocument(catalog, {
      projectId: 'underworld',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    expect(() =>
      applyProjectCommand(underworld, catalog, {
        kind: 'ReplaceDreamItinerary',
        route: { kind: 'route', routeKey: 'Underworld' },
        itineraryBiomeKeys: ['F', 'G', 'H', 'I'],
      }),
    ).toThrow(/fixed route order/);
  });
});

describe('dreamItineraryReplacementDroppedBiomeKeys', () => {
  const dropped = (project: ProjectDocument, itineraryBiomeKeys: readonly string[]) =>
    dreamItineraryReplacementDroppedBiomeKeys(project.route, itineraryBiomeKeys);

  it('drops nothing for the same itinerary', () => {
    const project = withRouteSettings();
    expect(dropped(project, project.route.itineraryBiomeKeys)).toEqual([]);
  });

  it('names dropped biomes with an authored plan', () => {
    const project = loadDreamMixedHandoffCheckpoint();
    expect(dropped(project, ['Q', 'F', 'O', 'H'])).toEqual(['N']);
  });

  it('names a dropped biome that only has a route-level setting', () => {
    const project = loadDreamMixedHandoffCheckpoint();
    const withRack = Object.freeze({
      ...project,
      route: Object.freeze({
        ...project.route,
        draft: { ...project.route.draft, rackKeepsakeByBiome: { H: 'BossPreDamageKeepsake' } },
      }),
    }) as ProjectDocument;
    expect(dropped(withRack, ['Q', 'F', 'O', 'H'])).toEqual(['N', 'H']);
  });

  it('names every authored or configured biome when the first biome changes', () => {
    expect(dropped(withRouteSettings(), ['G', 'F', 'N', 'H'])).toEqual(['Q', 'F', 'N', 'H']);
    expect(dropped(loadDreamMixedHandoffCheckpoint(), ['G', 'F', 'N', 'H'])).toEqual([
      'Q',
      'F',
      'N',
    ]);
  });
});
