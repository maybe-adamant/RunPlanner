import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubVisitAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceIds,
} from '@run-planner/test-fixtures';
import {
  createStructuredWorkspaceTestServices,
  requireWorkspaceBiome,
} from '../../../../test/fixtures/structuredWorkspace';
import type {
  WorkspaceBiome,
  WorkspaceDefaultInspectorDestination,
  WorkspaceNode,
} from '../contract';
import {
  defaultInspectorDestination,
  type WorkspaceInspectorDefaultsInput,
} from './inspector-defaults';

const { structuredWorkspace } = createStructuredWorkspaceTestServices();

function project(projectDocument: ProjectDocument) {
  return structuredWorkspace.project(projectDocument, simulateProject(catalog, projectDocument));
}

function biome(projectDocument: ProjectDocument, biomeKey: string): WorkspaceBiome {
  return requireWorkspaceBiome(project(projectDocument), biomeKey);
}

function emptyProject(routeKey: 'Surface' | 'Underworld', count: number): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: `default-inspector-empty-${routeKey}-${count}`,
    name: `Default inspector empty ${routeKey}`,
    configuredBiomeCounts: { [routeKey]: count },
  });
}

function nOpeningPreHubProject(): ProjectDocument {
  let projectDocument = emptyProject('Surface', 1);
  projectDocument = applyProjectCommand(projectDocument, catalog, {
    kind: 'CreateStart',
    biome: nBiome,
    occurrenceId: nOccurrenceIds.opening,
  });
  return applyProjectCommand(projectDocument, catalog, {
    kind: 'CreateLinkedExit',
    decision: createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    }),
    occurrenceId: nOccurrenceIds.preHub,
  });
}

function withUnresolvedFSelections(
  projectDocument: ProjectDocument,
  sourceOccurrenceIds: readonly string[],
): ProjectDocument {
  return {
    ...projectDocument,
    routes: projectDocument.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : {
            ...route,
            biomes: route.biomes.map((plan) =>
              plan.biomeKey !== 'F' || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      decisions: plan.topology.decisions.map((decision) =>
                        decision.kind === 'exit' &&
                        decision.source.kind === 'occurrence' &&
                        sourceOccurrenceIds.includes(decision.source.occurrenceId)
                          ? { ...decision, selection: { kind: 'unresolved' as const } }
                          : decision,
                      ),
                    },
                  },
            ),
          },
    ),
  };
}

function defaultsInput(
  value: WorkspaceBiome,
  overrides: Partial<WorkspaceInspectorDefaultsInput> = {},
): WorkspaceInspectorDefaultsInput {
  return {
    ...(value.entry === undefined ? {} : { entry: value.entry }),
    frontier: value.frontier,
    nodes: value.nodes,
    rail: value.rail,
    ...overrides,
  };
}

function expectNode(
  destination: WorkspaceDefaultInspectorDestination | null,
  nodeKey: string,
): asserts destination is Extract<WorkspaceDefaultInspectorDestination, { readonly kind: 'node' }> {
  expect(destination).toMatchObject({ kind: 'node', nodeKey });
}

function expectFrontier(
  destination: WorkspaceDefaultInspectorDestination | null,
  focusKey: string,
): void {
  expect(destination).toEqual({
    frontierFocusKey: focusKey,
    kind: 'frontier',
    selectedRailKey: focusKey,
  });
}

function nodeByKey(value: WorkspaceBiome, key: string): WorkspaceNode {
  const node = value.nodes.find((candidate) => candidate.key === key);
  if (node === undefined) throw new Error(`${key} workspace node is missing`);
  return node;
}

