import { describe, expect, it, vi } from 'vitest';

import {
  createTauriProfileFileAdapter,
  type TauriProfileFileEnvironment,
} from './tauriProfileFileAdapter';

function createEnvironment(overrides: Partial<TauriProfileFileEnvironment> = {}) {
  return {
    open: vi.fn(() => Promise.resolve<string | null>(null)),
    readTextFile: vi.fn(() => Promise.resolve('{}')),
    save: vi.fn(() => Promise.resolve<string | null>(null)),
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

    const file = await adapter.saveAs('run-plan.runplanner.json', '{"version":1}');
    expect(file?.fileName).toBe('surface.runplanner.json');
    await file?.write('{"version":2}');

    expect(environment.save).toHaveBeenCalledOnce();
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
});
