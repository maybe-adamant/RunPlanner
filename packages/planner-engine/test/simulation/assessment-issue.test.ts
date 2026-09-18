import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createIncomingRewardAddress,
  createProjectDocument,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
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
const openingReward = createIncomingRewardAddress(fBiome, fStartId);
const openingTrait = createTraitOfferAddress(openingReward, 'source');

describe('first assessment issue', () => {
  it('advances from the opening offer to its outgoing decision and then the batch pool', () => {
    const repaired = createFStart();
    const missing = applyProjectCommand(repaired, catalog, {
      kind: 'ReplaceIncomingReward',
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
      expect.objectContaining({ code: 'continuationMissing' }),
    );
    expect(authoringReadinessAt(first, openingTrait)).toBe('editable');
    expect(authoringReadinessAt(first, fDecision())).toBe('locked');

    expect(evaluate(repaired).evaluation.issue).toMatchObject({
      kind: 'incomplete',
      owner: fDecision(),
      reasons: [expect.objectContaining({ code: 'continuationMissing' })],
    });
    const batch = evaluate(createUnresolvedFOpeningBatch(repaired));
    expect(batch.evaluation.issue).toMatchObject({
      kind: 'incomplete',
      owner: createBatchRewardStoreAddress(fBiome, fDecision().source),
      reasons: [expect.objectContaining({ code: 'batchRewardStoreMissing' })],
    });
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

  it('keeps the actual structural prerequisite when a resource host has not reached exit', () => {
    let project = createFStart();
    for (const family of ['Pickaxe', 'Shovel'] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceResourcePlacement',
        route: createRouteAddress('Underworld'),
        family,
        value: { biomeKey: 'F', occurrenceId: fStartId },
      });
    // A missing outgoing decision has not reached the exit effect yet.
    expect(evaluate(project).evaluation.issue?.owner).toEqual(fDecision());
    const missing = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: openingReward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    expect(evaluate(missing).evaluation.issue?.owner).toEqual(openingTrait);
  });
});
