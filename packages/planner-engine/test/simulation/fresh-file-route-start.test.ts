import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createProjectDocument,
  deriveRouteLoadout,
  resolveRoutePosition,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createRewardHistoryState } from '@run-planner/engine/reward-kernel';
import {
  assembleExecutionProduct,
  ExecutionCompilerError,
} from '@run-planner/engine/execution-plan';
import {
  createArcanaFearState,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { loadUnderworldGeneratedCompositionCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createFreshFileGeneratedComposition } from '@run-planner/test-fixtures/fresh-file';
import { createRouteStartHistoryView } from '../../src/simulation/history/fold';
import { createInitialSimulationState } from '../../src/simulation/state/construction';

function freshProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'fresh-route-start',
    routeKey: 'FreshFile',
    configuredBiomeCount: 1,
  });
}

function routeStartState(project: ProjectDocument) {
  const { route } = project;
  return createInitialSimulationState(
    catalog,
    route.loadout,
    route.loadout.startingKeepsakeKey,
    createArcanaFearState(catalog, route.loadout),
    {
      routePosition: resolveRoutePosition(catalog, route, route.itineraryBiomeKeys[0]!),
      historyView: createRouteStartHistoryView(),
    },
  );
}

describe('Fresh File route start', () => {
  it('continues past the empty opening without a starting-reward finding', () => {
    const evaluation = simulateProject(catalog, freshProject());
    expect(evaluation.findings.map((finding) => finding.code)).toEqual(['continuationMissing']);
    expect(evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      blockedAfter: { kind: 'exitDecision', routeKey: 'FreshFile', biomeKey: 'F' },
    });
  });

  it('starts with the aspectless Staff, no keepsake, no Arcana and a closed save history', () => {
    const project = freshProject();
    const state = routeStartState(project);
    expect(state.equipment).toEqual({ weaponKey: 'WeaponStaffSwing', aspectKey: null });
    expect(state.keepsakes.currentKey).toBeNull();
    expect(state.keepsakes.history).toEqual([]);
    expect(state.arcanaFear.arcana.active).toEqual([]);
    expect(state.rewardHistory).toEqual(createRewardHistoryState(catalog.rewards, 'closed'));
    expect(deriveRouteLoadout(catalog, project.route.loadout)).toMatchObject({
      activeArcanaKeys: [],
      automaticArcanaKeys: [],
      fearTotal: 0,
    });
  });

  it('keeps the mature route start on its authored equipment and mature save history', () => {
    const mature = createProjectDocument(catalog, { projectId: 'mature', routeKey: 'Underworld' });
    const state = routeStartState(mature);
    expect(state.equipment).toEqual({
      weaponKey: mature.route.loadout.weaponKey,
      aspectKey: mature.route.loadout.aspectKey,
    });
    expect(state.keepsakes.currentKey).toBe(mature.route.loadout.startingKeepsakeKey);
    expect(state.rewardHistory).toEqual(createRewardHistoryState(catalog.rewards, 'mature'));
  });

  it('reports a retained generated customization instead of generating from it', () => {
    const project = createFreshFileGeneratedComposition();
    const customized = project.route.biomes[0]!.topology!.occurrences.find(
      (occurrence) => occurrence.encounters.customizationByPhase !== undefined,
    )!;
    const evaluation = simulateProject(catalog, project);
    expect(evaluation.findings).toEqual([
      expect.objectContaining({
        code: 'encounterCustomizationUnavailable',
        origin: expect.objectContaining({
          kind: 'encounterPhase',
          owner: { kind: 'occurrence', occurrenceId: customized.occurrenceId },
        }),
      }),
    ]);
    expect(
      project.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === customized.occurrenceId,
      )?.encounters.customizationByPhase,
    ).toEqual(customized.encounters.customizationByPhase);
    const mature = simulateProject(catalog, loadUnderworldGeneratedCompositionCheckpoint());
    expect(mature.findings.map((finding) => finding.code)).not.toContain(
      'encounterCustomizationUnavailable',
    );
  });

  it('refuses to assemble a Fresh File execution product', () => {
    const assembly = simulateProjectAssembly(catalog, freshProject());
    let error: unknown;
    try {
      assembleExecutionProduct({ assembly, catalog });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ExecutionCompilerError);
    expect(error).toMatchObject({ code: 'unsupportedRoute' });
  });
});
