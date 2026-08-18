import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type {
  BiomeTopology,
  ExitDecision,
  ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createRepresentativeNOPQProject,
  createRepresentativeNProject,
  nOccurrenceIds,
  oOccurrenceIds,
  qOccurrenceIds,
} from '@run-planner/test-fixtures';

import {
  declaredPhysicalExits,
  exitDecisionForSource,
  fixedWidthOneTakeoverForSource,
  fixedWidthOneTakeoverTransitionForSource,
  hostContinuationExitForDetourRoom,
  selectedExitKey,
  selectedExitTarget,
  selectedOrdinaryBatchIndex,
} from '../../../src/authored-project/topology/query';

function topologyFor(project: ProjectDocument, biomeKey: string): BiomeTopology {
  for (const route of project.routes) {
    const topology = route.biomes.find((biome) => biome.biomeKey === biomeKey)?.topology;
    if (topology !== null && topology !== undefined) return topology;
  }
  throw new Error(`${biomeKey} topology is required`);
}

function requireExitDecision(
  topology: BiomeTopology,
  occurrenceId: Parameters<typeof selectedOrdinaryBatchIndex>[1],
): ExitDecision {
  const decision = exitDecisionForSource(topology, { kind: 'occurrence', occurrenceId });
  if (decision === undefined) throw new Error(`exit decision for ${occurrenceId} is required`);
  return decision;
}

