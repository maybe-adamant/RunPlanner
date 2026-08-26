import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createOccurrenceAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { evaluateBiomeRoomGeneration, materializeBiome } from '@run-planner/engine/simulation';
import {
  createFGenerationProject,
  fGenerationBaselineBatches,
  fGenerationBiome,
  fGenerationOccurrenceId,
  fGenerationStartId,
  fGenerationTargetAddress,
  type FGenerationBatchSpec,
} from './support/f-generation-project';
import { complete, evaluate, pressure, traitContext } from './support/f-generation-evaluation';

describe('normal target generation support', () => {
  it('accepts positive-support rooms, peer repeats, and a later repeat of an unentered room', () => {
    const result = evaluate();
    const optionalWindow = pressure(result, fGenerationBaselineBatches, 5, 1);
    const firstForced = pressure(result, fGenerationBaselineBatches, 6, 1);
    const secondForced = pressure(result, fGenerationBaselineBatches, 6, 2);
    const laterRepeat = pressure(result, fGenerationBaselineBatches, 7, 1);
    const repeatedPeer = pressure(result, fGenerationBaselineBatches, 3, 2);

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
    const batches = fGenerationBaselineBatches.map((batch, index): FGenerationBatchSpec => {
      if (index === 5)
        return {
          targets: ['F_MiniBoss01', 'F_Combat20'],
          pickedExitIndex: 1,
          ...(batch.offers === undefined ? {} : { offers: batch.offers }),
        };
      if (index === 6)
        return {
          targets: ['F_MiniBoss02'],
          pickedExitIndex: 1,
          offers: [
            { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
          ],
        };
      if (index === 7)
        return {
          targets: [batch.targets[0]!],
          pickedExitIndex: 1,
          ...(batch.offers === undefined ? {} : { offers: batch.offers }),
        };
      return batch;
    });
    const result = evaluate(createFGenerationProject(batches));
    const excluded = pressure(result, batches, 7, 1);

    expect(excluded).toMatchObject({
      selectedGameName: 'F_MiniBoss02',
      selectedAppearanceCount: 0,
      selectedPossible: false,
      selectedExclusionReasons: ['eligibilityRequirement'],
    });
    expect(result.generation.findings).toContainEqual(
      expect.objectContaining({ code: 'targetRoomUnavailable', origin: excluded.targetOrigin }),
    );
  });

  it('rejects an ordinary room when the required forced pool is active', () => {
    const batches = fGenerationBaselineBatches.map((batch, index) =>
      index === 5
        ? {
            targets: ['F_Combat20', 'F_MiniBoss01'],
            pickedExitIndex: 2,
            ...(batch.offers === undefined ? {} : { offers: batch.offers }),
          }
        : batch,
    );
    const result = evaluate(createFGenerationProject(batches));
    const target = fGenerationTargetAddress(batches, 6, 1);
    const finding = result.generation.findings.find(
      (candidate) =>
        candidate.code === 'targetRoomUnavailable' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(target),
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
    const batches = fGenerationBaselineBatches.map((batch, index): FGenerationBatchSpec => {
      if (index === 4)
        return {
          targets: ['F_Combat06', 'F_Story01'],
          pickedExitIndex: 1,
          storeKey: 'MetaProgress',
          offers: [{ rewardType: 'MetaCurrencyDrop' }, undefined],
        };
      if (index === 7)
        return {
          targets: ['F_Combat12', 'F_Story01'],
          pickedExitIndex: 1,
          offers: [{ rewardType: 'WeaponUpgrade' }, undefined],
        };
      if (index === 8)
        return {
          targets: ['F_Combat14', 'F_Combat11'],
          pickedExitIndex: 1,
          storeKey: 'MetaProgress',
          ...(batch.offers === undefined ? {} : { offers: batch.offers }),
        };
      return batch;
    });
    const result = evaluate(createFGenerationProject(batches));
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
  it('rejects a snapshot whose source identity is newer than its supplied history', () => {
    const baseline = evaluate();
    const project = applyProjectCommand(createFGenerationProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fGenerationBiome, fGenerationStartId),
      gameName: 'F_Opening02',
    });
    const snapshot = materializeBiome(
      catalog,
      fGenerationBiome,
      complete(project),
      traitContext(project),
    );

    expect(() =>
      evaluateBiomeRoomGeneration(
        catalog,
        snapshot,
        baseline.history,
        1,
        baseline.rewards.targetHistory,
      ),
    ).toThrowError(/source .* does not match its history appearance/);
  });

  it('rejects a snapshot whose target identity is newer than its supplied history', () => {
    const baseline = evaluate();
    const project = applyProjectCommand(createFGenerationProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fGenerationBiome, fGenerationOccurrenceId(2, 2)),
      gameName: 'F_Combat04',
    });
    const snapshot = materializeBiome(
      catalog,
      fGenerationBiome,
      complete(project),
      traitContext(project),
    );

    expect(() =>
      evaluateBiomeRoomGeneration(
        catalog,
        snapshot,
        baseline.history,
        1,
        baseline.rewards.targetHistory,
      ),
    ).toThrowError(/target .* does not match its history creation/);
  });
});
