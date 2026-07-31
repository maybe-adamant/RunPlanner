import { catalog } from '@run-planner/hades2-catalog';
import {
  createExitDecisionAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '../../../test/fixtures/underworldProject';
import { createRepresentativeNOPQProject } from '../../../test/fixtures/surfaceProject';
import {
  assembleWorkspaceDecision,
  type WorkspaceAuthoredBatchDecision,
  type WorkspaceAuthoredLinkedExitDecision,
  type WorkspaceDecisionOccurrenceInput,
} from './decision-assembly';
import { assembleWorkspaceOccurrence } from './occurrence-assembly';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from './occurrence-facts';
import { createWorkspaceBiomeMarkerDestinationBuilder } from './marker-builder';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from './source-index';

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

function decisionKit(source: WorkspaceBiomeSource) {
  const facts = createWorkspaceBiomeOccurrenceAssemblyFacts(catalog, source);
  const markers = createWorkspaceBiomeMarkerDestinationBuilder({
    assessmentFor: (address) =>
      source.evaluation === undefined
        ? 'blocked'
        : source.isAssessed(address) || source.findingsFor(address).length > 0
          ? 'assessed'
          : 'unassessed',
    biome: source.biome,
    findingCountFor: (address) => source.findingsFor(address).length,
    routeKey: source.biome.routeKey,
  });
  const assembleOccurrence = (input: WorkspaceDecisionOccurrenceInput) => {
    const occurrenceFacts = facts.occurrence(input.occurrence.occurrenceId);
    if (occurrenceFacts === undefined) {
      throw new Error(`${input.occurrence.occurrenceId} occurrence facts are missing`);
    }
    return assembleWorkspaceOccurrence({
      biome: source.biome,
      catalog,
      ...(input.evaluatedRoom === undefined ? {} : { evaluatedRoom: input.evaluatedRoom }),
      facts: occurrenceFacts,
      markerDestinations: markers.emitter,
      occurrence: input.occurrence,
    });
  };
  return { assembleOccurrence, markers };
}

function batchDecision(source: WorkspaceBiomeSource): WorkspaceAuthoredBatchDecision {
  const decision = source.exitDecisions.find(
    (candidate) => candidate.normal.kind === 'batch' && candidate.normal.targets.length > 1,
  );
  if (decision?.normal.kind !== 'batch') throw new Error('multi-target authored batch is missing');
  return decision as WorkspaceAuthoredBatchDecision;
}

function linkedDecision(source: WorkspaceBiomeSource): WorkspaceAuthoredLinkedExitDecision {
  const decision = source.exitDecisions.find((candidate) => candidate.normal.kind === 'linked');
  if (decision?.normal.kind !== 'linked') throw new Error('authored linked exit is missing');
  return decision as WorkspaceAuthoredLinkedExitDecision;
}

describe('structured workspace decision assembly', () => {
  it('returns authored physical targets, workbenches, controls, and decision focus redirects', () => {
    const source = biomeSource(createGoldenFGHIProject(catalog), 'Underworld', 'F');
    const decision = batchDecision(source);
    const owner = createExitDecisionAddress(source.biome, decision.source);
    const evaluated = source.evaluatedBatch(owner);
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision,
      ...(evaluated === undefined ? {} : { evaluated }),
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });

    if (assembly.kind !== 'batch') throw new Error('batch produced a linked-exit assembly');
    expect(assembly.batch.targets.map((target) => target.index)).toEqual(
      [...assembly.batch.targets].map((target) => target.index).sort((left, right) => left - right),
    );
    expect(assembly.batch.targets.filter((target) => target.selected)).toHaveLength(1);
    expect(assembly.workbenches).toHaveLength(assembly.batch.targets.length);
    expect(assembly.roomControls.some((control) => control.kind === 'targetRoomPicker')).toBe(true);
    const selected = assembly.batch.targets.find((target) => target.selected);
    if (selected === undefined) throw new Error('selected target is missing');
    expect(kit.markers.destinations().get(selected.marker.focusKey)?.nodeKey).toBe(
      assembly.batch.key,
    );
    expect(kit.markers.destinations().get(selected.room.marker.focusKey)?.nodeKey).toBe(
      assembly.batch.key,
    );
  });

  it('retains authored batch membership when no evaluated overlay is supplied', () => {
    const source = biomeSource(createGoldenFGHIProject(catalog), 'Underworld', 'F');
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision: batchDecision(source),
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });

    if (assembly.kind !== 'batch') throw new Error('batch produced a linked-exit assembly');
    expect(assembly.batch.targets.every((target) => target.retained)).toBe(true);
    expect(assembly.workbenches.map((workbench) => workbench.room.occurrenceId)).toEqual(
      assembly.batch.targets.map((target) => target.room.occurrenceId),
    );
  });

  it('keeps the linked PreHub workbench as the exact staged-removal focus destination', () => {
    const source = biomeSource(createRepresentativeNOPQProject(), 'Surface', 'N');
    const decision = linkedDecision(source);
    const owner = createExitDecisionAddress(source.biome, decision.source);
    const evaluated = source.evaluatedLinkedExit(owner);
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision,
      ...(evaluated === undefined ? {} : { evaluated }),
      kind: 'linkedExit',
      markerDestinations: kit.markers.emitter,
      source,
    });

    if (assembly.kind !== 'linkedExit') throw new Error('linked exit produced a batch assembly');
    expect(assembly.workbench.sourceDecisionRemoval?.label).toBe('Remove PreHub');
    expect(assembly.node.target.selected).toBe(true);
    expect(assembly.node.target.retained).toBe(false);
    expect(kit.markers.destinations().get(assembly.node.target.marker.focusKey)?.nodeKey).toBe(
      assembly.workbench.key,
    );
    expect(semanticAddressKey(assembly.node.owner)).toBe(semanticAddressKey(owner));
  });
});
