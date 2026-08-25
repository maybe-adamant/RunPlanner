import { describe, expect, it } from 'vitest';

import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';

import { addRewardFinding, rewardFinding } from '../../../src/simulation/rewards/findings';
import type { FindingRegionEntry } from '../../../src/simulation/finding-regions';

describe('reward finding identity', () => {
  it('deduplicates reordered evidence while retaining same-code distinct evidence', () => {
    const origin = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('processing-finding-owner'),
    );
    const first = rewardFinding('rewardBagEntryUnavailable', origin, {
      detail: 'first',
      nested: { right: 2, left: 1 },
    });
    const reordered = rewardFinding('rewardBagEntryUnavailable', origin, {
      nested: { left: 1, right: 2 },
      detail: 'first',
    });
    const distinct = rewardFinding('rewardBagEntryUnavailable', origin, {
      detail: 'second',
      nested: { left: 1, right: 2 },
    });
    const findings = new Map<string, FindingRegionEntry>();

    addRewardFinding(findings, first);
    addRewardFinding(findings, reordered);
    addRewardFinding(findings, distinct);

    expect(findings.size).toBe(2);
    expect([...findings.values()].map((entry) => entry.finding)).toEqual([reordered, distinct]);
  });
});
