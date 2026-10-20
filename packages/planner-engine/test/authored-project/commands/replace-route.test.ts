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
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNResourcesCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';

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

function withPractice(project: ProjectDocument, biomeKey: string): ProjectDocument {
  const route = createRouteAddress(project.route.routeKey);
  const practice = applyProjectCommand(project, catalog, {
    kind: 'ReplacePracticeStart',
    route,
    startPoint: { biomeKey, point: 'opening' },
  });
  const modified = applyProjectCommand(practice, catalog, {
    kind: 'ReplaceRunModifiers',
    route,
    value: { enemyGoldDropChance: 40 },
  });
  return applyProjectCommand(modified, catalog, {
    kind: 'ReplaceDraftSpec',
    route,
    draft: { ...modified.route.draft, godKeys: ['Zeus'], seed: 7 },
  });
}

describe('ReplaceRoute', () => {
  it('installs a generated route through edit settlement', () => {
    const source = loadUnderworldFGHICheckpoint();
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
    const placed = loadSurfaceNResourcesCheckpoint();
    expect(Object.values(placed.route.resourcePlacements).some(Boolean)).toBe(true);
    const replaced = applyProjectCommand(
      placed,
      catalog,
      replaceWith(placed, loadSurfaceNOPQProject()),
    );
    expect(replaced.route.resourcePlacements).toEqual({
      Pickaxe: null,
      Exorcism: null,
      Shovel: null,
      Fishing: null,
    });
  });

  it('carries the run modifiers, Practice start and draft spec, and refuses another route', () => {
    const source = loadUnderworldFGHICheckpoint();
    const practice = withPractice(source, 'G');
    const replaced = applyProjectCommand(practice, catalog, replaceWith(practice, source));
    expect(replaced.route.loadout.runModifiers).toEqual({ enemyGoldDropChance: 40 });
    expect(replaced.route.practiceStart).toEqual({ biomeKey: 'G', point: 'opening' });
    expect(replaced.route.draft).toBe(practice.route.draft);
    const surface = loadSurfaceNOPQProject();
    expect(() => applyProjectCommand(source, catalog, replaceWith(surface, surface))).toThrow(
      ProjectCommandContractError,
    );
  });

  it('installs a planned prefix of the itinerary', () => {
    const source = loadUnderworldFGHICheckpoint();
    const [f, g] = source.route.biomes;
    const replaced = applyProjectCommand(source, catalog, replaceWith(source, source, [f!, g!]));
    expect(replaced.route.biomes).toEqual([f, g]);
    expect(replaced.route.itineraryBiomeKeys).toEqual(source.route.itineraryBiomeKeys);
  });

  it('refuses an empty, overlong or reordered plan and a disallowed starting reward', () => {
    const source = loadUnderworldFGHICheckpoint();
    const [f, g, h, i] = source.route.biomes;
    for (const biomes of [[], [g!, f!, h!, i!], [g!], [f!, g!, h!, i!, i!]])
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
    const source = loadUnderworldFGHICheckpoint();
    const [f, ...rest] = source.route.biomes;
    const broken = { ...f!, state: { ...f!.state, unknownField: true } };
    expect(() =>
      applyProjectCommand(source, catalog, replaceWith(source, source, [broken, ...rest])),
    ).toThrow(ProjectCommandContractError);
  });
});
