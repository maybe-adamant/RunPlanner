import { describe, expect, it, vi } from 'vitest';

import {
  createGameStatusController,
  createTauriGameModuleHost,
} from '@planner/persistence/gameModuleHost';
import { createFakeGameModuleHost, gameModuleStatus } from '@planner-test/fixtures/gameModuleHost';

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
    await host.openExternalPage('https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/');

    expect(invoke.mock.calls).toEqual([
      ['game_module_status'],
      ['game_target_discover'],
      ['game_target_use_discovered', { path: '/profiles/h2-dev' }],
      ['game_module_install', { overwriteConsent: false }],
      ['game_module_install', { overwriteConsent: true }],
      ['game_module_install_from_checkout', { overwriteConsent: true }],
      ['game_module_remove'],
      ['game_plan_publish', { slotNumber: 3, planJson: '{"format":"run-planner-execution"}' }],
      ['external_open_url', { url: 'https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/' }],
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
  it('shares the latest host status with every subscriber', async () => {
    const game = createFakeGameModuleHost(gameModuleStatus({ bundledVersion: '0.3.0' }));
    const controller = createGameStatusController(game.host);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    expect(controller.getSnapshot()).toEqual({ status: null, error: null, readAt: 0 });
    await expect(controller.refresh()).resolves.toMatchObject({ bundledVersion: '0.3.0' });
    expect(controller.getSnapshot().status?.bundledVersion).toBe('0.3.0');
    expect(controller.getSnapshot().readAt).toBeGreaterThan(0);
    controller.publish(gameModuleStatus());
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    controller.publish(gameModuleStatus());
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps a newer publish or refresh over a late earlier refresh', async () => {
    const game = createFakeGameModuleHost();
    let resolveLate: (status: ReturnType<typeof gameModuleStatus>) => void = () => undefined;
    game.host.status.mockImplementationOnce(
      () => new Promise((resolve) => (resolveLate = resolve)),
    );
    const controller = createGameStatusController(game.host);
    const late = controller.refresh();
    controller.publish(gameModuleStatus({ bundledVersion: '0.6.0' }));
    resolveLate(gameModuleStatus({ bundledVersion: '0.1.0' }));
    await late;
    expect(controller.getSnapshot().status?.bundledVersion).toBe('0.6.0');

    game.host.status.mockImplementationOnce(
      () => new Promise((resolve) => (resolveLate = resolve)),
    );
    const earlier = controller.refresh();
    game.host.status.mockResolvedValueOnce(gameModuleStatus({ bundledVersion: '0.2.0' }));
    await controller.refresh();
    resolveLate(gameModuleStatus({ bundledVersion: '0.5.0' }));
    await earlier;
    expect(controller.getSnapshot().status?.bundledVersion).toBe('0.2.0');
  });

  it('reports a failed refresh without discarding the last status', async () => {
    const game = createFakeGameModuleHost(gameModuleStatus({ bundledVersion: '0.3.0' }));
    const controller = createGameStatusController(game.host);
    await controller.refresh();
    game.host.status.mockRejectedValueOnce(new Error('host unavailable'));
    await expect(controller.refresh()).rejects.toThrow('host unavailable');
    expect(controller.getSnapshot()).toMatchObject({
      error: 'host unavailable',
      status: { bundledVersion: '0.3.0' },
    });
  });
});
