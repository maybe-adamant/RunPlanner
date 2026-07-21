import {
  applyProjectCommand,
  createBiomeAddress,
  createContinuationAddress,
  createLocalRewardAddress,
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

const hBiome = createBiomeAddress('Underworld', 'H');

function hPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'H');
  if (plan === undefined) {
    throw new Error('fixture has no H plan');
  }
  return plan;
}

function createHProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'h-authored-fixture',
    name: 'H Authored Fixture',
    configuredBiomeCounts: { Underworld: 3 },
  });
}

function startH(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: hBiome,
    occurrenceId: createOccurrenceId('h-start'),
    gameName: 'H_Intro',
  });
}

interface BatchTargetFixture {
  readonly gameName: string;
  readonly occurrenceId: OccurrenceId;
}

function appendBatch(
  project: ProjectDocument,
  parentOccurrenceId: OccurrenceId,
  targets: readonly BatchTargetFixture[],
  pickedExitIndex: number,
): ProjectDocument {
  let nextProject = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(hBiome, parentOccurrenceId),
  });
  for (const [index, target] of targets.entries()) {
    nextProject = applyProjectCommand(nextProject, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(hBiome, parentOccurrenceId, index + 1),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return applyProjectCommand(nextProject, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(hBiome, parentOccurrenceId),
    exitIndex: pickedExitIndex,
  });
}

function completeHProject(): ProjectDocument {
  const combat02 = createOccurrenceId('h-b1-combat02');
  const combat03 = createOccurrenceId('h-b2-combat03');
  const combat04 = createOccurrenceId('h-b2-combat04');
  const bridge = createOccurrenceId('h-b3-bridge');
  const miniboss = createOccurrenceId('h-b3-miniboss');
  const combat05 = createOccurrenceId('h-b4-combat05');
  const combat06 = createOccurrenceId('h-b4-combat06');

  let project = startH(createHProject());
  project = appendBatch(
    project,
    createOccurrenceId('h-start'),
    [{ gameName: 'H_Combat02', occurrenceId: combat02 }],
    1,
  );
  project = appendBatch(
    project,
    combat02,
    [
      { gameName: 'H_Combat03', occurrenceId: combat03 },
      { gameName: 'H_Combat04', occurrenceId: combat04 },
    ],
    1,
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceFieldsCageOutcome',
    continuation: createContinuationAddress(hBiome, combat02),
    cageOutcome: 'max',
  });
  project = appendBatch(
    project,
    combat03,
    [
      { gameName: 'H_Bridge01', occurrenceId: bridge },
      { gameName: 'H_MiniBoss01', occurrenceId: miniboss },
    ],
    1,
  );
  project = appendBatch(
    project,
    bridge,
    [
      { gameName: 'H_Combat05', occurrenceId: combat05 },
      { gameName: 'H_Combat06', occurrenceId: combat06 },
    ],
    1,
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(hBiome, combat05),
    targetOccurrenceIds: [
      createOccurrenceId('h-terminal-shop'),
      createOccurrenceId('h-terminal-free'),
    ],
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(hBiome, combat05),
    exitIndex: 1,
  });
}

