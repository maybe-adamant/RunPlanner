import { describe, expect, it } from 'vitest';

import { workspaceRewardStoreLabel } from '@planner/projections/structured-workspace/assembly/reward-labels';

describe('workspaceRewardStoreLabel', () => {
  it('presents the ordinary stores in player-facing language', () => {
    expect(workspaceRewardStoreLabel('RunProgress')).toBe('Major Reward');
    expect(workspaceRewardStoreLabel('MetaProgress')).toBe('Minor Reward');
    expect(workspaceRewardStoreLabel('TartarusRewards')).toBe('Tartarus Reward');
  });

  it('preserves declaration keys without a presentation label', () => {
    expect(workspaceRewardStoreLabel('HubRewards')).toBe('HubRewards');
  });
});
