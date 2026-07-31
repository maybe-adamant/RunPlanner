import { catalog } from '@run-planner/hades2-catalog';
import {
  createExitDecisionAddress,
  createProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '../../../../test/fixtures/underworldProject';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceIds,
} from '../../../../test/fixtures/surfaceProject';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from '../source-index';
import { assembleWorkspaceTopologyInteractions } from './topology-interaction-assembly';

function biomeSource(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
): WorkspaceBiomeSource {
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    simulateProject(catalog, project),
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function assemble(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const source = biomeSource(project, routeKey, biomeKey);
  return {
    assembly: assembleWorkspaceTopologyInteractions({ catalog, source }),
    source,
  };
}

describe('structured workspace topology interaction assembly', () => {
  it('returns the exact topology-free start requirement without creating removal or takeover packages', () => {
    const project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      name: 'Topology-free F',
      projectId: 'topology-free-f',
    });
    const { assembly } = assemble(project, 'Underworld', 'F');

    const start = assembly.startInteractionRequirements[0];
    expect(start?.kind).toBe('start');
    if (start?.start.kind !== 'choice') throw new Error('F authored-choice start is missing');
    expect(start.start.gameNames).toContain('F_Opening01');
    expect(assembly.topologyRemovalInteractionRequirements).toHaveLength(0);
    expect(assembly.takeoverInteractionRequirements).toHaveLength(0);
    expect(assembly.frontierInteractionRequirements).toHaveLength(0);
  });

  it('preserves generated takeover repair packages alongside their authored physical exits', () => {
    const { assembly } = assemble(createGoldenFGHIProject(catalog), 'Underworld', 'F');
    const repair = assembly.takeoverInteractionRequirements.find(
      (requirement) => requirement.presentation === 'repair',
    );

    expect(repair).toBeDefined();
    expect(repair).toMatchObject({ action: 'reconcile', kind: 'takeoverBatch' });
    if (repair?.presentation !== 'repair') throw new Error('takeover repair is missing');
    expect(repair.requiredExitKeys.length).toBeGreaterThan(0);
    expect(repair.existingTargets.length).toBeGreaterThan(0);
  });

  it('adapts N removal impacts and its completed-Hub handoff without traversing rendered nodes', () => {
    const representative = assemble(createRepresentativeNOPQProject(), 'Surface', 'N');
    const removals = representative.assembly.topologyRemovalInteractionRequirements[0]?.removals;
    const linked = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });

    expect(removals?.some((removal) => removal.action === 'clearTopology')).toBe(true);
    expect(
      removals?.some(
        (removal) =>
          removal.action === 'removeExitDecision' &&
          semanticAddressKey(removal.owner) === semanticAddressKey(linked),
      ),
    ).toBe(true);

    const completedProject = appendCompleteN(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Completed N',
        projectId: 'completed-n-topology-assembly',
      }),
      { includePreboss: false },
    );
    const completed = assemble(completedProject, 'Surface', 'N').assembly;
    const handoff = completed.takeoverInteractionRequirements.find(
      (requirement) => requirement.presentation === 'completedHubHandoff',
    );
    expect(handoff).toMatchObject({
      action: 'create',
      kind: 'takeoverBatch',
      presentation: 'completedHubHandoff',
    });
  });
});
