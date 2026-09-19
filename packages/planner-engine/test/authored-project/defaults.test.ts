import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createOccurrenceId,
  createProjectDocument,
  createProjectHistory,
  createStartingRewardAddress,
  decodeProjectDocument,
  ProjectCommandContractError,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog } from '@run-planner/engine/catalog-schema';

const fixedEntryCases = [
  ['Underworld', 2, 'G', 'G_Intro'],
  ['Underworld', 3, 'H', 'H_Intro'],
  ['Underworld', 4, 'I', 'I_Intro'],
  ['Surface', 1, 'N', 'N_Opening01'],
  ['Surface', 2, 'O', 'O_Intro'],
  ['Surface', 3, 'P', 'P_Intro'],
  ['Surface', 4, 'Q', 'Q_Intro'],
] as const;

function projectFor(routeKey: string, count: number) {
  return createProjectDocument(catalog, {
    projectId: `defaults-${routeKey}-${count}`,
    routeKey,
    configuredBiomeCount: count,
  });
}

function routeBiome(
  project: ReturnType<typeof createProjectDocument>,
  routeKey: string,
  biomeKey: string,
) {
  const biome = project.route.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`missing ${routeKey}/${biomeKey}`);
  return biome;
}

function catalogWithFStart(start: BiomeLayout['start']): Catalog {
  const layout = { ...catalog.biomeLayouts.byKey.F!, start };
  return {
    ...catalog,
    biomeLayouts: {
      values: catalog.biomeLayouts.values.map((candidate) =>
        candidate.biomeKey === 'F' ? layout : candidate,
      ),
      byKey: { ...catalog.biomeLayouts.byKey, F: layout },
    },
  };
}

describe('project defaults', () => {
  it('keeps multi-choice F unstarted until one declared entry is selected explicitly', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const project = projectFor('Underworld', 1);
    expect(routeBiome(project, 'Underworld', 'F').topology).toBeNull();
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateStart',
        biome,
        occurrenceId: createOccurrenceId('f-selected-start'),
      }),
    ).toThrow(ProjectCommandContractError);

    const selected = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: createOccurrenceId('f-selected-start'),
      gameName: 'F_Opening02',
    });
    expect(routeBiome(selected, 'Underworld', 'F').topology).toMatchObject({
      startOccurrenceId: 'f-selected-start',
      occurrences: [{ occurrenceId: 'f-selected-start', gameName: 'F_Opening02' }],
      decisions: [],
    });
  });

  it.each(fixedEntryCases)(
    '%s prefix %i initializes the declared %s entry',
    (routeKey, count, biomeKey, gameName) => {
      const plan = routeBiome(projectFor(routeKey, count), routeKey, biomeKey);
      expect(plan.topology).toMatchObject({
        startOccurrenceId: `${biomeKey}:start`,
        occurrences: [{ occurrenceId: `${biomeKey}:start`, gameName }],
        decisions: [],
        fixedRoomLinks: [],
      });
    },
  );

  it('initializes a singleton authored choice through creation, prefix growth, and clear', () => {
    const singletonCatalog = catalogWithFStart({
      kind: 'authoredChoice',
      roomGameNames: ['F_Opening03'],
    });
    const created = createProjectDocument(singletonCatalog, {
      projectId: 'singleton-created',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    expect(routeBiome(created, 'Underworld', 'F').topology).toMatchObject({
      startOccurrenceId: 'F:start',
      occurrences: [{ gameName: 'F_Opening03' }],
    });

    const empty = createProjectDocument(singletonCatalog, {
      projectId: 'singleton-prefix',
      routeKey: 'Underworld',
    });
    const grown = applyProjectCommand(empty, singletonCatalog, {
      kind: 'ConfigureRoutePrefix',
      route: { kind: 'route', routeKey: 'Underworld' },
      configuredBiomeCount: 1,
    });
    expect(routeBiome(grown, 'Underworld', 'F').topology?.startOccurrenceId).toBe('F:start');

    const authored = applyProjectCommand(created, singletonCatalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const cleared = applyProjectHistoryCommand(createProjectHistory(authored), singletonCatalog, {
      kind: 'ClearTopology',
      biome: createBiomeAddress('Underworld', 'F'),
    });
    expect(cleared.past).toEqual([authored]);
    expect(routeBiome(cleared.present, 'Underworld', 'F').topology?.startOccurrenceId).toBe(
      'F:start',
    );
    expect(undoProjectHistory(cleared).present).toEqual(authored);
  });

  it('preserves an imported null fixed entry until explicit repair', () => {
    const initialized = projectFor('Surface', 1);
    const imported = decodeProjectDocument(
      {
        ...initialized,
        route: {
          ...initialized.route,
          biomes: initialized.route.biomes.map((biome) =>
            biome.biomeKey === 'N' ? { ...biome, topology: null } : biome,
          ),
        },
      },
      catalog,
    );
    expect(routeBiome(imported, 'Surface', 'N').topology).toBeNull();
    const repaired = applyProjectCommand(imported, catalog, {
      kind: 'CreateStart',
      biome: createBiomeAddress('Surface', 'N'),
      occurrenceId: createOccurrenceId('imported-n-entry'),
    });
    expect(routeBiome(repaired, 'Surface', 'N').topology).toMatchObject({
      startOccurrenceId: 'imported-n-entry',
      occurrences: [{ occurrenceId: 'imported-n-entry', gameName: 'N_Opening01' }],
    });
  });

  it('creates a Dream-first G start with its opening reward state', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'dream-g-start',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['G', 'F'],
      configuredBiomeCount: 1,
    });
    const occurrence = routeBiome(project, 'Dream', 'G').topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === 'G:start',
    );

    expect(occurrence).toMatchObject({
      gameName: 'G_Intro',
      state: { kind: 'none' },
    });
    expect(project.route.loadout.startingReward).toBeNull();
  });

  it('uses the later F entry after explicit selection in a supplied Dream itinerary', () => {
    const biome = createBiomeAddress('Dream', 'F');
    const project = createProjectDocument(catalog, {
      projectId: 'dream-later-f-start',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['G', 'F'],
      configuredBiomeCount: 2,
    });
    expect(routeBiome(project, 'Dream', 'G').topology?.occurrences[0]).toMatchObject({
      occurrenceId: 'G:start',
      state: { kind: 'none' },
    });
    expect(project.route.loadout.startingReward).toBeNull();
    const selected = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: createOccurrenceId('dream-later-f-start'),
      gameName: 'F_Opening01',
    });
    expect(routeBiome(selected, 'Dream', 'F').topology?.occurrences[0]).toMatchObject({
      occurrenceId: 'dream-later-f-start',
      state: { kind: 'none' },
    });
  });
});
