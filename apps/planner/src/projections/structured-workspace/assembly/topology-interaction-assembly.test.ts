import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createOccurrenceId,
  createProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures';
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
    const { assembly } = assemble(createGoldenFGHIProject(), 'Underworld', 'F');
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

  it('publishes exact engine-owned removal and takeover-replacement impacts', () => {
    const n = assemble(createRepresentativeNOPQProject(), 'Surface', 'N').assembly;
    const removals = n.topologyRemovalInteractionRequirements[0]?.removals;
    const linked = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });
    const preboss = createExitDecisionAddress(nBiome, {
      decisionKey: 'hub',
      kind: 'hubDecision',
    });
    expect(removals?.find((removal) => removal.action === 'clearTopology')).toMatchObject({
      command: { biome: nBiome, kind: 'ClearTopology' },
      impact: {
        removedDecisionOwners: expect.arrayContaining([preboss]),
        removedHubDecisionKeys: ['hub'],
      },
      owner: nBiome,
    });
    expect(
      removals?.find((removal) => semanticAddressKey(removal.owner) === semanticAddressKey(linked)),
    ).toMatchObject({
      command: { decision: linked, kind: 'RemoveExitDecision' },
      impact: {
        removedHubDecisionKeys: ['hub'],
        removedOccurrenceIds: expect.arrayContaining([
          nOccurrenceIds.preHub,
          nOccurrenceIds.preboss,
        ]),
      },
    });

    const f = assemble(createGoldenFGHIProject(), 'Underworld', 'F').assembly;
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const replacement = f.takeoverInteractionRequirements.find(
      (requirement) => semanticAddressKey(requirement.owner) === semanticAddressKey(owner),
    );
    expect(replacement).toMatchObject({
      action: 'replace',
      impact: {
        command: 'ReplaceWithTakeoverBatch',
        owner,
        replacedOccurrenceIds: [goldenFOccurrenceId(1, 1)],
      },
      owner,
      presentation: 'candidate',
    });
    if (
      replacement?.presentation !== 'candidate' ||
      replacement.action !== 'replace' ||
      replacement.impact === undefined
    )
      throw new Error('F takeover replacement impact is missing');
    expect(replacement.impact.removedDecisionOwners).toContainEqual(
      createExitDecisionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(1, 1),
      }),
    );
    expect(replacement.impact.removedOccurrenceIds).toContain(goldenFOccurrenceId(2, 1));
  });

  it.each([
    {
      biome: goldenFBiome,
      gameName: 'F_PreBoss01',
      project: createGoldenFGHIProject,
      routeKey: 'Underworld',
      source: { kind: 'occurrence' as const, occurrenceId: goldenFOccurrenceId(10, 1) },
    },
    {
      biome: goldenGBiome,
      gameName: 'G_PreBoss01',
      project: createGoldenFGHIProject,
      routeKey: 'Underworld',
      source: { kind: 'occurrence' as const, occurrenceId: goldenGOccurrenceId(7, 1) },
    },
    {
      biome: goldenHBiome,
      gameName: 'H_PreBoss01',
      project: createGoldenFGHIProject,
      routeKey: 'Underworld',
      source: {
        kind: 'occurrence' as const,
        occurrenceId: createOccurrenceId('golden-h-combat05'),
      },
    },
    {
      biome: nBiome,
      gameName: 'N_PreBoss01',
      project: createRepresentativeNOPQProject,
      routeKey: 'Surface',
      source: { decisionKey: 'hub', kind: 'hubDecision' as const },
    },
    {
      biome: oBiome,
      gameName: 'O_PreBoss01',
      project: createRepresentativeNOPQProject,
      routeKey: 'Surface',
      source: { kind: 'occurrence' as const, occurrenceId: oOccurrenceIds.combat02 },
    },
    {
      biome: pBiome,
      gameName: 'P_PreBoss01',
      project: createRepresentativeNOPQProject,
      routeKey: 'Surface',
      source: {
        kind: 'occurrence' as const,
        occurrenceId: pOccurrenceId('P_Combat12', 8, 1),
      },
    },
    {
      biome: qBiome,
      gameName: 'Q_PreBoss01',
      project: createRepresentativeNOPQProject,
      routeKey: 'Surface',
      source: { kind: 'occurrence' as const, occurrenceId: qOccurrenceIds.secondMiniboss1 },
    },
  ])(
    'publishes the $gameName takeover repair requirement at its exact $biome.biomeKey owner',
    ({ biome, gameName, project, routeKey, source }) => {
      const owner = createExitDecisionAddress(biome, source);
      const { assembly } = assemble(project(), routeKey, biome.biomeKey);
      const requirement = assembly.takeoverInteractionRequirements.find(
        (candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(owner),
      );

      expect(requirement).toMatchObject({
        action: 'reconcile',
        gameName,
        kind: 'takeoverBatch',
        owner,
        presentation: 'repair',
      });
      if (requirement?.presentation !== 'repair') {
        throw new Error(biome.biomeKey + ' authored takeover repair requirement is missing');
      }
      expect(requirement.requiredExitKeys).not.toHaveLength(0);
    },
  );

  it.each([
    [oBiome, oOccurrenceIds.combat02, 'O_PreBoss01'],
    [qBiome, qOccurrenceIds.secondMiniboss1, 'Q_PreBoss01'],
  ] as const)(
    'classifies %s fixed-width-one Preboss creation at its final frontier only',
    (biome, parent, gameName) => {
      const owner = createExitDecisionAddress(biome, {
        kind: 'occurrence',
        occurrenceId: parent,
      });
      const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
        kind: 'RemoveExitDecision',
        decision: owner,
      });
      const { assembly } = assemble(project, 'Surface', biome.biomeKey);
      const requirement = assembly.takeoverInteractionRequirements.find(
        (candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(owner),
      );
      const frontier = assembly.frontierInteractionRequirements.find(
        (candidate) =>
          candidate.kind === 'exitFrontier' &&
          semanticAddressKey(candidate.owner) === semanticAddressKey(owner),
      );

      expect(requirement).toMatchObject({
        action: 'create',
        gameName,
        kind: 'takeoverBatch',
        owner,
        presentation: 'fixedWidthOneTakeover',
      });
      expect(frontier).toMatchObject({
        capabilities: { takeover: true },
        kind: 'exitFrontier',
        owner,
      });
      if (frontier?.kind !== 'exitFrontier') {
        throw new Error(biome.biomeKey + ' final fixed-width-one frontier is missing');
      }
      expect(frontier.structural).toBeUndefined();
    },
  );

  it('keeps O’s pre-final frontier ordinary instead of classifying it as fixed-width-one', () => {
    const owner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.story,
    });
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: owner,
    });
    const { assembly } = assemble(project, 'Surface', 'O');
    const requirement = assembly.takeoverInteractionRequirements.find(
      (candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(owner),
    );
    const frontier = assembly.frontierInteractionRequirements.find(
      (candidate) =>
        candidate.kind === 'exitFrontier' &&
        semanticAddressKey(candidate.owner) === semanticAddressKey(owner),
    );

    expect(requirement).toBeUndefined();
    expect(frontier).toMatchObject({
      capabilities: { structural: 'createBatch' },
      kind: 'exitFrontier',
      owner,
      structural: { action: 'createBatch' },
    });
  });

  it.each([
    ['F', createGoldenFGHIProject, 'Underworld'],
    ['G', createGoldenFGHIProject, 'Underworld'],
    ['H', createGoldenFGHIProject, 'Underworld'],
    ['I', createGoldenFGHIProject, 'Underworld'],
    ['N', createRepresentativeNOPQProject, 'Surface'],
    ['P', createRepresentativeNOPQProject, 'Surface'],
  ] as const)(
    'does not misclassify %s as a fixed-width-one takeover',
    (biomeKey, project, routeKey) => {
      const { assembly } = assemble(project(), routeKey, biomeKey);

      expect(
        assembly.takeoverInteractionRequirements.some(
          (requirement) => requirement.presentation === 'fixedWidthOneTakeover',
        ),
      ).toBe(false);
    },
  );
});
