import { describe, expect, it } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';

describe('reward child interaction composition', () => {
  it('publishes each interaction family under unique stable keys', () => {
    const { interactions } = support.bind(support.createGoldenFGHIProject(), 'Underworld', 'F');
    const families = [
      interactions.rewards,
      interactions.acquisitionConversions,
      interactions.traitOffers,
      interactions.levelResolutions,
      interactions.steadyGrowth,
      interactions.judgmentArcana,
      interactions.keepsakeSelections,
      interactions.keepsakeEquipResults,
    ];
    for (const family of families) {
      expect(new Set(family.keys()).size).toBe(family.size);
    }
    expect(interactions.rewards.size).toBeGreaterThan(0);
    expect(interactions.traitOffers.size).toBeGreaterThan(0);
  });
});
