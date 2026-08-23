import { catalog } from '@run-planner/hades2-catalog';
import {
  createOccurrenceId,
  createOccurrenceAddress,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  blockedOccurrenceRoomForProjectEvaluationAssembly,
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  loadSurfaceNNaturalSelectionFrontierCheckpoint,
  loadSurfaceNQueensRansomCheckpoint,
  loadSurfaceNSteadyGrowthFrontierCheckpoint,
} from './surface';
import {
  createSurfaceNNaturalSelectionFrontier,
  createSurfaceNQueensRansomCheckpoint,
  createSurfaceNSteadyGrowthFrontier,
} from '../routes/run-impacting-traits';

describe('run-impacting trait checkpoint recipes', () => {
  it('attests each saved checkpoint to its semantic-command recipe', () => {
    for (const [saved, built] of [
      [loadSurfaceNNaturalSelectionFrontierCheckpoint(), createSurfaceNNaturalSelectionFrontier()],
      [loadSurfaceNQueensRansomCheckpoint(), createSurfaceNQueensRansomCheckpoint()],
      [loadSurfaceNSteadyGrowthFrontierCheckpoint(), createSurfaceNSteadyGrowthFrontier()],
    ] as const) {
      expect(encodeProjectDocument(saved)).toBe(encodeProjectDocument(built));
    }
  });

  it('reaches a selected Natural Selection child as the exact repair frontier', () => {
    const assembly = simulateProjectAssembly(catalog, createSurfaceNNaturalSelectionFrontier());
    const finding = assembly.evaluation.findings.find(
      (candidate) => candidate.code === 'naturalSelectionResultMissing',
    );
    expect(finding?.origin).toMatchObject({
      kind: 'naturalSelectionResult',
      optionKey: 'option1',
      trait: { owner: { occurrenceId: 'surface-n-miniBoss01' } },
    });
  });

  it("settles Queen's Ransom and continues through the complete N route", () => {
    const assembly = simulateProjectAssembly(catalog, createSurfaceNQueensRansomCheckpoint());
    expect(assembly.evaluation.findings).toEqual([]);
    const histories = assembly.evaluation.routes.flatMap((route) =>
      route.biomes.flatMap((biome) =>
        'rewards' in biome
          ? biome.rewards.branches.flatMap((branch) => branch.traitHistory ?? [])
          : [],
      ),
    );
    expect(
      histories.some((history) => {
        const removals = history.events.filter((event) => event.kind === 'traitRemoval');
        const mutations = history.events.filter((event) => event.kind === 'levelMutation');
        return (
          removals.some((event) => event.traitKey === 'ZeusWeaponBoon') &&
          removals.some((event) => event.traitKey === 'ZeusCastBoon') &&
          mutations.some(
            (event) =>
              event.targetTraitKey === 'HeraSpecialBoon' &&
              event.oldLevel === 1 &&
              event.newLevel === 9,
          )
        );
      }),
    ).toBe(true);
  });

  it('settles one Epic Steady Growth threshold and reaches the next real N owner', () => {
    const assembly = simulateProjectAssembly(catalog, createSurfaceNSteadyGrowthFrontier());
    const findings = assembly.evaluation.findings.filter(
      (candidate) => candidate.code === 'steadyGrowthOutcomeMissing',
    );
    const histories = assembly.evaluation.routes.flatMap((route) =>
      route.biomes.flatMap((biome) =>
        'rewards' in biome
          ? biome.rewards.branches.flatMap((branch) => branch.traitHistory ?? [])
          : [],
      ),
    );
    expect(histories).toHaveLength(1);
    expect(findings).toHaveLength(1);
    const outcome = findings[0]?.origin;
    expect(outcome).toMatchObject({
      kind: 'steadyGrowthOutcome',
      owner: { kind: 'occurrence', occurrenceId: 'surface-n-combat11-sideDoor1' },
      phaseKey: 'Encounter',
    });
    if (outcome?.kind !== 'steadyGrowthOutcome') throw new Error('Steady outcome is missing');
    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'steadyGrowthOutcome',
        outcome,
        targetTraitKey: undefined,
      }),
    ).toMatchObject({ kind: 'steadyGrowthOutcome' });
    expect(
      blockedOccurrenceRoomForProjectEvaluationAssembly(
        assembly,
        createOccurrenceAddress(
          { kind: 'biome', routeKey: 'Surface', biomeKey: 'N' },
          createOccurrenceId('surface-n-combat11-sideDoor1'),
        ),
      )?.origin,
    ).toMatchObject({ kind: 'occurrence', occurrenceId: 'surface-n-combat11-sideDoor1' });
    expect(
      histories[0]?.events.some(
        (event) =>
          event.kind === 'rarityMutation' &&
          event.targetTraitKey === 'ApolloWeaponBoon' &&
          event.oldRarity === 'Common' &&
          event.newRarity === 'Rare',
      ),
    ).toBe(true);
  });
});
