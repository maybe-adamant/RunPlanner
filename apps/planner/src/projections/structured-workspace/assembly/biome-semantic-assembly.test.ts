import { catalog } from '@run-planner/hades2-catalog';
import { createProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { appendCompleteN, nBiome, nOccurrenceIds } from '../../../../test/fixtures/surfaceProject';
import { assembleWorkspaceBiomeSemantics } from './biome-semantic-assembly';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from '../source-index';

function biomeSource(project: ProjectDocument): WorkspaceBiomeSource {
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    simulateProject(catalog, project),
  )
    .routes.find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.plan.biomeKey === 'N');
  if (source === undefined) throw new Error('Surface/N source is missing');
  return source;
}

function emptyNProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    configuredBiomeCounts: { Surface: 1 },
    name: 'Empty N semantic assembly',
    projectId: 'empty-n-semantic-assembly',
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
        node.kind === 'linkedExit' &&
        node.source.kind === 'occurrence' &&
        node.source.occurrenceId === nOccurrenceIds.opening,
      'N PreHub linked decision is missing',
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

  it('keeps the empty N start frontier and declaration-owned Hub outline semantic but non-interactive', () => {
    const assembly = assembleWorkspaceBiomeSemantics(catalog, biomeSource(emptyNProject()));
    const hub = assembly.structuralNodes.find((node) => node.kind === 'hubDecision');

    expect(assembly.frontier).toMatchObject({ kind: 'start', owner: nBiome });
    expect(hub).toMatchObject({ authoring: 'outline', kind: 'hubDecision' });
    expect(assembly.hubInteractionRequirements.size).toBe(0);
    expect(assembly.roomControls.size).toBe(0);
    expect(assembly.rewardControls.size).toBe(0);
    expect(assembly.startInteractionRequirements.size).toBe(1);
  });
});
