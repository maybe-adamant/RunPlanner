import {
  applyProjectCommand,
  composeFHistory,
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
  evaluateFCompleteness,
  evaluateFRoomGeneration,
  materializeLinearBiome,
  type CompleteFCompletenessResult,
  type LinearBiomePlan,
  type ProjectDocument,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const biome = createBiomeAddress('Underworld', 'F');
const startId = createOccurrenceId('possibility-start');

interface BatchSpec {
  readonly targets: readonly string[];
  readonly pickedExitIndex: number;
}

const baselineBatches: readonly BatchSpec[] = [
  { targets: ['F_Combat02'], pickedExitIndex: 1 },
  { targets: ['F_Combat03', 'F_Combat03'], pickedExitIndex: 1 },
  { targets: ['F_Combat04', 'F_Combat04'], pickedExitIndex: 1 },
  { targets: ['F_Combat05', 'F_Combat11'], pickedExitIndex: 1 },
  { targets: ['F_Combat06', 'F_Combat06'], pickedExitIndex: 1 },
  { targets: ['F_MiniBoss01', 'F_MiniBoss02'], pickedExitIndex: 1 },
  { targets: ['F_Combat11'], pickedExitIndex: 1 },
  { targets: ['F_Combat12', 'F_Combat12'], pickedExitIndex: 1 },
  { targets: ['F_Combat14', 'F_Combat14'], pickedExitIndex: 1 },
  { targets: ['F_Combat15', 'F_Combat15'], pickedExitIndex: 1 },
];

function fPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0];
  if (plan?.biomeKey !== 'F') {
    throw new Error('missing F possibility fixture plan');
  }
  return plan;
}

function complete(project: ProjectDocument): CompleteFCompletenessResult {
  const result = evaluateFCompleteness(catalog, biome, fPlan(project));
  if (result.completion !== 'complete') {
    throw new Error(`possibility fixture is incomplete: ${result.findings[0]?.code}`);
  }
  return result;
}

function batchOccurrenceId(batchIndex: number, exitIndex: number) {
  return createOccurrenceId(`possibility-b${batchIndex}-e${exitIndex}`);
}

function possibilityProject(batches: readonly BatchSpec[] = baselineBatches): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'f-possibility',
    name: 'F Possibility',
    configuredBiomeCounts: { Underworld: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });

  let parentId = startId;
  batches.forEach((batch, batchOffset) => {
    const batchIndex = batchOffset + 1;
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, parentId),
    });
    batch.targets.forEach((gameName, targetOffset) => {
      const exitIndex = targetOffset + 1;
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, parentId, exitIndex),
        occurrenceId: batchOccurrenceId(batchIndex, exitIndex),
        gameName,
      });
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, parentId),
      exitIndex: batch.pickedExitIndex,
    });
    parentId = batchOccurrenceId(batchIndex, batch.pickedExitIndex);
  });

  const parent = catalog.rooms.byKey[batches.at(-1)!.targets[batches.at(-1)!.pickedExitIndex - 1]!];
  if (parent === undefined) {
    throw new Error('terminal fixture parent is missing');
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, parentId),
    targetOccurrenceIds: parent.exits.map((exit) =>
      createOccurrenceId(`possibility-terminal-e${exit.index}`),
    ),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, parentId),
    exitIndex: 1,
  });
}

function evaluate(project: ProjectDocument = possibilityProject()) {
  const snapshot = materializeLinearBiome(catalog, biome, complete(project));
  const history = composeFHistory(catalog, snapshot);
  return { snapshot, history, generation: evaluateFRoomGeneration(catalog, snapshot, history) };
}

function pressure(result: ReturnType<typeof evaluate>, batchIndex: number, exitIndex: number) {
  const target = createTargetAddress(
    biome,
    batchIndex === 1
      ? startId
      : batchOccurrenceId(batchIndex - 1, baselineBatches[batchIndex - 2]!.pickedExitIndex),
    exitIndex,
  );
  const entry = result.generation.forcePressure.find(
    (candidate) => JSON.stringify(candidate.targetOrigin) === JSON.stringify(target),
  );
  if (entry === undefined) {
    throw new Error(`missing pressure entry for batch ${batchIndex} exit ${exitIndex}`);
  }
  return entry;
}

