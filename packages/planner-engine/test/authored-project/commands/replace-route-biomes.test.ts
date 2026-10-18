import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createRouteAddress,
  projectCommandAuthoringAddresses,
  ProjectCommandContractError,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import { loadUnderworldFGHCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNResourcesCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';

function cleared(project: ProjectDocument): ProjectDocument {
  return project.route.biomes.reduce(
    (document, biome) =>
      applyProjectCommand(document, catalog, {
        kind: 'ClearTopology',
        biome: createBiomeAddress(project.route.routeKey, biome.biomeKey),
      }),
    project,
  );
}

function replaceWith(project: ProjectDocument, source: ProjectDocument): ProjectCommand {
  return {
    kind: 'ReplaceRouteBiomes',
    route: createRouteAddress(project.route.routeKey),
    startingReward: source.route.loadout.startingReward,
    biomes: source.route.biomes,
  };
}

describe('ReplaceRouteBiomes', () => {
  it('installs generated biome plans through edit settlement and keeps the loadout', () => {
    const source = loadUnderworldFGHCheckpoint();
    const target = cleared(source);
    const command = replaceWith(target, source);
    const settled = settleProjectEdit({
      catalog,
      before: simulateProjectAssembly(catalog, target),
      command,
      evaluate: (project) => simulateProjectAssembly(catalog, project),
    });
    expect(settled.fault).toBeUndefined();
    expect(settled.assembly.project.route.biomes).toEqual(source.route.biomes);
    expect(settled.assembly.project.route.loadout).toEqual({
      ...target.route.loadout,
      startingReward: source.route.loadout.startingReward,
    });
    expect(settled.assembly.evaluation.status).toBe(
      simulateProjectAssembly(catalog, source).evaluation.status,
    );
    expect(projectCommandAuthoringAddresses(command, target)).toEqual([
      createRouteAddress(target.route.routeKey),
    ]);
  });

  it('resets the route resource placements', () => {
    const source = loadSurfaceNResourcesCheckpoint();
    expect(Object.values(source.route.resourcePlacements).some(Boolean)).toBe(true);
    const replaced = applyProjectCommand(source, catalog, replaceWith(source, source));
    expect(replaced.route.resourcePlacements).toEqual({
      Pickaxe: null,
      Exorcism: null,
      Shovel: null,
      Fishing: null,
    });
    expect(replaced.route.biomes).toEqual(source.route.biomes);
  });

  it('refuses plans that are not an itinerary prefix in order', () => {
    const source = loadUnderworldFGHCheckpoint();
    const [f, g] = source.route.biomes;
    const route = createRouteAddress(source.route.routeKey);
    for (const biomes of [[g!, f!], [g!]])
      expect(() =>
        applyProjectCommand(source, catalog, {
          kind: 'ReplaceRouteBiomes',
          route,
          startingReward: source.route.loadout.startingReward,
          biomes,
        }),
      ).toThrow(ProjectCommandContractError);
  });

  it('refuses a starting reward the run-start binding does not allow', () => {
    const source = loadUnderworldFGHCheckpoint();
    expect(() =>
      applyProjectCommand(source, catalog, {
        ...replaceWith(source, source),
        startingReward: { rewardType: 'Story' },
      } as ProjectCommand),
    ).toThrow(ProjectCommandContractError);
  });

  it('refuses a plan the strict project decode rejects', () => {
    const source = loadUnderworldFGHCheckpoint();
    const [f] = source.route.biomes;
    const broken = { ...f!, state: { ...f!.state, unknownField: true } };
    expect(() =>
      applyProjectCommand(source, catalog, {
        kind: 'ReplaceRouteBiomes',
        route: createRouteAddress(source.route.routeKey),
        startingReward: source.route.loadout.startingReward,
        biomes: [broken],
      }),
    ).toThrow(ProjectCommandContractError);
  });
});
