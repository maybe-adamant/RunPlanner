import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createLevelResolutionAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';

import { createKeepsakeState } from '../../src/simulation/keepsakes';
import { applyJeweledPomEquipResult } from '../../src/simulation/rewards/processing';
import { selectedTraitOfferProducts } from '../../src/simulation/rewards/selected-trait-products';
import {
  createTraitHistoryState,
  type ReachedLevelResolutionEvaluation,
} from '../../src/simulation/traits';
import { initializeTestRewardBranches } from '../support/arcana-fear';

describe('selected trait products', () => {
  it('retains divergent reached level-resolution publication and candidate contexts', () => {
    const address = createLevelResolutionAddress(
      {
        kind: 'incomingReward',
        routeKey: 'Underworld',
        biomeKey: 'F',
        occurrenceId: createOccurrenceId('test'),
      },
      'self',
    );
    const retained: readonly ReachedLevelResolutionEvaluation[] = Object.freeze([
      Object.freeze({
        address,
        value: Object.freeze({
          kind: 'choice',
          offeredTraitKeys: Object.freeze([]),
          selectedTraitKey: null,
        }),
        findings: Object.freeze(['missingTarget'] as const),
        levelCount: 1,
        effectKind: 'choice',
        emptyTargetAllowed: false,
        chronologicalIndex: 1,
        before: Object.freeze({ ...createTraitHistoryState(), upgradableTraitCount: 1 }),
        reached: true,
      }),
      Object.freeze({
        address,
        value: Object.freeze({
          kind: 'choice',
          offeredTraitKeys: Object.freeze([]),
          selectedTraitKey: null,
        }),
        findings: Object.freeze(['missingTarget', 'wrongOfferCount'] as const),
        levelCount: 2,
        effectKind: 'choice',
        emptyTargetAllowed: false,
        chronologicalIndex: 2,
        before: Object.freeze({ ...createTraitHistoryState(), upgradableTraitCount: 2 }),
        reached: true,
      }),
    ]);
    const products = selectedTraitOfferProducts(Object.freeze([]), retained);
    expect(products.selectedLevelResolutions).toEqual([
      expect.objectContaining({
        address,
        chronologicalIndex: 1,
        branches: [
          expect.objectContaining({ findings: ['missingTarget'], eligibleTargetCount: 1 }),
          expect.objectContaining({
            findings: ['missingTarget', 'wrongOfferCount'],
            eligibleTargetCount: 2,
          }),
        ],
      }),
    ]);
    expect(products.levelCandidateContexts.get(semanticAddressKey(address))).toEqual([
      expect.objectContaining({ address, levelCount: 1, effectKind: 'choice' }),
      expect.objectContaining({ address, levelCount: 2, effectKind: 'choice' }),
    ]);
  });

  it('publishes Hades Last Gasp’s direct runtime fallback without changing the simulated acquisition', () => {
    const seeded = initializeTestRewardBranches()[0]!;
    const branch = Object.freeze({
      ...seeded,
      keepsakes: createKeepsakeState(catalog, 'HadesAndPersephoneKeepsake', seeded.arcanaFear),
    });
    const result = createKeepsakeEquipResultAddress(
      createRouteStartKeepsakeSelectionAddress('Underworld'),
      'jeweledPom',
    );
    const equipped = applyJeweledPomEquipResult(
      catalog,
      branch,
      'HadesAndPersephoneKeepsake',
      { jeweledPom: { traitKey: 'HadesDeathDefianceDamageBoon' } },
      result,
      1,
    );
    expect(equipped.traitHistory?.equippedTraits.HadesDeathDefianceDamageBoon).toBeDefined();
    expect(equipped.traitHistory?.equippedTraits.HadesLifestealBoon).toBeUndefined();
    expect(selectedTraitOfferProducts([equipped]).runtimeOfferFallbacks).toEqual([
      expect.objectContaining({
        address: result,
        preferredKey: 'HadesDeathDefianceDamageBoon',
        fallbackKey: 'HadesLifestealBoon',
      }),
    ]);
  });
});
