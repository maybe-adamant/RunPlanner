import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  type ExitDecision,
} from '@run-planner/engine/authored-project';
import {
  simulateProjectAssembly,
  type ProjectCandidateEvaluation,
} from '@run-planner/engine/simulation';
import { describe, expect, it, vi } from 'vitest';

import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { candidateSupport, createCandidateSessionFactory } from './candidateProjection';

const candidateTarget = createTargetAddress(
  createBiomeAddress('Underworld', 'F'),
  { kind: 'occurrence', occurrenceId: createOccurrenceId('candidate-force-source') },
  'exit1',
);

function roomTargetCandidate(
  selectedGameName: string,
  supportRoomGameNames: readonly string[],
  requiredForcedRoomGameNames: readonly string[],
): ProjectCandidateEvaluation {
  return {
    kind: 'roomTarget',
    result: {
      pressure: {
        targetOrigin: candidateTarget,
        beforeSequence: 0,
        sourceGameName: 'F_Opening01',
        selectedGameName,
        exitIndex: 1,
        biomeDepthCache: 0,
        biomeEncounterDepth: 0,
        selectedCreationCount: 0,
        selectedAppearanceCount: 0,
        selectedParentCreationCount: 0,
        eligibleRoomGameNames: supportRoomGameNames,
        optionalForcedRoomGameNames: [],
        requiredForcedRoomGameNames,
        supportRoomGameNames,
        selectedPossible: true,
        selectedExclusionReasons: [],
        selectedExclusions: [],
      },
      findings: [],
    },
  };
}

function takeoverCandidate(
  support: 'impossible' | 'possible' | 'required',
): ProjectCandidateEvaluation {
  return {
    kind: 'takeoverPrebossBatch',
    result: {
      source: createExitDecisionAddress(
        createBiomeAddress('Underworld', 'F'),
        candidateTarget.source,
      ),
      gameName: 'F_PreBoss01',
      requiredExitKeys: ['exit1'],
      requiredTargetCount: 1,
      support,
      pressure: [],
      selectedPossible: support !== 'impossible',
      findings: [],
    },
  };
}

function fPlan(project: ReturnType<typeof createGoldenFGHIProject>) {
  const plan = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'F');
  if (plan?.topology === null || plan === undefined) throw new Error('F topology is missing');
  return plan;
}

function exitDecisions(
  project: ReturnType<typeof createGoldenFGHIProject>,
): readonly ExitDecision[] {
  return fPlan(project).topology!.decisions.filter(
    (decision): decision is ExitDecision => decision.kind === 'exit',
  );
}