describe('workspace inspector defaults', () => {
  it('projects the active start and bare exit frontiers directly', () => {
    const empty = biome(emptyProject('Underworld', 1), 'F');
    if (empty.frontier?.kind !== 'start') throw new Error('empty F start frontier is missing');
    expectFrontier(empty.defaultInspectorDestination, empty.frontier.marker.focusKey);

    const start = createOccurrenceId('default-inspector-start-only-f');
    const started = applyProjectCommand(emptyProject('Underworld', 1), catalog, {
      kind: 'CreateStart',
      biome: goldenFBiome,
      occurrenceId: start,
      gameName: 'F_Opening01',
    });
    const startedBiome = biome(started, 'F');
    if (startedBiome.frontier?.kind !== 'exitDecision') {
      throw new Error('start-only F exit frontier is missing');
    }
    expectFrontier(startedBiome.defaultInspectorDestination, startedBiome.frontier.marker.focusKey);
  });

  it('keeps ordinary default priority in final projection order', () => {
    const complete = createGoldenFGHIProject();
    for (const biomeKey of ['F', 'G', 'H', 'I'] as const) {
      const value = biome(complete, biomeKey);
      expect(value.defaultInspectorDestination?.kind).toBe('node');
      if (value.defaultInspectorDestination?.kind !== 'node') continue;
      expect(nodeByKey(value, value.defaultInspectorDestination.nodeKey).kind).toMatch(
        /ordinaryBatch|mixedBatch|takeoverBatch/,
      );
    }
    const surface = createRepresentativeNOPQProject();
    for (const biomeKey of ['O', 'P', 'Q'] as const) {
      const value = biome(surface, biomeKey);
      expect(value.defaultInspectorDestination?.kind).toBe('node');
      if (value.defaultInspectorDestination?.kind !== 'node') continue;
      expect(nodeByKey(value, value.defaultInspectorDestination.nodeKey).kind).toMatch(
        /ordinaryBatch|mixedBatch|takeoverBatch/,
      );
    }

    const partial = biome(
      withUnresolvedFSelections(createGoldenFGHIProject(), [
        goldenFOccurrenceId(1, 1),
        goldenFOccurrenceId(2, 1),
      ]),
      'F',
    );
    const latestIncomplete = partial.nodes
      .filter(
        (node) =>
          (node.kind === 'ordinaryBatch' ||
            node.kind === 'mixedBatch' ||
            node.kind === 'takeoverBatch') &&
          node.targets.length > 0 &&
          !node.targets.some((target) => target.selected),
      )
      .at(-1);
    if (latestIncomplete === undefined) throw new Error('latest incomplete F decision is missing');
    expectNode(partial.defaultInspectorDestination, latestIncomplete.key);

    const retained = biome(
      applyProjectCommand(createGoldenFGHIProject(), catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
        gameName: 'F_Combat01',
      }),
      'F',
    );
    expect(retained.status).toBe('invalid');
    expect(retained.defaultInspectorDestination?.kind).toBe('node');
    if (retained.defaultInspectorDestination?.kind !== 'node') return;
    expect(nodeByKey(retained, retained.defaultInspectorDestination.nodeKey).kind).toBe(
      'takeoverBatch',
    );

    const blocked = biome(
      withUnresolvedFSelections(createGoldenFGHIProject(), [goldenFOccurrenceId(1, 1)]),
      'G',
    );
    expect(blocked.status).toBe('blocked');
    expect(blocked.defaultInspectorDestination?.kind).toBe('node');
    if (blocked.defaultInspectorDestination?.kind !== 'node') return;
    expect(nodeByKey(blocked, blocked.defaultInspectorDestination.nodeKey).kind).toBe(
      'takeoverBatch',
    );
  });

  it('routes Hub frontiers to the board and a fixed Preboss detail to its workbench', () => {
    const pending = biome(nOpeningPreHubProject(), 'N');
    if (pending.frontier?.kind !== 'hubDecision') throw new Error('N Hub frontier is missing');
    expect(pending.defaultInspectorDestination?.kind).toBe('node');
    if (pending.defaultInspectorDestination?.kind !== 'node') return;
    expect(nodeByKey(pending, pending.defaultInspectorDestination.nodeKey).kind).toBe(
      'hubDecision',
    );

    const fresh = biome(
      applyProjectCommand(nOpeningPreHubProject(), catalog, {
        kind: 'CreateHubDecision',
        hub: createHubDecisionAddress(nBiome, 'hub'),
      }),
      'N',
    );
    if (fresh.frontier?.kind !== 'hubOpenSet') throw new Error('fresh N Hub open-set is missing');
    expect(fresh.defaultInspectorDestination?.kind).toBe('node');
    if (fresh.defaultInspectorDestination?.kind !== 'node') return;
    expect(nodeByKey(fresh, fresh.defaultInspectorDestination.nodeKey).kind).toBe('hubDecision');

    const truncated = biome(
      applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
        kind: 'RemoveHubVisitsFrom',
        visit: createHubVisitAddress(nBiome, 'hub', 4),
      }),
      'N',
    );
    if (truncated.frontier?.kind !== 'hubVisit') {
      throw new Error('truncated N Hub visit frontier is missing');
    }
    expect(truncated.defaultInspectorDestination?.kind).toBe('node');
    if (truncated.defaultInspectorDestination?.kind !== 'node') return;
    expect(nodeByKey(truncated, truncated.defaultInspectorDestination.nodeKey).kind).toBe(
      'hubDecision',
    );

    const handoff = biome(
      appendCompleteN(
        createProjectDocument(catalog, {
          projectId: 'default-inspector-handoff',
          name: 'Default inspector Hub handoff',
          configuredBiomeCounts: { Surface: 1 },
        }),
        { includePreboss: false },
      ),
      'N',
    );
    if (
      handoff.frontier?.kind !== 'exitDecision' ||
      handoff.frontier.owner.source.kind !== 'hubDecision'
    ) {
      throw new Error('N completed Hub handoff frontier is missing');
    }
    expect(handoff.defaultInspectorDestination?.kind).toBe('node');
    if (handoff.defaultInspectorDestination?.kind !== 'node') return;
    expect(nodeByKey(handoff, handoff.defaultInspectorDestination.nodeKey).kind).toBe(
      'hubDecision',
    );

    const complete = biome(createRepresentativeNOPQProject(), 'N');
    const preboss = complete.nodes.find(
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceIds.preboss,
    );
    if (preboss === undefined) throw new Error('complete N fixed Preboss is missing');
    expectNode(complete.defaultInspectorDestination, preboss.key);
    expect(complete.defaultInspectorDestination?.selectedRailKey).toBe(
      semanticAddressKey(
        createTargetAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }, 'preboss'),
      ),
    );
  });

  it('keeps defensive matching-exit, entry, first-node, and empty defaults explicit', () => {
    const start = createOccurrenceId('default-inspector-matching-exit-start');
    const startedProject = applyProjectCommand(emptyProject('Underworld', 1), catalog, {
      kind: 'CreateStart',
      biome: goldenFBiome,
      occurrenceId: start,
      gameName: 'F_Opening01',
    });
    const started = biome(startedProject, 'F');
    if (started.frontier?.kind !== 'exitDecision') {
      throw new Error('matching-exit frontier is missing');
    }
    const matchingFrontier = started.frontier;
    const matching = biome(
      applyProjectCommand(startedProject, catalog, {
        kind: 'CreateBatch',
        decision: matchingFrontier.owner,
      }),
      'F',
    );
    const matchingDecision = matching.nodes.find(
      (node) =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        semanticAddressKey(node.owner) === semanticAddressKey(matchingFrontier.owner),
    );
    if (matchingDecision === undefined) throw new Error('matching exit decision is missing');
    expectNode(
      defaultInspectorDestination(defaultsInput(matching, { frontier: matchingFrontier })),
      matchingDecision.key,
    );

    const complete = biome(createGoldenFGHIProject(), 'F');
    const entry = complete.entry;
    if (entry === undefined) throw new Error('complete F entry is missing');
    expectNode(
      defaultInspectorDestination(
        defaultsInput(complete, {
          frontier: null,
          nodes: complete.nodes.map((node) =>
            node.kind === 'occurrenceWorkbench'
              ? { ...node, room: { ...node.room, detailsActive: false } }
              : node,
          ),
        }),
      ),
      entry.key,
    );

    const completion = complete.nodes.find((node) => node.kind === 'completion');
    if (completion === undefined) throw new Error('complete F completion node is missing');
    expectNode(
      defaultInspectorDestination({ frontier: null, nodes: [completion], rail: [] }),
      completion.key,
    );
    expect(defaultInspectorDestination({ frontier: null, nodes: [], rail: [] })).toBeNull();
  });
});
