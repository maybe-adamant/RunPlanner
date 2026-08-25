import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { supportedFieldsCageOutcomes } from '../../src/simulation/generation/fields-cage';

function fieldsPolicy() {
  const layout = catalog.biomeLayouts.byKey.H;
  if (
    layout?.progression.kind !== 'generated' ||
    layout.progression.batchPolicy.kind !== 'fields'
  ) {
    throw new Error('H lost its Fields batch policy');
  }
  return layout.progression.batchPolicy;
}

describe('Fields cage outcome support', () => {
  it('keeps the declaration-owned optional, required, and exhausted Max support matrix', () => {
    const policy = fieldsPolicy();
    const optionalDepth = policy.maxOutcomeSupport.optionalBiomeDepths[0];
    const requiredDepth = policy.maxOutcomeSupport.requiredBiomeDepths[0];
    if (optionalDepth === undefined || requiredDepth === undefined) {
      throw new Error('Fields declaration lost its outcome depth matrix');
    }

    expect(supportedFieldsCageOutcomes(policy, optionalDepth, 0)).toEqual(['min', 'max']);
    expect(supportedFieldsCageOutcomes(policy, requiredDepth, 0)).toEqual(['max']);
    expect(supportedFieldsCageOutcomes(policy, optionalDepth, policy.maxDoorCageCeiling)).toEqual([
      'min',
    ]);
  });
});
