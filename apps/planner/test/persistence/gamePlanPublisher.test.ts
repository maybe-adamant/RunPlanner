import { describe, expect, it, vi } from 'vitest';

import { createTauriGamePlanPublisher } from '@planner/persistence/gamePlanPublisher';

describe('Tauri game-plan publisher adapter', () => {
  it('uses the fixed native discovery and publication commands', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ status: 'available', targets: [], message: 'Choose a profile.' })
      .mockResolvedValueOnce({ status: 'published', message: 'Published.' });
    const publisher = createTauriGamePlanPublisher({ invoke });
    const compatibility = {
      format: 'run-planner-execution',
      protocolVersion: 42,
      catalogVersion: 'test-catalog',
    };

    await expect(publisher.discoverProfiles(compatibility)).resolves.toMatchObject({
      status: 'available',
    });
    await expect(
      publisher.publish('profile-a', 3, '{"format":"run-planner-execution"}'),
    ).resolves.toMatchObject({
      status: 'published',
    });
    expect(invoke).toHaveBeenNthCalledWith(1, 'game_plan_discover_profiles', { compatibility });
    expect(invoke).toHaveBeenNthCalledWith(2, 'game_plan_publish', {
      targetId: 'profile-a',
      slotNumber: 3,
      planJson: '{"format":"run-planner-execution"}',
    });
  });
});
