import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeFieldAddress,
  createOccurrenceId,
  createProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  appendCompleteN,
  createGoldenFGHIProject,
  createRepresentativeNOPQProject,
  goldenFBiome,
  goldenIBiome,
  nBiome,
  nOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures';
import { assembleWorkspaceBiomeSemantics } from './biome-semantic-assembly';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from '../source-index';

function biomeSource(
  project: ProjectDocument,
  routeKey = 'Surface',
  biomeKey = 'N',
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

function emptyNProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    configuredBiomeCounts: { Surface: 1 },
    name: 'Empty N semantic assembly',
    projectId: 'empty-n-semantic-assembly',
  });
}

function withBelowDepthAnomalyTakeovers(source: WorkspaceBiomeSource): WorkspaceBiomeSource {
  const evaluation = source.evaluation;
  if (evaluation === undefined || !('roomGeneration' in evaluation)) {
    throw new Error('Anomaly workspace witness requires evaluated generation.');
  }
  return Object.freeze({
    ...source,
    evaluation: Object.freeze({
      ...evaluation,
      roomGeneration: Object.freeze({
        ...evaluation.roomGeneration,
        ordinary: Object.freeze({
          ...evaluation.roomGeneration.ordinary,
          anomalyTakeovers: Object.freeze(
            evaluation.roomGeneration.ordinary.anomalyTakeovers.map((support) =>
              Object.freeze({
                ...support,
                selectedPossible: false,
                sourceBiomeDepthCache: support.minimumBiomeDepthCache - 1,
                failedConditions: Object.freeze(['minimumBiomeDepthCache'] as const),
              }),
            ),
          ),
        }),
      }),
    }),
  });
}

function indexOfNode(
  assembly: ReturnType<typeof assembleWorkspaceBiomeSemantics>,
  predicate: (node: (typeof assembly.nodes)[number]) => boolean,
  message: string,
): number {
  const index = assembly.nodes.findIndex(predicate);
  if (index < 0) throw new Error(message);
  return index;
}

