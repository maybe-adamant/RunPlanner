import { describe, expect, it, vi } from 'vitest';

import { createTauriGamePlanPublisher } from './gamePlanPublisher';

describe('Tauri game-plan publisher adapter', () => {
  it('uses the fixed native discovery and publication commands', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ status: 'available', targets: [], message: 'Choose a profile.' })
      .mockResolvedValueOnce({ status: 'published', message: 'Published.' });
    const publisher = createTauriGamePlanPublisher({ invoke });

    await expect(publisher.discoverProfiles()).resolves.toMatchObject({ status: 'available' });
    await expect(
      publisher.publish('profile-a', '{"format":"run-planner-execution"}'),
    ).resolves.toMatchObject({
      status: 'published',
    });
    expect(invoke).toHaveBeenNthCalledWith(1, 'game_plan_discover_profiles');
    expect(invoke).toHaveBeenNthCalledWith(2, 'game_plan_publish', {
      targetId: 'profile-a',
      planJson: '{"format":"run-planner-execution"}',
    });
  });
});
