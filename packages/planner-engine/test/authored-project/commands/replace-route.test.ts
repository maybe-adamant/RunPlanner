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
import { loadSurfaceNOProject } from '@run-planner/test-fixtures/surface';

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

function replaceWith(
  project: ProjectDocument,
  source: ProjectDocument,
  biomes = source.route.biomes,
): Extract<ProjectCommand, { readonly kind: 'ReplaceRoute' }> {
  const { runModifiers: _runModifiers, ...loadout } = source.route.loadout;
  void _runModifiers;
  return {
    kind: 'ReplaceRoute',
    route: createRouteAddress(project.route.routeKey),
    loadout,
    biomes,
  };
}

function withStartPoint(project: ProjectDocument, biomeKey: string): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceRunModifiers',
    route: createRouteAddress(project.route.routeKey),
    value: { startPoint: { biomeKey, point: 'opening' } },
  });
}

describe('ReplaceRoute', () => {
  it('installs a generated route through edit settlement', () => {
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
    expect(settled.assembly.project.route.loadout).toEqual(source.route.loadout);
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
  });

  it('carries the run modifiers and refuses another route', () => {
    const source = loadUnderworldFGHCheckpoint();
    const practice = withStartPoint(source, 'G');
    const replaced = applyProjectCommand(practice, catalog, replaceWith(practice, source));
    expect(replaced.route.loadout.runModifiers).toEqual({
      startPoint: { biomeKey: 'G', point: 'opening' },
    });
    const surface = loadSurfaceNOProject();
    expect(() => applyProjectCommand(source, catalog, replaceWith(surface, surface))).toThrow(
      ProjectCommandContractError,
    );
  });

  it('refuses biomes out of itinerary order and a disallowed starting reward', () => {
    const source = loadUnderworldFGHCheckpoint();
    const [f, g] = source.route.biomes;
    for (const biomes of [[g!, f!], [g!]])
      expect(() =>
        applyProjectCommand(source, catalog, replaceWith(source, source, biomes)),
      ).toThrow(ProjectCommandContractError);
    const command = replaceWith(source, source);
    expect(() =>
      applyProjectCommand(source, catalog, {
        ...command,
        loadout: { ...command.loadout, startingReward: { rewardType: 'Story' } },
      }),
    ).toThrow(ProjectCommandContractError);
  });

  it('refuses a plan the strict project decode rejects', () => {
    const source = loadUnderworldFGHCheckpoint();
    const [f] = source.route.biomes;
    const broken = { ...f!, state: { ...f!.state, unknownField: true } };
    expect(() =>
      applyProjectCommand(source, catalog, replaceWith(source, source, [broken])),
    ).toThrow(ProjectCommandContractError);
  });
});
