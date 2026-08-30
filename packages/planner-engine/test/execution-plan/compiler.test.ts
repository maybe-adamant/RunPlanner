import { describe, expect, it } from 'vitest';

import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  createTranscendentEmbryoOutcomeAddress,
} from '../../src/authored-project';
import { simulateProjectAssembly } from '../../src/simulation';
import {
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
  ExecutionCompilerError,
  ExecutionPlanCodecError,
} from '../../src/execution-plan';
import positiveFixture from './fixtures/f-opening.execution.json';
import fgFixture from './fixtures/fg.execution.json';
import malformedFixture from './fixtures/malformed.execution.json';
import unsupportedFixture from './fixtures/unsupported.execution.json';

function fOnlyProject(project = createCompleteFGProject()) {
  return Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      biomes: Object.freeze(project.route.biomes.slice(0, 1)),
    }),
  });
}

function fAutomaticOutcomeProject() {
  let project = createCompleteFGProject();
  const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection,
    keepsakeKey: 'RandomBlessingKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTranscendentEmbryoEquipResult',
    result: createKeepsakeEquipResultAddress(selection, 'transcendentEmbryo'),
    value: { blessingKey: 'ChaosWeaponBlessing' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTranscendentEmbryoTransformation',
    outcome: createTranscendentEmbryoOutcomeAddress(
      createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(7, 1)),
      'Encounter',
    ),
    blessingKey: 'ChaosElementalBlessing',
  });
  const growthReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(6, 1));
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: growthReward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(growthReward, 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Demeter',
      options: [
        { traitKey: 'BoonGrowthBoon', rarity: 'Epic' },
        { traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' },
        { traitKey: 'PlantHealthBoon', rarity: 'Epic' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  const frontier = simulateProjectAssembly(catalog, fOnlyProject(project));
  const missing = frontier.evaluation.findings.find(
    (finding) => finding.code === 'steadyGrowthOutcomeMissing',
  )?.origin;
  if (missing?.kind !== 'steadyGrowthOutcome')
    throw new Error('automatic outcome fixture did not reach Steady Growth');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceSteadyGrowthTarget',
    outcome: missing,
    targetTraitKey: 'ApolloWeaponBoon',
  });
  return fOnlyProject(project);
}

describe('execution plan compiler', () => {
  it('projects the complete-valid F opening into an execution-only artifact', () => {
    const project = fOnlyProject();
    const plan = compileExecutionPlan({
      assembly: simulateProjectAssembly(
        // The fixture and compiler both use the catalog composed by the app.
        // Importing it here keeps this test at the engine boundary.
        catalog,
        project,
      ),
    });

    expect(plan).toMatchObject({
      format: 'run-planner-execution',
      protocolVersion: 3,
      routeKey: 'Underworld',
      extent: { kind: 'configuredPrefix', biomeKeys: ['F'], terminalBiomeKey: 'F' },
    });
    expect(plan.rooms[0]).toMatchObject({
      id: 'golden-f-start',
      biomeKey: 'F',
      gameName: 'F_Opening01',
      contents: {
        incomingReward: {
          rewardType: 'Boon',
          producerLifecycleKey: 'RoomReward',
          resolvedStoreKey: 'RunProgress',
          source: 'ApolloUpgrade',
        },
      },
      entered: true,
      trace: [
        { kind: 'roomEntered' },
        {
          kind: 'acquireReward',
          roles: [
            {
              role: 'source',
              traitOffer: { kind: 'traits', giver: 'Apollo', selected: 'option1' },
            },
          ],
        },
        { kind: 'encounterStart', phase: 'Encounter' },
        { kind: 'encounterEnd', phase: 'Encounter' },
        { kind: 'cleanup' },
        { kind: 'beforeRoomExit' },
      ],
      outgoing: {
        targets: [{ exitKey: 'exit1', index: 1, type: 'ErebusExitDoor', picked: true }],
        selectedExitKey: 'exit1',
      },
    });
    expect(plan.planFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    expect(decodeExecutionPlan(positiveFixture)).toEqual(plan);
  });

  it('admits only the configured complete-valid F/G prefix', () => {
    const plan = compileExecutionPlan({
      assembly: simulateProjectAssembly(catalog, createCompleteFGProject()),
    });
    expect(plan.extent.biomeKeys).toEqual(['F', 'G']);
  });

  it('projects a complete F/G prefix through peer and fixed links', () => {
    const project = createCompleteFGProject();
    const fg = Object.freeze({
      ...project,
      route: Object.freeze({
        ...project.route,
        biomes: Object.freeze(project.route.biomes.slice(0, 2)),
      }),
    });
    const plan = compileExecutionPlan({ assembly: simulateProjectAssembly(catalog, fg) });
    expect(plan.extent).toEqual({
      kind: 'configuredPrefix',
      biomeKeys: ['F', 'G'],
      terminalBiomeKey: 'G',
    });
    expect(plan.rooms.length).toBeGreaterThan(23);
    expect(plan.rooms.some((room) => room.entered && room.gameName === 'G_Intro')).toBe(true);
    const fTwoExit = plan.rooms.find(
      (room) =>
        room.biomeKey === 'F' &&
        room.outgoing.kind === 'batch' &&
        room.outgoing.targets.length === 2,
    );
    expect(fTwoExit?.outgoing).toMatchObject({
      kind: 'batch',
      targets: [
        { index: 1, picked: true },
        { index: 2, picked: false },
      ],
    });
    const gThreeExit = plan.rooms.find(
      (room) =>
        room.biomeKey === 'G' &&
        room.outgoing.kind === 'batch' &&
        room.outgoing.targets.length === 3,
    );
    expect(gThreeExit?.outgoing).toMatchObject({
      kind: 'batch',
      targets: [{ index: 1 }, { index: 2 }, { index: 3 }],
    });
    expect(plan.rooms.filter((room) => room.gameName === 'F_PreBoss01')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entered: false,
          contents: expect.objectContaining({
            incomingReward: expect.objectContaining({ rewardType: 'StackUpgrade' }),
          }),
        }),
      ]),
    );
    expect(
      plan.rooms
        .filter(
          (room) =>
            room.biomeKey === 'F' &&
            room.outgoing.kind === 'fixed' &&
            room.outgoing.target.biomeKey === 'G',
        )
        .map((room) => room.gameName),
    ).toEqual(['F_PostBoss01']);
    for (const room of plan.rooms.filter((candidate) => candidate.entered)) {
      const entry = room.trace[0];
      const exit = room.trace.at(-1);
      expect(entry).toMatchObject({ kind: 'roomEntered' });
      expect(exit).toMatchObject({ kind: 'beforeRoomExit' });
      expect(entry !== undefined && 'runState' in entry ? entry.runState : undefined).toBeDefined();
      expect(exit !== undefined && 'runState' in exit ? exit.runState : undefined).toBeDefined();
    }
    expect(decodeExecutionPlan(fgFixture)).toEqual(plan);
  });

  it('projects reached automatic outcomes at their encounter-end owners', () => {
    const plan = compileExecutionPlan({
      assembly: simulateProjectAssembly(catalog, fAutomaticOutcomeProject()),
    });
    expect(plan.rooms.flatMap((room) => room.trace)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'transcendentEmbryo',
          source: 'ChaosWeaponBlessing',
          target: 'ChaosElementalBlessing',
          rarity: 'Epic',
        }),
        expect.objectContaining({
          kind: 'steadyGrowth',
          source: 'BoonGrowthBoon',
          target: 'ApolloWeaponBoon',
        }),
      ]),
    );
  });

  it('requires the simulator-owned exact assembly at the compiler boundary', () => {
    const assembly = simulateProjectAssembly(catalog, fOnlyProject());
    expect(() =>
      compileExecutionPlan({
        assembly: { project: assembly.project, evaluation: assembly.evaluation },
      }),
    ).toThrow(/was not produced by this simulator execution/);
  });

  it('rejects malformed and unsupported wire values at the codec boundary', () => {
    expect(() => decodeExecutionPlan(malformedFixture)).toThrow(ExecutionPlanCodecError);
    expect(() => decodeExecutionPlan(unsupportedFixture)).toThrow(
      /unsupported execution protocol version/,
    );
    const plan = compileExecutionPlan({
      assembly: simulateProjectAssembly(catalog, fOnlyProject()),
    });
    expect(() => decodeExecutionPlan({ ...plan, protocolVersion: 1 })).toThrow(
      /unsupported execution protocol version/,
    );
    expect(() => decodeExecutionPlan({ ...plan, catalogVersion: 'old-catalog' })).toThrow(
      /unsupported execution catalog version/,
    );
    expect(() => decodeExecutionPlan({ ...plan, planFingerprint: 'not-a-fingerprint' })).toThrow(
      /planFingerprint/,
    );
    const opening = plan.rooms[0];
    if (opening === undefined || opening.outgoing.kind !== 'batch')
      throw new Error('opening batch is missing');
    const target = opening.outgoing.targets[0];
    if (target === undefined) throw new Error('opening target is missing');
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            outgoing: { ...opening.outgoing, targets: [{ ...target, index: '1' }] },
          },
        ],
      }),
    ).toThrow(/index/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            outgoing: { ...opening.outgoing, targets: [{ ...target, index: 17 }] },
          },
        ],
      }),
    ).toThrow(/index/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            outgoing: { ...opening.outgoing, targets: [{ ...target, picked: 1 }] },
          },
        ],
      }),
    ).toThrow(/picked/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            outgoing: { ...opening.outgoing, selectedExitKey: 'missing' },
          },
        ],
      }),
    ).toThrow(/select exactly one picked target/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            outgoing: {
              ...opening.outgoing,
              targets: [{ ...target, picked: false }],
            },
          },
        ],
      }),
    ).toThrow(/select exactly one picked target/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [{ ...plan.rooms[0], trace: [] }],
      }),
    ).toThrow(/trace/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...plan.rooms[0],
            trace: [{ ...opening.trace[0], owner: 'another-owner' }],
          },
        ],
      }),
    ).toThrow(/owner mismatch/);

    const entry = opening.trace.find((step) => step.kind === 'roomEntered');
    const acquisition = opening.trace.find((step) => step.kind === 'acquireReward');
    const encounterStart = opening.trace.find((step) => step.kind === 'encounterStart');
    if (
      entry?.kind !== 'roomEntered' ||
      acquisition?.kind !== 'acquireReward' ||
      encounterStart?.kind !== 'encounterStart'
    )
      throw new Error('opening trace is missing Gate C witnesses');
    const acquisitionRole = acquisition.roles[0];
    if (acquisitionRole?.traitOffer?.kind !== 'traits')
      throw new Error('opening acquisition is missing its ordinary trait offer');

    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === entry
                ? { ...entry, runState: { ...entry.runState, internalState: true } }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/unknown field internalState/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === entry
                ? { ...entry, runState: { ...entry.runState, owner: 'another-checkpoint' } }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/runState owner mismatch/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === acquisition
                ? {
                    ...acquisition,
                    roles: [{ ...acquisitionRole, internalRole: true }],
                  }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/unknown field internalRole/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === acquisition
                ? {
                    ...acquisition,
                    roles: [
                      {
                        ...acquisitionRole,
                        traitOffer: {
                          ...acquisitionRole.traitOffer,
                          selected: 'option4',
                        },
                      },
                    ],
                  }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/selected must identify a declared option/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === acquisition
                ? { ...acquisition, producerLifecycleKey: 'differentLifecycle' }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/must match reward provenance/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === encounterStart ? { ...encounterStart, phase: 'UnknownPhase' } : step,
            ),
          },
        ],
      }),
    ).toThrow(/declared encounter phase/);
    const differentSource = '["incomingReward","Underworld","F","another-occurrence"]';
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === acquisition
                ? {
                    ...acquisition,
                    owner: JSON.stringify([
                      'acquisitionRole',
                      'Underworld',
                      'F',
                      differentSource,
                      acquisitionRole.role,
                    ]),
                    sourceOwner: differentSource,
                  }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/does not belong to this room/);
    if (acquisitionRole.settlement === undefined)
      throw new Error('opening acquisition is missing settlement provenance');
    const wrongEntry = JSON.stringify([
      'acquisitionEntry',
      'Underworld',
      'F',
      acquisitionRole.settlement.site,
      'wrong-role',
    ]);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === acquisition
                ? {
                    ...acquisition,
                    roles: [
                      {
                        ...acquisitionRole,
                        settlement: { ...acquisitionRole.settlement, entry: wrongEntry },
                      },
                    ],
                  }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/entry does not match its site and role/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === encounterStart ? { ...encounterStart, flags: [] } : step,
            ),
          },
        ],
      }),
    ).toThrow(/unknown field flags/);
    expect(ExecutionCompilerError).toBeDefined();
  });
});
