import { describe, expect, it } from 'vitest';

import { workspaceRewardStoreLabel } from '@planner/projections/structured-workspace/assembly/reward-labels';

describe('workspaceRewardStoreLabel', () => {
  it('preserves declaration keys without a presentation label', () => {
    expect(workspaceRewardStoreLabel('HubRewards')).toBe('HubRewards');
  });
});