describe('F room possibility and generation validation', () => {
  it('accepts positive-support rooms, peer repeats, and a later repeat of an unentered room', () => {
    const result = evaluate();
    const optionalWindow = pressure(result, 5, 1);
    const firstForced = pressure(result, 6, 1);
    const secondForced = pressure(result, 6, 2);
    const laterRepeat = pressure(result, 7, 1);
    const repeatedPeer = pressure(result, 3, 2);

    expect(result.generation.validity).toBe('valid');
    expect(result.generation.findings).toEqual([]);
    expect(optionalWindow).toMatchObject({
      selectedGameName: 'F_Combat06',
      selectedPossible: true,
      optionalForcedRoomGameNames: ['F_MiniBoss01', 'F_MiniBoss02', 'F_MiniBoss03', 'F_Shop01'],
      requiredForcedRoomGameNames: [],
      biomeDepthCache: 4,
      biomeEncounterDepth: 6,
    });
    expect(optionalWindow.supportRoomGameNames).toContain('F_Combat06');
    expect(firstForced).toMatchObject({
      selectedGameName: 'F_MiniBoss01',
      selectedPossible: true,
    });
    expect(firstForced.requiredForcedRoomGameNames).toEqual([
      'F_MiniBoss01',
      'F_MiniBoss02',
      'F_MiniBoss03',
      'F_Shop01',
    ]);
    expect(secondForced.requiredForcedRoomGameNames).not.toContain('F_MiniBoss01');
    expect(secondForced.requiredForcedRoomGameNames).toContain('F_MiniBoss02');
    expect(repeatedPeer).toMatchObject({
      selectedGameName: 'F_Combat04',
      selectedCreationCount: 1,
      selectedAppearanceCount: 0,
      selectedParentCreationCount: 1,
      selectedPossible: true,
    });
    expect(laterRepeat).toMatchObject({
      selectedGameName: 'F_Combat11',
      selectedCreationCount: 1,
      selectedAppearanceCount: 0,
      selectedParentCreationCount: 0,
      selectedPossible: true,
      selectedExclusionReasons: [],
    });
  });

  it('evaluates entered-miniboss mutual exclusion from the later target history', () => {
    const batches = baselineBatches.map((batch, index) => {
      if (index === 5) {
        return { targets: ['F_MiniBoss01', 'F_Combat20'], pickedExitIndex: 1 };
      }
      if (index === 6) {
        return { targets: ['F_MiniBoss02'], pickedExitIndex: 1 };
      }
      if (index === 7) {
        return { targets: [batch.targets[0]!], pickedExitIndex: 1 };
      }
      return batch;
    });
    const result = evaluate(possibilityProject(batches));
    const excluded = pressure(result, 7, 1);

    expect(excluded).toMatchObject({
      selectedGameName: 'F_MiniBoss02',
      selectedAppearanceCount: 0,
      selectedPossible: false,
      selectedExclusionReasons: ['eligibilityRequirement'],
    });
    expect(result.generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: excluded.targetOrigin,
      }),
    );
  });

  it('rejects an ordinary room when the required forced pool is active', () => {
    const batches = baselineBatches.map((batch, index) =>
      index === 5 ? { targets: ['F_Combat20', 'F_MiniBoss01'], pickedExitIndex: 2 } : batch,
    );
    const result = evaluate(possibilityProject(batches));
    const finding = result.generation.findings.find(
      (candidate) =>
        candidate.code === 'targetRoomUnavailable' &&
        candidate.origin.kind === 'target' &&
        candidate.origin.parentOccurrenceId === batchOccurrenceId(5, 1) &&
        candidate.origin.exitIndex === 1,
    );

    expect(result.generation.validity).toBe('invalid');
    expect(finding?.evidence).toMatchObject({
      selectedGameName: 'F_Combat20',
      exclusionReasons: ['forcedPool'],
    });
    expect(finding?.evidence.requiredForcedRoomGameNames).toContain('F_MiniBoss01');
    expect(finding?.evidence.supportRoomGameNames).not.toContain('F_Combat20');
  });

  it('separates creation caps from entered appearance caps', () => {
    const batches = baselineBatches.map((batch, index): BatchSpec => {
      if (index === 4) {
        return { targets: ['F_Combat06', 'F_Story01'], pickedExitIndex: 1 };
      }
      if (index === 7) {
        return { targets: ['F_Combat12', 'F_Story01'], pickedExitIndex: 1 };
      }
      if (index === 8) {
        return { targets: ['F_Combat14', 'F_Combat11'], pickedExitIndex: 1 };
      }
      return batch;
    });
    const result = evaluate(possibilityProject(batches));
    const unavailable = result.generation.findings.filter(
      (finding) => finding.code === 'targetRoomUnavailable',
    );

    expect(unavailable).toHaveLength(2);
    expect(unavailable.map((finding) => finding.evidence)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selectedGameName: 'F_Story01',
          selectedCreationCount: 1,
          selectedAppearanceCount: 0,
          exclusionReasons: ['maxCreationsThisRun'],
        }),
        expect.objectContaining({
          selectedGameName: 'F_Combat11',
          selectedCreationCount: 2,
          selectedAppearanceCount: 1,
          exclusionReasons: ['maxAppearancesThisBiome'],
        }),
      ]),
    );
  });

  it('preserves retained overflow for semantic physical-exit validation', () => {
    let project = possibilityProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, batchOccurrenceId(7, 1)),
      gameName: 'F_Combat10',
    });
    const result = evaluate(project);
    const overflow = result.snapshot.batches[7]!.targets[1]!;
    const finding = result.generation.findings.find(
      (candidate) =>
        candidate.code === 'targetRoomUnavailable' &&
        candidate.origin.kind === 'target' &&
        candidate.origin.exitIndex === 2 &&
        candidate.origin.parentOccurrenceId === batchOccurrenceId(7, 1),
    );

    expect(overflow.exit).toEqual({ kind: 'unavailable', index: 2 });
    expect(finding?.evidence.exclusionReasons).toContain('physicalExitUnavailable');
  });

  it('rejects a snapshot whose source identity is newer than its supplied history', () => {
    const baseline = evaluate();
    const project = applyProjectCommand(possibilityProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, startId),
      gameName: 'F_Opening02',
    });
    const snapshot = materializeLinearBiome(catalog, biome, complete(project));

    expect(() => evaluateFRoomGeneration(catalog, snapshot, baseline.history)).toThrowError(
      /source .* does not match its history appearance/,
    );
  });

  it('rejects a snapshot whose target identity is newer than its supplied history', () => {
    const baseline = evaluate();
    const project = applyProjectCommand(possibilityProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, batchOccurrenceId(2, 2)),
      gameName: 'F_Combat04',
    });
    const snapshot = materializeLinearBiome(catalog, biome, complete(project));

    expect(() => evaluateFRoomGeneration(catalog, snapshot, baseline.history)).toThrowError(
      /target .* does not match its history creation/,
    );
  });

  it('reaches the terminal at the declared depth without treating force maximum as a ceiling', () => {
    const result = evaluate();
    const terminal = result.generation.forcePressure.slice(-2);

    expect(terminal.map((entry) => entry.beforeSequence)).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
    expect(terminal.every((entry) => entry.selectedGameName === 'F_PreBoss01')).toBe(true);
    expect(terminal.every((entry) => entry.biomeDepthCache === 10)).toBe(true);
    expect(terminal.every((entry) => entry.selectedPossible)).toBe(true);
    expect(
      terminal.every((entry) => entry.requiredForcedRoomGameNames.includes('F_PreBoss01')),
    ).toBe(true);
    expect(result.history.rooms.at(-4)?.preOutgoing?.ledgers.counters.biomeDepthCache).toBe(10);
  });
});
