import { describe, expect, it, vi } from 'vitest';

import {
  createTauriProfileFileAdapter,
  type TauriProfileFileEnvironment,
} from './tauriProfileFileAdapter';

function createEnvironment(overrides: Partial<TauriProfileFileEnvironment> = {}) {
  return {
    activate: vi.fn(() => Promise.resolve()),
    clearActive: vi.fn(() => Promise.resolve()),
    open: vi.fn(() => Promise.resolve<string | null>(null)),
    readTextFile: vi.fn(() => Promise.resolve('{}')),
    restoreActive: vi.fn(() => Promise.resolve(null)),
    save: vi.fn(() => Promise.resolve<string | null>(null)),
    writeActive: vi.fn(() => Promise.resolve()),
    writeTextFile: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

describe('Tauri profile-file adapter', () => {
  it('establishes a native target on first Save and overwrites it thereafter', async () => {
    const environment = createEnvironment({
      save: vi.fn(() => Promise.resolve('C:\\Plans\\surface.runplanner.json')),
    });
    const adapter = createTauriProfileFileAdapter(environment);

    expect(adapter.supportsSaveAs).toBe(true);
    const file = await adapter.saveAs('run-plan.runplanner.json', '{"version":1}');
    expect(file?.fileName).toBe('surface.runplanner.json');
    await file?.activate();
    await file?.write('{"version":2}');

    expect(environment.save).toHaveBeenCalledOnce();
    expect(environment.activate).toHaveBeenCalledWith('C:\\Plans\\surface.runplanner.json');
    expect(environment.writeTextFile).toHaveBeenNthCalledWith(
      1,
      'C:\\Plans\\surface.runplanner.json',
      '{"version":1}',
    );
    expect(environment.writeTextFile).toHaveBeenNthCalledWith(
      2,
      'C:\\Plans\\surface.runplanner.json',
      '{"version":2}',
    );
  });

  it('returns cancellation without writing a new file', async () => {
    const environment = createEnvironment();
    const adapter = createTauriProfileFileAdapter(environment);

    await expect(adapter.saveAs('run-plan.runplanner.json', '{}')).resolves.toBeNull();
    expect(environment.writeTextFile).not.toHaveBeenCalled();
  });

  it('loads a native file and retains that exact target for later writes', async () => {
    const environment = createEnvironment({
      open: vi.fn(() => Promise.resolve('/plans/underworld.runplanner.json')),
      readTextFile: vi.fn(() => Promise.resolve('{"route":"Underworld"}')),
    });
    const adapter = createTauriProfileFileAdapter(environment);

    const loaded = await adapter.load();
    expect(loaded?.file.fileName).toBe('underworld.runplanner.json');
    expect(loaded?.json).toBe('{"route":"Underworld"}');
    await loaded?.file.write('{"route":"updated"}');

    expect(environment.readTextFile).toHaveBeenCalledWith('/plans/underworld.runplanner.json');
    expect(environment.writeTextFile).toHaveBeenCalledWith(
      '/plans/underworld.runplanner.json',
      '{"route":"updated"}',
    );
  });

  it('returns cancellation without reading a file', async () => {
    const environment = createEnvironment();
    const adapter = createTauriProfileFileAdapter(environment);

    await expect(adapter.load()).resolves.toBeNull();
    expect(environment.readTextFile).not.toHaveBeenCalled();
  });

  it('restores the host-owned active target and writes through the native session', async () => {
    const environment = createEnvironment({
      restoreActive: vi.fn(() =>
        Promise.resolve({
          fileName: 'remembered.runplanner.json',
          json: '{"route":"Surface"}',
        }),
      ),
    });
    const adapter = createTauriProfileFileAdapter(environment);

    const restored = await adapter.restoreActive();
    expect(restored).toMatchObject({
      status: 'loaded',
      loaded: {
        file: { fileName: 'remembered.runplanner.json' },
        json: '{"route":"Surface"}',
      },
    });
    if (restored.status !== 'loaded') throw new Error('expected restored profile');
    await restored.loaded.file.write('{"route":"updated"}');

    expect(environment.writeActive).toHaveBeenCalledWith('{"route":"updated"}');
    expect(environment.writeTextFile).not.toHaveBeenCalled();
  });

  it('reports native restore failure without inventing an active target', async () => {
    const adapter = createTauriProfileFileAdapter(
      createEnvironment({
        restoreActive: vi.fn(() => Promise.reject(new Error('stale path'))),
      }),
    );

    await expect(adapter.restoreActive()).resolves.toEqual({
      status: 'failure',
      message: 'Could not restore the active profile: stale path',
    });
  });
});