describe('dormant H authored topology', () => {
  it('creates no-store Fields batches with complete cage defaults and semantic replacement', () => {
    let project = startH(createHProject());
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(hBiome, createOccurrenceId('h-start')),
    });

    const initialBatch = hPlan(project).topology?.continuations[0];
    expect(initialBatch).toMatchObject({
      kind: 'batch',
      rewardStore: { kind: 'none' },
      batchState: { cageOutcome: 'min' },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(hBiome, createOccurrenceId('h-start'), 1),
      occurrenceId: createOccurrenceId('h-combat'),
      gameName: 'H_Combat09',
    });
    const combatBefore = hPlan(project).topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === createOccurrenceId('h-combat'),
    );
    expect(combatBefore?.state).toMatchObject({
      kind: 'fieldsCombat',
      cages: {
        cage1: expect.any(Object),
        cage2: expect.any(Object),
        cage3: expect.any(Object),
      },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      continuation: createContinuationAddress(hBiome, createOccurrenceId('h-start')),
      cageOutcome: 'max',
    });
    const topology = hPlan(project).topology;
    expect(topology?.continuations[0]).toMatchObject({
      batchState: { cageOutcome: 'max' },
    });
    expect(
      topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === createOccurrenceId('h-combat'),
      )?.state,
    ).toEqual(combatBefore?.state);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceFieldsCageOutcome',
        continuation: createContinuationAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('not-a-fields-batch'),
        ),
        cageOutcome: 'max',
      }),
    ).toThrowError(ProjectCommandContractError);
  });

  it('replaces one addressed Fields cage reward without disturbing sibling leaves', () => {
    let project = startH(createHProject());
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(hBiome, createOccurrenceId('h-start')),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(hBiome, createOccurrenceId('h-start'), 1),
      occurrenceId: createOccurrenceId('h-combat'),
      gameName: 'H_Combat09',
    });
    const before = hPlan(project).topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === createOccurrenceId('h-combat'),
    );
    if (before?.state.kind !== 'fieldsCombat') {
      throw new Error('Fields combat fixture has no cage state');
    }

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(hBiome, createOccurrenceId('h-combat'), 'cages', 'cage2'),
      value: { rewardType: 'MaxHealthDrop' },
    });
    const after = hPlan(project).topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === createOccurrenceId('h-combat'),
    );
    expect(after?.state).toEqual({
      ...before.state,
      cages: { ...before.state.cages, cage2: { rewardType: 'MaxHealthDrop' } },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(hBiome, createOccurrenceId('h-combat'), 'cages', 'cage4'),
        value: { rewardType: 'MaxManaDrop' },
      }),
    ).toThrowError(ProjectCommandContractError);
  });

  it('closes the exact four-batch and seven-target H authored topology', () => {
    const project = completeHProject();
    const plan = hPlan(project);
    const result = evaluateLinearCompleteness(catalog, hBiome, plan);

    expect(
      plan.topology?.continuations.filter((continuation) => continuation.kind === 'batch'),
    ).toHaveLength(4);
    expect(
      plan.topology?.continuations
        .filter((continuation) => continuation.kind === 'batch')
        .flatMap((continuation) => continuation.targets),
    ).toHaveLength(7);
    expect(result).toMatchObject({ completion: 'complete', findings: [] });
    expect(plan.topology?.continuations.at(-1)).toMatchObject({
      kind: 'terminal',
      pickedExitIndex: 1,
      targets: [
        { exitIndex: 1, occurrenceId: 'h-terminal-shop' },
        { exitIndex: 2, occurrenceId: 'h-terminal-free' },
      ],
    });
    expect(
      plan.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === createOccurrenceId('h-terminal-shop'),
      )?.state,
    ).toMatchObject({ kind: 'shop', shop: expect.any(Object) });
  });

  it('rejects malformed H batch authorities and a fifth ordinary batch', () => {
    const valid = completeHProject();
    const raw = JSON.parse(encodeProjectDocument(valid)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{
          biomeKey: string;
          topology: { continuations: Array<Record<string, unknown>> } | null;
        }>;
      }>;
    };
    const h = raw.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H');
    if (h?.topology === null || h === undefined) {
      throw new Error('encoded H topology is missing');
    }
    const firstBatch = h.topology.continuations[0];
    if (firstBatch === undefined) {
      throw new Error('encoded H batch is missing');
    }

    firstBatch.rewardStore = { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' };
    expect(() => decodeProjectDocument(raw, catalog)).toThrowError(ProjectDocumentContractError);
    firstBatch.rewardStore = { kind: 'none' };
    firstBatch.batchState = null;
    expect(() => decodeProjectDocument(raw, catalog)).toThrowError(ProjectDocumentContractError);

    const terminalParent = createOccurrenceId('h-b4-combat05');
    const withoutTerminal = applyProjectCommand(valid, catalog, {
      kind: 'RemoveTerminalTransition',
      continuation: createContinuationAddress(hBiome, terminalParent),
    });
    expect(() =>
      applyProjectCommand(withoutTerminal, catalog, {
        kind: 'CreateBatch',
        continuation: createContinuationAddress(hBiome, terminalParent),
      }),
    ).toThrowError(ProjectCommandContractError);
  });
});
