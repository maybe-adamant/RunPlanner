// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createReleaseUpdateController,
  type ReleaseMetadata,
} from '@planner/persistence/releaseUpdates';
import { ReleaseUpdateCheck, ReleaseUpdateNotice } from '@planner/ui/shell/ReleaseUpdates';

afterEach(cleanup);

const release: ReleaseMetadata = {
  assets: [
    {
      browserDownloadUrl:
        'https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/RunPlanner-1.2.3-windows-x64-portable.zip',
      name: 'RunPlanner-1.2.3-windows-x64-portable.zip',
    },
    {
      browserDownloadUrl:
        'https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/RunPlanner-1.2.3-windows-x64-portable.zip.sha256',
      name: 'RunPlanner-1.2.3-windows-x64-portable.zip.sha256',
    },
  ],
  draft: false,
  htmlUrl: 'https://github.com/maybe-adamant/RunPlanner/releases/tag/v1.2.3',
  prerelease: false,
  tagName: 'v1.2.3',
};

function updates(metadata: ReleaseMetadata = release) {
  const controller = createReleaseUpdateController({
    buildIdentity: { build: 'abc123def456', commit: 'a'.repeat(40), version: '1.0.0' },
    host: { checkLatestRelease: vi.fn(() => Promise.resolve(metadata)), openDownload: vi.fn() },
    skipPreference: { read: () => undefined, write: vi.fn() },
  });
  if (controller === undefined) throw new Error('stable desktop build must support update checks');
  return controller;
}

describe('Release updates', () => {
  it('offers a manual result and a non-blocking later dismissal', async () => {
    const controller = updates();
    const user = userEvent.setup();
    render(
      <>
        <ReleaseUpdateCheck controller={controller} />
        <ReleaseUpdateNotice controller={controller} />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findAllByText('Run Planner 1.2.3 is available.')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('reports an incomplete newer release as unavailable when checked manually', async () => {
    const controller = updates({ ...release, assets: [] });
    const user = userEvent.setup();
    render(<ReleaseUpdateCheck controller={controller} />);

    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByText('Update check unavailable.')).toBeTruthy();
  });
});
