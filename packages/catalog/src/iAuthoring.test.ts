import {
  applyProjectCommand,
  createBiomeAddress,
  createBiomeFieldAddress,
  createContinuationAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  evaluateLinearCompleteness,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  type LinearBiomePlan,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const iBiome = createBiomeAddress('Underworld', 'I');

function createIProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'i-authored-fixture',
    name: 'I Authored Fixture',
    configuredBiomeCounts: { Underworld: 4 },
  });
}

function iPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'I');
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('fixture has no I plan');
  }
  return plan;
}

interface BatchTargetFixture {
  readonly gameName: string;
  readonly occurrenceId: OccurrenceId;
}

function appendBatch(
  project: ProjectDocument,
  parentOccurrenceId: OccurrenceId | null,
  targets: readonly BatchTargetFixture[],
  pickedExitIndex: number,
): ProjectDocument {
  let nextProject = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(iBiome, parentOccurrenceId),
  });
  for (const [index, target] of targets.entries()) {
    nextProject = applyProjectCommand(nextProject, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, parentOccurrenceId, index + 1),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return applyProjectCommand(nextProject, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(iBiome, parentOccurrenceId),
    exitIndex: pickedExitIndex,
  });
}

function completeIProject(): ProjectDocument {
  const combat01 = createOccurrenceId('i-b1-combat01');
  const declinedPreboss = createOccurrenceId('i-b2-preboss');
  const combat03 = createOccurrenceId('i-b2-combat03');
  const enteredPreboss = createOccurrenceId('i-b3-preboss');

  let project = appendBatch(
    createIProject(),
    null,
    [{ gameName: 'I_Combat01', occurrenceId: combat01 }],
    1,
  );
  project = appendBatch(
    project,
    combat01,
    [
      { gameName: 'I_PreBoss02', occurrenceId: declinedPreboss },
      { gameName: 'I_Combat03', occurrenceId: combat03 },
    ],
    2,
  );
  return appendBatch(
    project,
    combat03,
    [
      { gameName: 'I_PreBoss02', occurrenceId: enteredPreboss },
      { gameName: 'I_Combat02', occurrenceId: createOccurrenceId('i-b3-combat02') },
    ],
    1,
  );
}

