import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createOccurrenceId,
  createProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
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
  appendNEntry,
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
  const assembly = simulateProjectAssembly(catalog, project);
  const source = createWorkspaceProjectSourceIndex(catalog, project, assembly.evaluation, (phase) =>
    encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase),
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

  it('publishes the exact terminal Hub takeover from the persisted PreHub envelope', () => {
    const project = appendNEntry(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Terminal Hub takeover N',
        projectId: 'terminal-hub-takeover-n',
      }),
    );
    const owner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    });
    const { assembly } = assemble(project, 'Surface', 'N');
    const takeover = assembly.hubTakeoverInteractionRequirements.find(
      (requirement) =>
        requirement.kind === 'hubTakeover' &&
        semanticAddressKey(requirement.owner) === semanticAddressKey(owner),
    );

    expect(takeover).toEqual({
      gameName: 'N_Hub',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      kind: 'hubTakeover',
      owner,
    });
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

  it('adapts N removal commands and its completed-Hub handoff without traversing rendered nodes', () => {
    const representative = assemble(createRepresentativeNOPQProject(), 'Surface', 'N');
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

  it('publishes complete removal requirements without normal-batch takeover replacement', () => {
    const n = assemble(createRepresentativeNOPQProject(), 'Surface', 'N').assembly;
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

    const f = assemble(createGoldenFGHIProject(), 'Underworld', 'F').assembly;
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const takeover = f.takeoverInteractionRequirements.find(
      (requirement) => semanticAddressKey(requirement.owner) === semanticAddressKey(owner),
    );
    expect(takeover).toBeUndefined();
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
    [oBiome, oOccurrenceIds.combat02],
    [qBiome, qOccurrenceIds.secondMiniboss1],
  ] as const)(
    'creates an empty %s decision at its final frontier without a standalone Preboss action',
    (biome, parent) => {
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

      expect(requirement).toBeUndefined();
      expect(frontier).toMatchObject({
        capabilities: { structural: 'createBatch' },
        kind: 'exitFrontier',
        owner,
        structural: { action: 'createBatch' },
      });
      if (frontier?.kind !== 'exitFrontier') {
        throw new Error(biome.biomeKey + ' final decision frontier is missing');
      }
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
});