describe('candidate projection', () => {
  it('uses materialized resolved stores for counted reward domains', () => {
    const project = createGoldenFGHIProject();
    const observeCandidateEvaluation = vi.fn();
    const session = createCandidateSessionFactory(catalog, { observeCandidateEvaluation }).bind(
      simulateProjectAssembly(catalog, project),
    );
    const occurrence = fPlan(project).topology!.occurrences.find(
      (candidate) => candidate.gameName === 'F_Combat03',
    );
    const room = catalog.rooms.byKey.F_Combat03;
    if (
      occurrence?.state.kind !== 'counted' ||
      occurrence.state.reward === null ||
      room?.incomingReward.kind !== 'countedChoice'
    ) {
      throw new Error('F counted reward fixture is missing');
    }
    const domain = session.countedRewardTypes(
      {
        kind: 'incomingReward',
        address: createIncomingRewardAddress(
          createBiomeAddress('Underworld', 'F'),
          occurrence.occurrenceId,
        ),
      },
      room.incomingReward,
      occurrence.state.reward.offer.rewardType,
    );

    expect(domain).toContain(occurrence.state.reward.offer.rewardType);
    expect(domain).not.toContain('MetaCurrencyDrop');
    expect(observeCandidateEvaluation).not.toHaveBeenCalled();
  });

  it('keeps takeovers source-owned and evaluates their one batch candidate', () => {
    const project = createGoldenFGHIProject();
    const session = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const takeover = exitDecisions(project).find(
      (decision) =>
        decision.normal.kind === 'batch' &&
        decision.normal.targets.some(
          (target) =>
            fPlan(project).topology!.occurrences.find(
              (room) => room.occurrenceId === target.occurrenceId,
            )?.gameName === 'F_PreBoss01',
        ),
    );
    if (takeover === undefined) throw new Error('F takeover decision is missing');
    const owner = createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), takeover.source);
    const candidate = session.takeoverPrebossBatches(owner, ['F_PreBoss01'])[0];

    expect(candidate?.evaluation.kind).toBe('takeoverPrebossBatch');
    expect(candidateSupport(candidate)).toBe('forced');
  });

  it('returns typed unavailable evidence when a target lies behind an incomplete upstream biome', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'upstream',
      configuredBiomeCounts: { Underworld: 2 },
    });
    const withGStart = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: createBiomeAddress('Underworld', 'G'),
      occurrenceId: createOccurrenceId('unreached-g-source'),
    });
    const session = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, withGStart),
    );
    const target = createTargetAddress(
      createBiomeAddress('Underworld', 'G'),
      {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('unreached-g-source'),
      },
      'exit1',
    );
    const result = session.roomTargets(target, [catalog.rooms.byKey.G_Combat01!])[0]!.evaluation;

    expect(result).toMatchObject({
      kind: 'unavailable',
      evidence: { kind: 'upstreamIncomplete', upstreamBiomeKey: 'F' },
    });
  });

  it('adapts exact encounter support into typed coverage, activation, and requirement evidence', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ResetEncounter',
      phase: createEncounterPhaseAddress(
        createBiomeAddress('Underworld', 'I'),
        { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-i-combat01') },
        'Encounter',
      ),
    });
    const phase = createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'I'),
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-i-combat01') },
      'Encounter',
    );
    const candidates = createCandidateSessionFactory(catalog)
      .bind(simulateProjectAssembly(catalog, project))
      .encounterPhases(phase, ['GeneratedI', 'GeneratedI_GoalReward']);

    expect(candidates).toEqual([
      expect.objectContaining({
        evaluation: expect.objectContaining({
          result: expect.objectContaining({
            evidence: { kind: 'requirementsExcluded' },
            support: 'impossible',
          }),
        }),
        value: 'GeneratedI',
      }),
      expect.objectContaining({
        evaluation: expect.objectContaining({
          result: expect.objectContaining({
            evidence: { kind: 'supported' },
            support: 'forced',
          }),
        }),
        value: 'GeneratedI_GoalReward',
      }),
    ]);
  });

  it('addresses batch-store candidates by their source rather than an array position', () => {
    const project = createGoldenFGHIProject();
    const session = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const decision = exitDecisions(project)[0]!;
    const store = createBatchRewardStoreAddress(
      createBiomeAddress('Underworld', 'F'),
      decision.source,
    );
    const result = session.batchRewardStores(store, ['RunProgress', 'MetaProgress']);

    expect(result.map((option) => option.evaluation.kind)).toEqual([
      'batchRewardStore',
      'batchRewardStore',
    ]);
  });

  it('uses required-force evidence rather than the size of the possible room support', () => {
    const singletonSupport = roomTargetCandidate('F_Combat01', ['F_Combat01'], []);
    const multiMemberRequiredForce = roomTargetCandidate(
      'F_Combat01',
      ['F_Combat01', 'F_Combat02'],
      ['F_Combat01', 'F_Combat02'],
    );

    expect(candidateSupport({ value: 'F_Combat01', evaluation: singletonSupport })).toBe(
      'possible',
    );
    expect(candidateSupport({ value: 'F_Combat01', evaluation: multiMemberRequiredForce })).toBe(
      'forced',
    );
  });

  it('presents takeover force from the engine batch support rather than per-exit pressure', () => {
    expect(
      candidateSupport({ value: 'F_PreBoss01', evaluation: takeoverCandidate('required') }),
    ).toBe('forced');
    expect(
      candidateSupport({ value: 'F_PreBoss01', evaluation: takeoverCandidate('possible') }),
    ).toBe('possible');
    expect(
      candidateSupport({ value: 'F_PreBoss01', evaluation: takeoverCandidate('impossible') }),
    ).toBe('impossible');
  });
});
