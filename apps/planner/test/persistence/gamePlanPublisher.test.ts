import { describe, expect, it, vi } from 'vitest';

import { createTauriGamePlanPublisher } from '@planner/persistence/gamePlanPublisher';

describe('Tauri game-plan publisher adapter', () => {
  it('uses the fixed native discovery and publication commands', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ status: 'available', targets: [], message: 'Choose a profile.' })
      .mockResolvedValueOnce({ status: 'published', message: 'Published.' });
    const publisher = createTauriGamePlanPublisher({ invoke, chooseDirectory: vi.fn() });
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

  it('validates a chosen directory and treats cancellation as a no-op', async () => {
    const target = { id: '/profiles/custom', label: 'custom', moduleVersion: '1' };
    const invoke = vi.fn().mockResolvedValue(target);
    const chooseDirectory = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('/profiles/custom/ReturnOfModding');
    const publisher = createTauriGamePlanPublisher({ invoke, chooseDirectory });
    const compatibility = {
      format: 'run-planner-execution',
      protocolVersion: 43,
      catalogVersion: 'test-catalog',
    };
    expect(await publisher.chooseProfile(compatibility)).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    expect(await publisher.chooseProfile(compatibility)).toEqual(target);
    expect(invoke).toHaveBeenCalledWith('game_plan_choose_profile', {
      path: '/profiles/custom/ReturnOfModding',
      compatibility,
    });
    invoke.mockRejectedValueOnce(new Error('Incompatible module'));
    chooseDirectory.mockResolvedValueOnce('/invalid');
    await expect(publisher.chooseProfile(compatibility)).rejects.toThrow('Incompatible module');
  });
});