describe('I authored topology', () => {
  it('persists the declaration-owned non-goal cap at the biome owner', () => {
    const original = createIProject();
    expect(iPlan(original)).toMatchObject({
      state: { maxNonGoalRewards: 3 },
      topology: null,
    });

    const project = applyProjectCommand(original, catalog, {
      kind: 'ReplaceBiomeField',
      field: createBiomeFieldAddress(iBiome, 'maxNonGoalRewards'),
      value: 6,
    });
    expect(iPlan(project).state).toEqual({ maxNonGoalRewards: 6 });
    expect(iPlan(original).state).toEqual({ maxNonGoalRewards: 3 });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceBiomeField',
        field: createBiomeFieldAddress(iBiome, 'maxNonGoalRewards'),
        value: 7,
      }),
    ).toThrowError(ProjectCommandContractError);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceBiomeField',
        field: createBiomeFieldAddress(iBiome, 'unknownField'),
        value: 3,
      }),
    ).toThrowError(ProjectCommandContractError);
  });

  it('owns the first decision after fixed Intro and Story without a fake occurrence', () => {
    const combat = createOccurrenceId('i-first-combat');
    const project = appendBatch(
      createIProject(),
      null,
      [{ gameName: 'I_Combat02', occurrenceId: combat }],
      1,
    );
    const topology = iPlan(project).topology;

    expect(topology).toMatchObject({
      startOccurrenceId: null,
      continuations: [
        {
          kind: 'batch',
          parentOccurrenceId: null,
          rewardStore: { kind: 'none' },
          batchState: null,
          targets: [{ exitIndex: 1, occurrenceId: combat }],
          pickedExitIndex: 1,
        },
      ],
    });
    expect(topology?.occurrences.map((occurrence) => occurrence.gameName)).toEqual(['I_Combat02']);

    const removed = applyProjectCommand(project, catalog, {
      kind: 'RemoveBatch',
      continuation: createContinuationAddress(iBiome, null),
    });
    expect(iPlan(removed).topology).toBeNull();

    expect(() =>
      applyProjectCommand(createIProject(), catalog, {
        kind: 'CreateStart',
        biome: iBiome,
        occurrenceId: createOccurrenceId('fake-story-owner'),
        gameName: 'I_Story01',
      }),
    ).toThrowError(ProjectCommandContractError);
  });

  it('retains repeated generated preboss offers and realizes only the picked shop', () => {
    const project = completeIProject();
    const plan = iPlan(project);
    const prebosses = plan.topology?.occurrences.filter(
      (occurrence) => occurrence.gameName === 'I_PreBoss02',
    );

    expect(prebosses).toHaveLength(2);
    expect(prebosses?.[0]?.state).toEqual({ kind: 'shop' });
    expect(prebosses?.[1]?.state).toMatchObject({ kind: 'shop', shop: expect.any(Object) });
    expect(
      plan.topology?.continuations.every((continuation) => continuation.kind === 'batch'),
    ).toBe(true);
    expect(evaluateLinearCompleteness(catalog, iBiome, plan)).toMatchObject({
      completion: 'complete',
      findings: [],
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTerminalTransition',
        continuation: createContinuationAddress(iBiome, createOccurrenceId('i-b3-preboss')),
        targetOccurrenceIds: [createOccurrenceId('synthetic-terminal')],
      }),
    ).toThrowError(ProjectCommandContractError);
  });

  it('replaces ordinary and generated-terminal targets in both directions', () => {
    const combat01 = createOccurrenceId('i-replace-combat01');
    const firstTarget = createOccurrenceId('i-replace-first-target');
    const pickedTarget = createOccurrenceId('i-replace-picked-target');
    let project = appendBatch(
      createIProject(),
      null,
      [{ gameName: 'I_Combat01', occurrenceId: combat01 }],
      1,
    );
    project = appendBatch(
      project,
      combat01,
      [
        { gameName: 'I_Combat03', occurrenceId: firstTarget },
        { gameName: 'I_Combat04', occurrenceId: pickedTarget },
      ],
      2,
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(iBiome, firstTarget),
      gameName: 'I_PreBoss02',
    });
    expect(
      iPlan(project).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === firstTarget,
      ),
    ).toMatchObject({ gameName: 'I_PreBoss02', state: { kind: 'shop' } });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(iBiome, firstTarget),
      gameName: 'I_Combat03',
    });
    expect(
      iPlan(project).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === firstTarget,
      ),
    ).toMatchObject({ gameName: 'I_Combat03', state: { kind: 'counted' } });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(iBiome, pickedTarget),
      gameName: 'I_PreBoss02',
    });
    expect(
      iPlan(project).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === pickedTarget,
      ),
    ).toMatchObject({
      gameName: 'I_PreBoss02',
      state: { kind: 'shop', shop: expect.any(Object) },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(iBiome, pickedTarget),
      gameName: 'I_Combat04',
    });
    expect(
      iPlan(project).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === pickedTarget,
      ),
    ).toMatchObject({ gameName: 'I_Combat04', state: { kind: 'counted' } });
  });

  it('reanchors ordinary downstream topology but does not silently discard it for a terminal pick', () => {
    const combat01 = createOccurrenceId('i-retain-combat01');
    const combat03 = createOccurrenceId('i-retain-combat03');
    const combat04 = createOccurrenceId('i-retain-combat04');
    const downstream = createOccurrenceId('i-retain-downstream');
    let project = appendBatch(
      createIProject(),
      null,
      [{ gameName: 'I_Combat01', occurrenceId: combat01 }],
      1,
    );
    project = appendBatch(
      project,
      combat01,
      [
        { gameName: 'I_Combat03', occurrenceId: combat03 },
        { gameName: 'I_Combat04', occurrenceId: combat04 },
      ],
      1,
    );
    project = appendBatch(
      project,
      combat03,
      [{ gameName: 'I_Combat02', occurrenceId: downstream }],
      1,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(iBiome, combat01),
      exitIndex: 2,
    });
    expect(iPlan(project).topology?.continuations.at(-1)?.parentOccurrenceId).toBe(combat04);
    expect(
      iPlan(project).topology?.occurrences.some((room) => room.occurrenceId === downstream),
    ).toBe(true);

    let terminalProject = appendBatch(
      createIProject(),
      null,
      [{ gameName: 'I_Combat01', occurrenceId: combat01 }],
      1,
    );
    terminalProject = appendBatch(
      terminalProject,
      combat01,
      [
        { gameName: 'I_PreBoss02', occurrenceId: createOccurrenceId('i-retain-preboss') },
        { gameName: 'I_Combat03', occurrenceId: combat03 },
      ],
      2,
    );
    terminalProject = appendBatch(
      terminalProject,
      combat03,
      [{ gameName: 'I_Combat02', occurrenceId: downstream }],
      1,
    );
    expect(() =>
      applyProjectCommand(terminalProject, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(iBiome, combat03),
        gameName: 'I_PreBoss02',
      }),
    ).toThrowError(ProjectCommandContractError);
    expect(() =>
      applyProjectCommand(terminalProject, catalog, {
        kind: 'SetPicked',
        picked: createPickedAddress(iBiome, combat01),
        exitIndex: 1,
      }),
    ).toThrowError(ProjectCommandContractError);
    expect(iPlan(terminalProject).topology?.continuations).toHaveLength(3);
  });

  it('rejects malformed biome and picked-shop state plus a thirteenth batch', () => {
    const raw = JSON.parse(encodeProjectDocument(createIProject())) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{ biomeKey: string; state: Record<string, unknown> }>;
      }>;
    };
    const i = raw.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'I');
    if (i === undefined) {
      throw new Error('encoded I plan is missing');
    }
    i.state.maxNonGoalRewards = 7;
    expect(() => decodeProjectDocument(raw, catalog)).toThrowError(ProjectDocumentContractError);

    const missingField = JSON.parse(encodeProjectDocument(createIProject())) as typeof raw;
    const missingI = missingField.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'I');
    if (missingI === undefined) {
      throw new Error('encoded I plan is missing');
    }
    delete missingI.state.maxNonGoalRewards;
    expect(() => decodeProjectDocument(missingField, catalog)).toThrowError(
      ProjectDocumentContractError,
    );

    const extraField = JSON.parse(encodeProjectDocument(createIProject())) as typeof raw;
    const extraI = extraField.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'I');
    if (extraI === undefined) {
      throw new Error('encoded I plan is missing');
    }
    extraI.state.duplicateAuthority = 3;
    expect(() => decodeProjectDocument(extraField, catalog)).toThrowError(
      ProjectDocumentContractError,
    );

    const completeRaw = JSON.parse(encodeProjectDocument(completeIProject())) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{
          biomeKey: string;
          topology: { occurrences: Array<{ occurrenceId: string; state: unknown }> } | null;
        }>;
      }>;
    };
    const completeI = completeRaw.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'I');
    const pickedPreboss = completeI?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'i-b3-preboss',
    );
    if (pickedPreboss === undefined) {
      throw new Error('encoded picked I preboss is missing');
    }
    pickedPreboss.state = { kind: 'shop' };
    expect(() => decodeProjectDocument(completeRaw, catalog)).toThrowError(
      ProjectDocumentContractError,
    );

    let bounded = createIProject();
    let parentOccurrenceId: OccurrenceId | null = null;
    for (let index = 1; index <= 12; index += 1) {
      const occurrenceId = createOccurrenceId(`i-bound-${index}`);
      bounded = appendBatch(
        bounded,
        parentOccurrenceId,
        [{ gameName: 'I_Combat02', occurrenceId }],
        1,
      );
      parentOccurrenceId = occurrenceId;
    }
    expect(() =>
      applyProjectCommand(bounded, catalog, {
        kind: 'CreateBatch',
        continuation: createContinuationAddress(iBiome, parentOccurrenceId),
      }),
    ).toThrowError(ProjectCommandContractError);

    let targetBounded = createIProject();
    let targetParent: OccurrenceId | null = null;
    for (let batchIndex = 1; batchIndex <= 11; batchIndex += 1) {
      const picked = createOccurrenceId(`i-target-bound-${batchIndex}-picked`);
      targetBounded = appendBatch(
        targetBounded,
        targetParent,
        [
          { gameName: 'I_Combat01', occurrenceId: picked },
          ...(batchIndex === 1
            ? []
            : [
                {
                  gameName: 'I_Combat01',
                  occurrenceId: createOccurrenceId(`i-target-bound-${batchIndex}-peer`),
                },
              ]),
        ],
        1,
      );
      targetParent = picked;
    }
    targetBounded = applyProjectCommand(targetBounded, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(iBiome, targetParent),
    });
    targetBounded = applyProjectCommand(targetBounded, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, targetParent, 1),
      occurrenceId: createOccurrenceId('i-target-bound-22'),
      gameName: 'I_Combat01',
    });
    expect(() =>
      applyProjectCommand(targetBounded, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(iBiome, targetParent, 2),
        occurrenceId: createOccurrenceId('i-target-bound-23'),
        gameName: 'I_Combat01',
      }),
    ).toThrowError(ProjectCommandContractError);
  });
});
