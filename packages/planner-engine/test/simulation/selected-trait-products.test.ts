import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createDefaultAuthoredHexTree,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';

import { selectedTraitOfferProducts } from '../../src/simulation/rewards/biome/selected-trait-products';
import {
  createTraitHistoryState,
  type ReachedLevelResolutionEvaluation,
} from '../../src/simulation/traits';
import { createTestArcanaFearState } from '../support/arcana-fear';
import { maybeAddGodSent } from '../../src/simulation/hex-progress';
import { initializeRewardBranches } from '../../src/simulation/rewards/processing';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement';

describe('selected trait products', () => {
  it('retains absent Spell God Sent evidence when a later same-biome keepsake adds it', () => {
    const origin = createIncomingRewardAddress(
      { kind: 'biome', routeKey: 'Underworld', biomeKey: 'F' },
      createOccurrenceId('spell'),
    );
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const offer = {
      kind: 'traits' as const,
      giverKey: 'SpellDrop',
      options: [
        { traitKey: 'SpellPolymorphTrait' },
        { traitKey: 'SpellMeteorTrait' },
        { traitKey: 'SpellTransformTrait' },
      ] as const,
      selectedOptionKey: 'option1' as const,
      hexTree: createDefaultAuthoredHexTree(catalog, 'SpellPolymorphTrait', 'Lung'),
      rarificationActions: [] as const,
    };
    const spell = settleEncounterTraitOffer(catalog, initial, origin, offer, 1, 'pickup').branch;
    expect(spell.hexProgress.godSentAdded).toBe(false);
    const laterKeepsake = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;
    const late = maybeAddGodSent(catalog, {
      ...spell,
      keepsakes: { ...spell.keepsakes, olympianSources: laterKeepsake.keepsakes.olympianSources },
    });
    expect(late.hexProgress.godSentAdded).toBe(true);
    expect(
      selectedTraitOfferProducts([late]).selectedTraitOffers[0]?.branches[0]?.settledHexTree,
    ).not.toHaveProperty('godSent');
  });

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
});
