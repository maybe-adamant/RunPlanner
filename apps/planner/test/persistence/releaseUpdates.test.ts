import { describe, expect, it, vi } from 'vitest';

import {
  createReleaseUpdateController,
  createTauriReleaseUpdateHost,
  type AvailableUpdate,
  type ReleaseUpdateHost,
  type SaveBeforeInstall,
} from '@planner/persistence/releaseUpdates';

const buildIdentity = { build: 'abc123def456', commit: 'a'.repeat(40), version: '1.0.0' };
// A successful install closes the application, so its promise never settles.
const installsAndExits: ReleaseUpdateHost['installUpdate'] = () => new Promise(() => undefined);
const saved: SaveBeforeInstall = () => Promise.resolve({ status: 'success', message: 'Saved.' });

function controller(
  check: ReleaseUpdateHost['checkForUpdate'] = () => Promise.resolve({ version: '1.2.3' }),
  options: {
    readonly install?: ReleaseUpdateHost['installUpdate'];
    readonly save?: SaveBeforeInstall;
    readonly skipped?: string;
  } = {},
) {
  const checkForUpdate = vi.fn(check);
  const installUpdate = vi.fn(options.install ?? installsAndExits);
  const saveBeforeInstall = vi.fn(options.save ?? saved);
  const write = vi.fn();
  const updates = createReleaseUpdateController({
    buildIdentity,
    host: { checkForUpdate, installUpdate },
    saveBeforeInstall,
    skipPreference: { read: () => options.skipped, write },
  });
  if (updates === undefined) throw new Error('stable build must support update checks');
  return { checkForUpdate, installUpdate, saveBeforeInstall, updates, write };
}

async function confirming(fixture: ReturnType<typeof controller>) {
  await fixture.updates.checkManually();
  fixture.updates.requestInstall();
  expect(fixture.updates.getSnapshot()).toEqual({ kind: 'confirming', version: '1.2.3' });
}