describe('authored topology queries', () => {
  it('keeps automatic special returns hidden while an entered Chaos return stays visible', () => {
    expect(hostContinuationExitForDetourRoom(catalog.rooms.byKey.B_Combat01!)).toMatchObject({
      behavior: { kind: 'automaticHostContinuation', rewardPreview: 'hidden' },
    });
    expect(hostContinuationExitForDetourRoom(catalog.rooms.byKey.C_Boss01!)).toMatchObject({
      behavior: { kind: 'automaticHostContinuation', rewardPreview: 'hidden' },
    });
    expect(hostContinuationExitForDetourRoom(catalog.rooms.byKey.Chaos_01!)).toMatchObject({
      behavior: { kind: 'playerSelected', rewardPreview: 'visible' },
    });
  });

  it('looks up exact occurrence and Hub sources without conflating either address kind', () => {
    const topology = topologyFor(createRepresentativeNProject(), 'N');

    expect(
      exitDecisionForSource(topology, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.opening,
      }),
    ).toMatchObject({
      kind: 'exit',
      normal: {
        kind: 'batch',
        targets: [{ exitKey: 'prehub', occurrenceId: nOccurrenceIds.preHub }],
      },
    });
    expect(topology.decisions.find((decision) => decision.kind === 'hub')).toMatchObject({
      kind: 'hub',
      source: { kind: 'occurrence', occurrenceId: nOccurrenceIds.preHub },
    });
    expect(
      exitDecisionForSource(topology, { kind: 'hubDecision', decisionKey: 'hub' }),
    ).toMatchObject({ kind: 'exit', source: { kind: 'hubDecision' } });
    expect(
      exitDecisionForSource(topology, { kind: 'hubDecision', decisionKey: 'missing' }),
    ).toBeUndefined();
  });

  it('resolves normal, derived, explicit, and unresolved selections without repairing state', () => {
    const surface = createRepresentativeNOPQProject();
    const nTopology = topologyFor(surface, 'N');
    const oTopology = topologyFor(surface, 'O');
    const qTopology = topologyFor(surface, 'Q');
    const normal = requireExitDecision(nTopology, nOccurrenceIds.opening);
    const derived = requireExitDecision(oTopology, oOccurrenceIds.intro);
    const explicit = requireExitDecision(qTopology, qOccurrenceIds.firstFork);
    const unresolved = Object.freeze({
      ...explicit,
      selection: Object.freeze({ kind: 'unresolved' as const }),
    });

    expect(selectedExitKey(normal)).toBe('prehub');
    expect(selectedExitTarget(normal)).toEqual({
      exitKey: 'prehub',
      occurrenceId: nOccurrenceIds.preHub,
    });
    expect(selectedExitKey(derived)).toBe('exit1');
    expect(selectedExitTarget(derived)).toEqual({
      exitKey: 'exit1',
      occurrenceId: oOccurrenceIds.combat04,
    });
    expect(selectedExitKey(explicit)).toBe('exit1');
    expect(selectedExitTarget(explicit)).toEqual({
      exitKey: 'exit1',
      occurrenceId: qOccurrenceIds.firstMiniboss1,
    });
    expect(selectedExitKey(unresolved)).toBeUndefined();
    expect(selectedExitTarget(unresolved)).toBeUndefined();
  });

  it('derives selected-spine ordinals independently of decision storage order', () => {
    const topology = topologyFor(createRepresentativeNOPQProject(), 'Q');
    const reordered = Object.freeze({
      ...topology,
      decisions: Object.freeze([...topology.decisions].reverse()),
    });

    expect(selectedOrdinaryBatchIndex(reordered, qOccurrenceIds.intro)).toBe(0);
    expect(selectedOrdinaryBatchIndex(reordered, qOccurrenceIds.secondMiniboss1)).toBe(6);
    expect(selectedOrdinaryBatchIndex(reordered, qOccurrenceIds.preboss)).toBe(7);

    const intro = requireExitDecision(topology, qOccurrenceIds.intro);
    if (intro.normal.kind !== 'batch') throw new Error('Q Intro batch is required');
    const cyclicIntro = Object.freeze({
      ...intro,
      normal: Object.freeze({
        ...intro.normal,
        targets: Object.freeze([
          Object.freeze({ exitKey: 'exit1', occurrenceId: qOccurrenceIds.intro }),
        ]),
      }),
    });
    const cyclic = Object.freeze({
      ...topology,
      decisions: Object.freeze(
        topology.decisions.map((decision) => (decision === intro ? cyclicIntro : decision)),
      ),
    });
    expect(selectedOrdinaryBatchIndex(cyclic, qOccurrenceIds.foyer)).toBeUndefined();
  });

  it('preserves declaration-owned physical exits and bounded takeover transitions', () => {
    const surface = createRepresentativeNOPQProject();
    const nTopology = topologyFor(surface, 'N');
    const oTopology = topologyFor(surface, 'O');
    const qTopology = topologyFor(surface, 'Q');
    const nLayout = catalog.biomeLayouts.byKey.N;
    const oLayout = catalog.biomeLayouts.byKey.O;
    const qLayout = catalog.biomeLayouts.byKey.Q;
    if (nLayout === undefined || oLayout === undefined || qLayout === undefined) {
      throw new Error('Surface layouts are required');
    }

    expect(
      declaredPhysicalExits(catalog, oLayout, oTopology, {
        kind: 'occurrence',
        occurrenceId: oOccurrenceIds.intro,
      }),
    ).toEqual([
      {
        behavior: {
          kind: 'playerSelected',
          rewardPreview: 'visible',
        },
        kind: 'normal',
        exitKey: 'exit1',
        index: 1,
        type: 'ShipsExitDoor',
        compatibilityPolicyKey: 'Unconstrained',
      },
    ]);
    expect(
      declaredPhysicalExits(catalog, nLayout, nTopology, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.opening,
      }),
    ).toEqual([
      {
        behavior: {
          kind: 'playerSelected',
          rewardPreview: 'visible',
        },
        kind: 'normal',
        exitKey: 'prehub',
        index: 1,
        type: 'N_OpeningDoor',
        compatibilityPolicyKey: 'Unconstrained',
      },
    ]);
    expect(
      declaredPhysicalExits(catalog, nLayout, nTopology, {
        kind: 'hubDecision',
        decisionKey: 'hub',
      }),
    ).toEqual([
      {
        behavior: {
          kind: 'playerSelected',
          rewardPreview: 'visible',
        },
        kind: 'completedHub',
        exitKey: 'preboss',
        index: 1,
        type: 'EphyraExitBossDoor',
        compatibilityPolicyKey: 'Unconstrained',
      },
    ]);
    expect(
      declaredPhysicalExits(catalog, nLayout, nTopology, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.preHub,
      }),
    ).toEqual([]);
    expect(
      declaredPhysicalExits(catalog, nLayout, nTopology, {
        kind: 'hubDecision',
        decisionKey: 'missing',
      }),
    ).toBeUndefined();

    expect(
      fixedWidthOneTakeoverTransitionForSource(catalog, nLayout, nTopology, {
        kind: 'hubDecision',
        decisionKey: 'hub',
      }),
    ).toMatchObject({ kind: 'completedHubHandoff', room: { gameName: 'N_PreBoss01' } });
    expect(
      fixedWidthOneTakeoverForSource(catalog, oLayout, oTopology, {
        kind: 'occurrence',
        occurrenceId: oOccurrenceIds.combat02,
      }),
    ).toMatchObject({ gameName: 'O_PreBoss01' });
    expect(
      fixedWidthOneTakeoverTransitionForSource(catalog, qLayout, qTopology, {
        kind: 'occurrence',
        occurrenceId: qOccurrenceIds.secondMiniboss1,
      }),
    ).toMatchObject({ kind: 'fixedWidthOneTakeover', room: { gameName: 'Q_PreBoss01' } });
    expect(
      fixedWidthOneTakeoverForSource(catalog, qLayout, qTopology, {
        kind: 'occurrence',
        occurrenceId: qOccurrenceIds.secondFork,
      }),
    ).toBeUndefined();
  });
});
