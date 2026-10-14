import { catalog } from '@run-planner/hades2-catalog';
import {
  createExitDecisionAddress,
  createProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { goldenFBiome } from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNCompleteHubFrontierProject,
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  createWorkspaceProjectSourceIndex,
  type WorkspaceBiomeSource,
} from '@planner/projections/structured-workspace/source-index';
import { assembleWorkspaceTopologyInteractions } from '@planner/projections/structured-workspace/assembly/topology-interaction-assembly';

function biomeSource(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
): WorkspaceBiomeSource {
  const assembly = simulateProjectAssembly(catalog, project);
  const source = createWorkspaceProjectSourceIndex(catalog, project, assembly.evaluation, (phase) =>
    encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase),
  ).route?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function assemble(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const source = biomeSource(project, routeKey, biomeKey);
  return {
    assembly: assembleWorkspaceTopologyInteractions({ source }),
    source,
  };
}

describe('structured workspace topology interaction assembly', () => {
  it('returns the exact topology-free start requirement without creating removal packages', () => {
    const project = createProjectDocument(catalog, {
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
      projectId: 'topology-free-f',
    });
    const { assembly } = assemble(project, 'Underworld', 'F');

    const start = assembly.startInteractionRequirements[0];
    expect(start).toEqual({ kind: 'start', owner: goldenFBiome });
    expect(assembly.topologyRemovalInteractionRequirements).toHaveLength(0);
  });

  it('adapts N removal commands without a completed-Hub handoff creation step', () => {
    const representative = assemble(loadSurfaceNOPQProject(), 'Surface', 'N');
    const removals = representative.assembly.topologyRemovalInteractionRequirements[0]?.removals;
    const openingDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });

    expect(removals?.some((removal) => removal.command.kind === 'ClearTopology')).toBe(true);
    expect(
      removals?.some(
        (removal) =>
          removal.command.kind === 'RemoveExitDecision' &&
          semanticAddressKey(removal.owner) === semanticAddressKey(openingDecision),
      ),
    ).toBe(true);

    // The completed-Hub exit has no removal of its own.
    const handoff = semanticAddressKey(
      createExitDecisionAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }),
    );
    for (const project of [loadSurfaceNCompleteHubFrontierProject(), loadSurfaceNOPQProject()]) {
      const completed = assemble(project, 'Surface', 'N').assembly;
      expect(
        completed.topologyRemovalInteractionRequirements[0]?.removals.some(
          (removal) => semanticAddressKey(removal.owner) === handoff,
        ),
      ).toBe(false);
    }
  });

  it('publishes complete removal requirements', () => {
    const n = assemble(loadSurfaceNOPQProject(), 'Surface', 'N').assembly;
    const removals = n.topologyRemovalInteractionRequirements[0]?.removals;
    const openingDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });
    expect(removals?.find((removal) => removal.command.kind === 'ClearTopology')).toMatchObject({
      command: { biome: nBiome, kind: 'ClearTopology' },
      owner: nBiome,
    });
    expect(
      removals?.find(
        (removal) => semanticAddressKey(removal.owner) === semanticAddressKey(openingDecision),
      ),
    ).toMatchObject({
      command: { decision: openingDecision, kind: 'RemoveExitDecision' },
    });
  });
});