describe('structured workspace biome semantic assembly', () => {
  it('publishes only engine-available Anomaly takeovers while retaining authored Anomaly controls', () => {
    const project = createGoldenFGHIProject();
    const source = biomeSource(project, 'Underworld', 'G');
    const available = assembleWorkspaceBiomeSemantics(catalog, source);
    const decision = available.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof available.nodes)[number],
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' }
      > =>
        (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') &&
        node.targets.some((target) => target.anomalyTakeover !== undefined),
    );
    if (decision === undefined) throw new Error('Anomaly-capable G target is missing');
    const target = decision.targets.find((candidate) => candidate.anomalyTakeover !== undefined);
    if (target === undefined) throw new Error('Anomaly takeover control is missing');

    const unavailable = assembleWorkspaceBiomeSemantics(
      catalog,
      withBelowDepthAnomalyTakeovers(source),
    );
    const unavailableDecision = unavailable.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof unavailable.nodes)[number],
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' }
      > =>
        (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') && node.key === decision.key,
    );
    expect(
      unavailableDecision?.targets.find((candidate) => candidate.exitKey === target.exitKey),
    ).not.toHaveProperty('anomalyTakeover');

    const takenOver = applyProjectCommand(project, catalog, {
      kind: 'SwitchTargetToAnomaly',
      target: target.marker.address as Extract<
        typeof target.marker.address,
        { readonly kind: 'target' }
      >,
    });
    const retained = assembleWorkspaceBiomeSemantics(
      catalog,
      withBelowDepthAnomalyTakeovers(biomeSource(takenOver, 'Underworld', 'G')),
    );
    const retainedTarget = retained.nodes
      .flatMap((node) =>
        node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' ? node.targets : [],
      )
      .find((candidate) => candidate.room.occurrenceId === target.room.occurrenceId);
    expect(retainedTarget?.room.anomaly).toBeDefined();
  });

  it('composes N in authored Opening → PreHub → Hub → Preboss order without duplicate occurrences', () => {
    const source = biomeSource(appendCompleteN(emptyNProject()));
    const assembly = assembleWorkspaceBiomeSemantics(catalog, source);

    const opening = indexOfNode(
      assembly,
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceIds.opening,
      'N Opening workbench is missing',
    );
    const preHubDecision = indexOfNode(
      assembly,
      (node) =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.source.kind === 'occurrence' &&
        node.source.occurrenceId === nOccurrenceIds.opening,
      'N PreHub decision is missing',
    );
    const preHub = indexOfNode(
      assembly,
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceIds.preHub,
      'N PreHub workbench is missing',
    );
    const hub = indexOfNode(
      assembly,
      (node) => node.kind === 'hubDecision',
      'N Hub board is missing',
    );
    const firstHubWorkbench = indexOfNode(
      assembly,
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.inspectorPresentation === 'hubRoomLocal',
      'N Hub room-local workbench is missing',
    );
    const prebossDecision = indexOfNode(
      assembly,
      (node) =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.source.kind === 'hubDecision',
      'N Preboss handoff is missing',
    );
    const preboss = indexOfNode(
      assembly,
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceIds.preboss,
      'N Preboss workbench is missing',
    );
    expect(opening).toBeLessThan(preHubDecision);
    expect(preHubDecision).toBeLessThan(preHub);
    expect(preHub).toBeLessThan(hub);
    expect(hub).toBeLessThan(firstHubWorkbench);
    expect(firstHubWorkbench).toBeLessThan(prebossDecision);
    expect(prebossDecision).toBeLessThan(preboss);

    const occurrenceIds = assembly.nodes
      .filter(
        (
          node,
        ): node is Extract<
          (typeof assembly.nodes)[number],
          { readonly kind: 'occurrenceWorkbench' }
        > => node.kind === 'occurrenceWorkbench',
      )
      .map((node) => node.room.occurrenceId);
    expect(new Set(occurrenceIds).size).toBe(occurrenceIds.length);
    expect(new Set(occurrenceIds)).toEqual(
      new Set(source.plan.topology?.occurrences.map((occurrence) => occurrence.occurrenceId)),
    );
    expect(assembly.hubInteractionRequirements.size).toBe(1);
    expect(assembly.occurrenceInteractionRequirements.size).toBeGreaterThan(0);
    expect(assembly.topologyRemovalInteractionRequirements.size).toBe(1);
    expect(assembly.takeoverInteractionRequirements.size).toBeGreaterThan(0);

    const hubNode = assembly.nodes.find((node) => node.kind === 'hubDecision');
    const completion = assembly.completion[0];
    if (hubNode === undefined || completion === undefined) {
      throw new Error('N Hub or completion node is missing');
    }
    expect(assembly.preliminaryFocusDestinations.has(assembly.marker.focusKey)).toBe(true);
    expect(assembly.preliminaryFocusDestinations.has(hubNode.marker.focusKey)).toBe(true);
    expect(assembly.preliminaryFocusDestinations.has(completion.marker.focusKey)).toBe(true);
    expect(assembly.preliminaryFocusDestinations.has(assembly.marker.focusKey)).toBe(true);
  });

  it('keeps the empty N start frontier without publishing an unauthored Hub board', () => {
    const assembly = assembleWorkspaceBiomeSemantics(catalog, biomeSource(emptyNProject()));
    const hub = assembly.structuralNodes.find((node) => node.kind === 'hubDecision');

    expect(assembly.frontier).toMatchObject({ kind: 'start', owner: nBiome });
    expect(hub).toBeUndefined();
    expect(assembly.hubInteractionRequirements.size).toBe(0);
    expect(assembly.roomControls.size).toBe(0);
    expect(assembly.rewardControls.size).toBe(0);
    expect(assembly.startInteractionRequirements.size).toBe(1);
  });

  it('projects declaration-owned biome fields at semantic assembly ownership', () => {
    const assembly = assembleWorkspaceBiomeSemantics(
      catalog,
      biomeSource(createGoldenFGHIProject(), 'Underworld', 'I'),
    );

    expect(assembly.fields).toEqual([
      {
        address: createBiomeFieldAddress(goldenIBiome, 'maxNonGoalRewards'),
        key: 'maxNonGoalRewards',
        kind: 'boundedInteger',
        label: 'Rolled non-goal limit',
        marker: expect.objectContaining({
          address: createBiomeFieldAddress(goldenIBiome, 'maxNonGoalRewards'),
        }),
        value: 3,
        values: [3, 4, 5, 6],
      },
    ]);
  });

  it('keeps incomplete and route-prefix-blocked biome products explicit', () => {
    const initial = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 2 },
      name: 'Semantic prefix states',
      projectId: 'semantic-prefix-states',
    });
    const f = assembleWorkspaceBiomeSemantics(catalog, biomeSource(initial, 'Underworld', 'F'));
    const g = assembleWorkspaceBiomeSemantics(catalog, biomeSource(initial, 'Underworld', 'G'));

    expect(f).toMatchObject({
      frontier: { kind: 'start', owner: goldenFBiome },
      status: 'incomplete',
    });
    expect(g).toMatchObject({ frontier: { kind: 'start' }, status: 'blocked' });

    const partial = applyProjectCommand(initial, catalog, {
      biome: goldenFBiome,
      gameName: 'F_Opening01',
      kind: 'CreateStart',
      occurrenceId: createOccurrenceId('semantic-prefix-f-start'),
    });
    const partialF = assembleWorkspaceBiomeSemantics(
      catalog,
      biomeSource(partial, 'Underworld', 'F'),
    );
    expect(partialF).toMatchObject({
      entry: { room: { gameName: 'F_Opening01' } },
      source: 'progressive',
      status: 'incomplete',
    });
  });

  it('keeps a fully authored canonical biome published when evaluation is invalid', () => {
    const invalid = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      gameName: 'P_Combat02',
      kind: 'ReplaceOccurrenceRoom',
      occurrence: {
        biomeKey: pBiome.biomeKey,
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat03', 1, 1),
        routeKey: pBiome.routeKey,
      },
    });
    const assembly = assembleWorkspaceBiomeSemantics(catalog, biomeSource(invalid, 'Surface', 'P'));

    expect(assembly).toMatchObject({ source: 'canonical', status: 'invalid' });
    expect(
      assembly.nodes.some(
        (node) =>
          (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') &&
          node.targets.some((target) => target.marker.findingCount > 0),
      ),
    ).toBe(true);
  });
});
