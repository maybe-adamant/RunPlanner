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
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  type LinearBiomePlan,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { evaluateLinearCompleteness } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

const iBiome = createBiomeAddress('Underworld', 'I');

function createIProject(): ProjectDocument {
  const project = createProjectDocument(catalog, {
    projectId: 'i-authored-fixture',
    name: 'I Authored Fixture',
    configuredBiomeCounts: { Underworld: 4 },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: iBiome,
    occurrenceId: createOccurrenceId('i-intro'),
    gameName: 'I_Intro',
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
  const resolvedParentOccurrenceId =
    parentOccurrenceId ?? iPlan(project).topology?.startOccurrenceId ?? null;
  let nextProject = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(iBiome, resolvedParentOccurrenceId),
  });
  for (const [index, target] of targets.entries()) {
    nextProject = applyProjectCommand(nextProject, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, resolvedParentOccurrenceId, index + 1),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return applyProjectCommand(nextProject, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(iBiome, resolvedParentOccurrenceId),
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
  it('round-trips schema v7 with one authored Clockwork roll outcome', () => {
    const project = createIProject();
    expect(PROJECT_DOCUMENT_SCHEMA_VERSION).toBe(7);
    expect(iPlan(project)).toMatchObject({
      state: { maxNonGoalRewards: 3 },
      topology: { startOccurrenceId: 'i-intro' },
    });
    expect(encodeProjectDocument(project)).toContain('maxNonGoalRewards');
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

    const legacy = JSON.parse(encodeProjectDocument(project)) as { schemaVersion: number };
    legacy.schemaVersion = 6;
    expect(() => decodeProjectDocument(legacy, catalog)).toThrowError(
      /schemaVersion: expected 7, received 6/,
    );
    const replaced = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBiomeField',
      field: createBiomeFieldAddress(iBiome, 'maxNonGoalRewards'),
      value: 6,
    });
    expect(iPlan(replaced).state).toEqual({ maxNonGoalRewards: 6 });
  });

  it('owns Entrance as an authored start and anchors the first decision to it', () => {
    const combat = createOccurrenceId('i-first-combat');
    const project = appendBatch(
      createIProject(),
      null,
      [{ gameName: 'I_Combat02', occurrenceId: combat }],
      1,
    );
    const topology = iPlan(project).topology;

    expect(topology).toMatchObject({
      startOccurrenceId: 'i-intro',
      continuations: [
        {
          kind: 'batch',
          parentOccurrenceId: 'i-intro',
          rewardStore: { kind: 'none' },
          batchState: null,
          targets: [{ exitIndex: 1, occurrenceId: combat }],
          pickedExitIndex: 1,
        },
      ],
    });
    expect(topology?.occurrences.map((occurrence) => occurrence.gameName)).toEqual([
      'I_Intro',
      'I_Combat02',
    ]);

    const removed = applyProjectCommand(project, catalog, {
      kind: 'RemoveBatch',
      continuation: createContinuationAddress(iBiome, createOccurrenceId('i-intro')),
    });
    expect(iPlan(removed).topology?.continuations).toEqual([]);

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

  it('rejects malformed biome and picked-shop state beyond the declared bounds', () => {
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
    for (let index = 1; index <= 13; index += 1) {
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
    targetBounded = applyProjectCommand(targetBounded, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, targetParent, 2),
      occurrenceId: createOccurrenceId('i-target-bound-23'),
      gameName: 'I_Combat01',
    });
    targetBounded = applyProjectCommand(targetBounded, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(iBiome, targetParent),
      exitIndex: 1,
    });
    targetBounded = applyProjectCommand(targetBounded, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(iBiome, createOccurrenceId('i-target-bound-22')),
    });
    expect(() =>
      applyProjectCommand(targetBounded, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(iBiome, createOccurrenceId('i-target-bound-22'), 1),
        occurrenceId: createOccurrenceId('i-target-bound-24'),
        gameName: 'I_Combat01',
      }),
    ).toThrowError(ProjectCommandContractError);
  });
});
