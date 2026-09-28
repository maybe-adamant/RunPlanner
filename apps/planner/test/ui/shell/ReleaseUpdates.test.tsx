// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createReleaseUpdateController,
  type AvailableUpdate,
  type ReleaseUpdateHost,
  type SaveBeforeInstall,
} from '@planner/persistence/releaseUpdates';
import type { UpdateInstallLabel } from '@planner/projections/releaseUpdate';
import { ReleaseUpdateCheck, ReleaseUpdateNotice } from '@planner/ui/shell/ReleaseUpdates';

afterEach(cleanup);

function updates(
  update: AvailableUpdate | null = { version: '1.2.3' },
  installUpdate = vi.fn<ReleaseUpdateHost['installUpdate']>(() => new Promise(() => undefined)),
  saveBeforeInstall = vi.fn<SaveBeforeInstall>(() =>
    Promise.resolve({ status: 'success', message: 'Saved.' }),
  ),
) {
  const controller = createReleaseUpdateController({
    buildIdentity: { build: 'abc123def456', commit: 'a'.repeat(40), version: '1.0.0' },
    host: { checkForUpdate: vi.fn(() => Promise.resolve(update)), installUpdate },
    saveBeforeInstall,
    skipPreference: { read: () => undefined, write: vi.fn() },
  });
  if (controller === undefined) throw new Error('stable desktop build must support update checks');
  return { controller, installUpdate, saveBeforeInstall };
}

function renderUpdates(
  controller: ReturnType<typeof updates>['controller'],
  installLabel: UpdateInstallLabel = 'Install and restart',
) {
  render(
    <>
      <ReleaseUpdateCheck controller={controller} />
      <ReleaseUpdateNotice controller={controller} installLabel={installLabel} />
    </>,
  );
}

describe('Release updates', () => {
  it('offers a manual result and a non-blocking later dismissal', async () => {
    const { controller } = updates();
    const user = userEvent.setup();
    renderUpdates(controller);

    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findAllByText('Run Planner 1.2.3 is available.')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  });

  it('installs only after the user confirms the restart', async () => {
    const { controller, installUpdate } = updates();
    const user = userEvent.setup();
    renderUpdates(controller);

    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    await user.click(await screen.findByRole('button', { name: 'Update' }));
    expect(installUpdate).not.toHaveBeenCalled();
    expect(screen.getByText(/Run Planner closes, installs the update and reopens/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));
    await user.click(screen.getByRole('button', { name: 'Install and restart' }));
    expect(installUpdate).toHaveBeenCalledExactlyOnceWith('1.2.3');
  });

  it('saves unsaved changes first and reports a cancelled save without installing', async () => {
    const { controller, installUpdate, saveBeforeInstall } = updates(
      { version: '1.2.3' },
      undefined,
      vi.fn<SaveBeforeInstall>(() =>
        Promise.resolve({
          status: 'cancelled',
          message: 'Update cancelled; the project was not saved.',
        }),
      ),
    );
    const user = userEvent.setup();
    renderUpdates(controller, 'Save and install…');

    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    await user.click(await screen.findByRole('button', { name: 'Update' }));
    await user.click(screen.getByRole('button', { name: 'Save and install…' }));
    expect(saveBeforeInstall).toHaveBeenCalledOnce();
    expect(installUpdate).not.toHaveBeenCalled();
    expect(await screen.findByText(/Update cancelled; the project was not saved\./)).toBeTruthy();
  });

  it('reports a failed install with a retry', async () => {
    const { controller, installUpdate } = updates(
      { version: '1.2.3' },
      vi.fn<ReleaseUpdateHost['installUpdate']>(() => Promise.reject(new Error('signature'))),
    );
    const user = userEvent.setup();
    renderUpdates(controller);

    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    await user.click(await screen.findByRole('button', { name: 'Update' }));
    await user.click(screen.getByRole('button', { name: 'Install and restart' }));
    expect(await screen.findAllByText('Run Planner 1.2.3 could not be installed.')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Check for updates' })).toHaveProperty(
      'disabled',
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(installUpdate).toHaveBeenCalledTimes(2);
  });

  it('reports a current build when checked manually', async () => {
    const { controller } = updates(null);
    const user = userEvent.setup();
    renderUpdates(controller);

    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByText('You are up to date.')).toBeTruthy();
  });
});