describe('release update policy', () => {
  it('offers checks only to stable official builds', () => {
    const host = { checkForUpdate: vi.fn(), installUpdate: vi.fn() };
    const skipPreference = { read: () => undefined, write: vi.fn() };
    for (const version of ['Development', '1.2.3-rc.1']) {
      expect(
        createReleaseUpdateController({
          buildIdentity: { build: 'b', version },
          host,
          saveBeforeInstall: saved,
          skipPreference,
        }),
      ).toBeUndefined();
    }
  });

  it('binds the updater commands', async () => {
    const invoke = vi.fn(() => Promise.resolve(null)) as unknown as Parameters<
      typeof createTauriReleaseUpdateHost
    >[0];
    const host = createTauriReleaseUpdateHost(invoke);
    await host.checkForUpdate();
    await host.installUpdate('1.2.3');
    expect(invoke).toHaveBeenNthCalledWith(1, 'release_update_check');
    expect(invoke).toHaveBeenNthCalledWith(2, 'release_update_install', { version: '1.2.3' });
  });

  it('announces an available update from the automatic check exactly once', async () => {
    const fixture = controller();
    fixture.updates.checkAutomatically();
    fixture.updates.checkAutomatically();
    await vi.waitFor(() =>
      expect(fixture.updates.getSnapshot()).toEqual({ kind: 'available', version: '1.2.3' }),
    );
    expect(fixture.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('keeps an automatic check silent when current or failing, and reports manual results', async () => {
    const current = controller(() => Promise.resolve(null));
    current.updates.checkAutomatically();
    await Promise.resolve();
    expect(current.updates.getSnapshot()).toEqual({ kind: 'idle' });
    await current.updates.checkManually();
    expect(current.updates.getSnapshot()).toEqual({ kind: 'current' });

    const failing = controller(() => Promise.reject(new Error('offline')));
    failing.updates.checkAutomatically();
    await Promise.resolve();
    expect(failing.updates.getSnapshot()).toEqual({ kind: 'idle' });
    await failing.updates.checkManually();
    expect(failing.updates.getSnapshot()).toEqual({ kind: 'unavailable' });

    const malformed = controller(() => Promise.resolve({ version: '1.2.3-rc.1' }));
    await malformed.updates.checkManually();
    expect(malformed.updates.getSnapshot()).toEqual({ kind: 'unavailable' });
  });

  it('suppresses a skipped version automatically while manual checks bypass it', async () => {
    const fixture = controller(undefined, { skipped: '1.2.3' });
    fixture.updates.checkAutomatically();
    await Promise.resolve();
    expect(fixture.updates.getSnapshot()).toEqual({ kind: 'idle' });

    await fixture.updates.checkManually();
    expect(fixture.checkForUpdate).toHaveBeenCalledTimes(2);
    expect(fixture.updates.getSnapshot()).toEqual({ kind: 'available', version: '1.2.3' });
    fixture.updates.skip();
    expect(fixture.write).toHaveBeenCalledWith('1.2.3');
    expect(fixture.updates.getSnapshot()).toEqual({ kind: 'idle' });
  });

  it('dismisses for the session without persisting', async () => {
    const fixture = controller();
    await fixture.updates.checkManually();
    fixture.updates.later();
    expect(fixture.updates.getSnapshot()).toEqual({ kind: 'idle' });
    expect(fixture.write).not.toHaveBeenCalled();
    expect(fixture.installUpdate).not.toHaveBeenCalled();
  });

  it('saves, then installs, only after explicit confirmation', async () => {
    const fixture = controller();
    await fixture.updates.checkManually();
    await fixture.updates.confirmInstall();
    expect(fixture.saveBeforeInstall).not.toHaveBeenCalled();
    expect(fixture.installUpdate).not.toHaveBeenCalled();

    fixture.updates.requestInstall();
    fixture.updates.cancelInstall();
    expect(fixture.updates.getSnapshot()).toEqual({ kind: 'available', version: '1.2.3' });
    expect(fixture.installUpdate).not.toHaveBeenCalled();

    fixture.updates.requestInstall();
    void fixture.updates.confirmInstall();
    expect(fixture.updates.getSnapshot()).toEqual({ kind: 'saving', version: '1.2.3' });
    await vi.waitFor(() =>
      expect(fixture.updates.getSnapshot()).toEqual({ kind: 'installing', version: '1.2.3' }),
    );
    expect(fixture.saveBeforeInstall).toHaveBeenCalledOnce();
    expect(fixture.installUpdate).toHaveBeenCalledExactlyOnceWith('1.2.3');
    expect(fixture.saveBeforeInstall.mock.invocationCallOrder[0]).toBeLessThan(
      fixture.installUpdate.mock.invocationCallOrder[0]!,
    );
  });

  it('cancels the install when the save is cancelled, fails or throws', async () => {
    for (const [save, message] of [
      [
        () =>
          Promise.resolve({
            status: 'cancelled' as const,
            message: 'Update cancelled; the project was not saved.',
          }),
        'Update cancelled; the project was not saved.',
      ],
      [
        () => Promise.resolve({ status: 'failure' as const, message: 'Not saved: disk full' }),
        'Not saved: disk full',
      ],
      [
        () => Promise.reject(new Error('dialog closed')),
        'Not saved, so not updated: dialog closed',
      ],
    ] as const) {
      const fixture = controller(undefined, { save });
      await confirming(fixture);
      await fixture.updates.confirmInstall();
      expect(fixture.installUpdate).not.toHaveBeenCalled();
      expect(fixture.updates.getSnapshot()).toEqual({
        kind: 'available',
        version: '1.2.3',
        message,
      });
    }
  });

  it('reports a failed install, retries it, and allows a fresh manual check', async () => {
    let attempt = 0;
    const fixture = controller(() => Promise.resolve({ version: '1.2.3' }), {
      install: () =>
        attempt++ === 0 ? Promise.reject(new Error('bad signature')) : installsAndExits('1.2.3'),
    });
    await confirming(fixture);
    await fixture.updates.confirmInstall();
    expect(fixture.updates.getSnapshot()).toEqual({ kind: 'installFailed', version: '1.2.3' });

    void fixture.updates.confirmInstall();
    await vi.waitFor(() => expect(fixture.installUpdate).toHaveBeenCalledTimes(2));
    expect(fixture.saveBeforeInstall).toHaveBeenCalledTimes(2);

    const failed = controller(undefined, { install: () => Promise.reject(new Error('offline')) });
    await confirming(failed);
    await failed.updates.confirmInstall();
    await failed.updates.checkManually();
    expect(failed.checkForUpdate).toHaveBeenCalledTimes(2);
    expect(failed.updates.getSnapshot()).toEqual({ kind: 'available', version: '1.2.3' });
  });

  it('offers the pending version when the confirmed one was superseded', async () => {
    const superseded = controller(undefined, {
      install: () => Promise.resolve({ version: '1.2.4' }),
    });
    await confirming(superseded);
    await superseded.updates.confirmInstall();
    expect(superseded.updates.getSnapshot()).toEqual({ kind: 'available', version: '1.2.4' });

    const withdrawn = controller(undefined, { install: () => Promise.resolve(null) });
    await confirming(withdrawn);
    await withdrawn.updates.confirmInstall();
    expect(withdrawn.updates.getSnapshot()).toEqual({ kind: 'current' });
  });

  it('does not let a late check result replace a pending confirmation', async () => {
    let resolveLate: (update: AvailableUpdate | null) => void = () => undefined;
    const responses = [
      Promise.resolve<AvailableUpdate | null>({ version: '1.2.3' }),
      new Promise<AvailableUpdate | null>((resolve) => (resolveLate = resolve)),
    ];
    const fixture = controller(() => responses.shift()!);
    await fixture.updates.checkManually();
    fixture.updates.checkAutomatically();
    fixture.updates.requestInstall();
    resolveLate({ version: '1.2.4' });
    await vi.waitFor(() => expect(fixture.checkForUpdate).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(fixture.updates.getSnapshot()).toEqual({ kind: 'confirming', version: '1.2.3' });
  });
});
