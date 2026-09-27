import { describe, expect, it, vi } from 'vitest';

import { createTauriGameModuleHost } from '@planner/persistence/gameModuleHost';

describe('Tauri game module host adapter', () => {
  it('invokes the fixed native target, module and publication commands', async () => {
    const invoke = vi.fn().mockResolvedValue({});
    const host = createTauriGameModuleHost({ invoke, chooseDirectory: vi.fn() });

    await host.status();
    await host.discoverTargets();
    await host.useDiscoveredTarget('/profiles/h2-dev');
    await host.install(false);
    await host.install(true);
    await host.installFromCheckout(true);
    await host.remove();
    await host.publish(3, '{"format":"run-planner-execution"}');

    expect(invoke.mock.calls).toEqual([
      ['game_module_status'],
      ['game_target_discover'],
      ['game_target_use_discovered', { path: '/profiles/h2-dev' }],
      ['game_module_install', { overwriteConsent: false }],
      ['game_module_install', { overwriteConsent: true }],
      ['game_module_install_from_checkout', { overwriteConsent: true }],
      ['game_module_remove'],
      ['game_plan_publish', { slotNumber: 3, planJson: '{"format":"run-planner-execution"}' }],
    ]);
  });

  it('picks a folder separately from establishing it and forgets without a path', async () => {
    const invoke = vi.fn().mockResolvedValue({ target: { kind: 'manual' } });
    const chooseDirectory = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('/games/Hades II/Ship');
    const host = createTauriGameModuleHost({ invoke, chooseDirectory });

    expect(await host.pickTargetFolder()).toBeNull();
    expect(await host.pickTargetFolder()).toBe('/games/Hades II/Ship');
    expect(invoke).not.toHaveBeenCalled();
    expect(await host.useChosenTarget('/games/Hades II/Ship')).toEqual({
      target: { kind: 'manual' },
    });
    await host.validateTarget('/games/Hades II/Ship', 'manual');
    await host.forgetTarget();
    expect(invoke.mock.calls).toEqual([
      ['game_target_choose', { path: '/games/Hades II/Ship' }],
      ['game_target_validate', { path: '/games/Hades II/Ship', kind: 'manual' }],
      ['game_target_clear'],
    ]);
    invoke.mockRejectedValueOnce(new Error('No ReturnOfModding folder found.'));
    await expect(host.useChosenTarget('/invalid')).rejects.toThrow(
      'No ReturnOfModding folder found.',
    );
  });
});
