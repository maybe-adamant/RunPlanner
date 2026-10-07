import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createProjectDocument,
  createRoomFeatureAddress,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createStartingRewardAddress,
  createTraitOfferAddress,
} from '@run-planner/engine/authored-project';
import { authoringReadinessAt, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  createFProject,
  createFStart,
  createUnresolvedFOpeningBatch,
  fBiome,
  fStartId,
  fDecision,
} from './support/f-takeover-project';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';

const evaluate = (project: ReturnType<typeof createFProject>) =>
  simulateProjectAssembly(catalog, project);
const openingReward = createStartingRewardAddress('Underworld');
const openingTrait = createTraitOfferAddress(
  createIncomingRewardAddress(fBiome, fStartId),
  'source',
);

describe('first assessment issue', () => {
  it('advances from the opening offer to its outgoing decision and then the batch pool', () => {
    const repaired = createFStart();
    const missing = applyProjectCommand(repaired, catalog, {
      kind: 'ReplaceStartingReward',
      reward: openingReward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    const first = evaluate(missing);
    expect(first.evaluation.issue).toMatchObject({
      kind: 'incomplete',
      owner: openingTrait,
      reasons: [expect.objectContaining({ code: 'traitOfferMissing' })],
    });
    expect(first.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'batchRewardStoreMissing' }),
    );
    expect(authoringReadinessAt(first, openingTrait)).toBe('editable');
    expect(authoringReadinessAt(first, fDecision())).toBe('locked');

    // An absent decision reports the same next edit as its initial envelope.
    const absent = evaluate(repaired);
    expect(absent.evaluation.issue).toMatchObject({
      kind: 'incomplete',
      owner: createBatchRewardStoreAddress(fBiome, fDecision().source),
      reasons: [expect.objectContaining({ code: 'batchRewardStoreMissing' })],
    });
    const batch = evaluate(createUnresolvedFOpeningBatch(repaired));
    expect(batch.evaluation.issue).toEqual(absent.evaluation.issue);
    expect(
      authoringReadinessAt(batch, createBatchRewardStoreAddress(fBiome, fDecision().source)),
    ).toBe('editable');
    expect(evaluate(missing).evaluation.issue).toEqual(first.evaluation.issue);
  });

  it('keeps loadout ahead of every occurrence and publishes no issue for valid or empty routes', () => {
    const project = applyProjectCommand(createFStart(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'TempHammerKeepsake',
    });
    expect(evaluate(project).evaluation.issue).toMatchObject({
      kind: 'incomplete',
      owner: { kind: 'keepsakeEquipResult' },
      reasons: [expect.objectContaining({ code: 'keepsakeEquipResultMissing' })],
    });
    expect(evaluate(createCompleteFGProject()).evaluation.issue).toBeUndefined();
    const empty = createProjectDocument(catalog, {
      projectId: 'empty',
      routeKey: 'Underworld',
      configuredBiomeCount: 0,
    });
    expect(evaluate(empty).evaluation).toMatchObject({ status: 'empty' });
    expect(evaluate(empty).evaluation.issue).toBeUndefined();
  });

  it("ranks a picked host's resource placement at its Overview, ahead of its Timeline and doors", () => {
    let project = createFStart();
    for (const family of ['Pickaxe', 'Shovel'] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceResourcePlacement',
        route: createRouteAddress('Underworld'),
        family,
        value: { biomeKey: 'F', occurrenceId: fStartId },
      });
    const placement = createRoomFeatureAddress(createOccurrenceAddress(fBiome, fStartId), {
      kind: 'resource',
      family: 'Pickaxe',
    });
    // The placement is fixed on entry: it precedes the missing outgoing decision.
    expect(evaluate(project).evaluation.issue).toMatchObject({ kind: 'invalid', owner: placement });
    const missing = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: openingReward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    // It also precedes the room's own Timeline pickup, which stays unassessed.
    expect(evaluate(missing).evaluation.issue?.owner).toEqual(placement);
    expect(evaluate(missing).evaluation.findings).not.toContainEqual(
      expect.objectContaining({ origin: openingTrait }),
    );
  });
});
