import { describe, expect, it, vi } from 'vitest';

import {
  assessRelease,
  compareStableVersions,
  createReleaseUpdateController,
  type ReleaseMetadata,
} from '@planner/persistence/releaseUpdates';

const release = (version = '1.2.3'): ReleaseMetadata => {
  const archive = `RunPlanner-${version}-windows-x64-portable.zip`;
  return {
    assets: [
      {
        browserDownloadUrl: `https://github.com/maybe-adamant/RunPlanner/releases/download/v${version}/${archive}`,
        name: archive,
      },
      {
        browserDownloadUrl: `https://github.com/maybe-adamant/RunPlanner/releases/download/v${version}/${archive}.sha256`,
        name: `${archive}.sha256`,
      },
    ],
    draft: false,
    htmlUrl: `https://github.com/maybe-adamant/RunPlanner/releases/tag/v${version}`,
    prerelease: false,
    tagName: `v${version}`,
  };
};

function controller(metadata: ReleaseMetadata, skipped?: string) {
  const checkLatestRelease = vi.fn(() => Promise.resolve(metadata));
  const openDownload = vi.fn(() => Promise.resolve());
  const write = vi.fn();
  const updates = createReleaseUpdateController({
    buildIdentity: { build: 'abc123def456', commit: 'a'.repeat(40), version: '1.0.0' },
    host: { checkLatestRelease, openDownload },
    skipPreference: { read: () => skipped, write },
  });
  if (updates === undefined) throw new Error('stable build must support update checks');
  return { checkLatestRelease, openDownload, updates, write };
}

describe('release update policy', () => {
  it('compares only stable safe SemVer versions', () => {
    expect(compareStableVersions('1.10.0', '1.2.9')).toBeGreaterThan(0);
    expect(compareStableVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareStableVersions('1.2.3-beta.1', '1.2.3')).toBeUndefined();
    expect(compareStableVersions('999999999999999999999.0.0', '1.0.0')).toBeUndefined();
  });

  it('requires a newer stable release with both official portable assets', () => {
    expect(assessRelease(release(), '1.0.0')).toMatchObject({
      kind: 'available',
      release: { version: '1.2.3' },
    });
    expect(assessRelease(release('1.0.0'), '1.0.0')).toEqual({ kind: 'current' });
    expect(assessRelease({ ...release(), assets: release().assets.slice(0, 1) }, '1.0.0')).toEqual({
      kind: 'unavailable',
    });
    expect(
      assessRelease(
        {
          ...release(),
          assets: [
            {
              ...release().assets[0]!,
              browserDownloadUrl: 'https://example.com/archive.zip',
            },
            release().assets[1]!,
          ],
        },
        '1.0.0',
      ),
    ).toEqual({ kind: 'unavailable' });
  });

  it('runs automatic checks once, suppresses a skipped version, and lets manual checks bypass it', async () => {
    const fixture = controller(release(), '1.2.3');
    fixture.updates.checkAutomatically();
    fixture.updates.checkAutomatically();
    const manualCheck = fixture.updates.checkManually();
    await manualCheck;
    expect(fixture.checkLatestRelease).toHaveBeenCalledTimes(1);
    expect(fixture.updates.getSnapshot()).toMatchObject({
      kind: 'available',
      release: { version: '1.2.3' },
    });
    fixture.updates.skip();
    expect(fixture.write).toHaveBeenCalledWith('1.2.3');
  });

  it('queues a manual result when an automatic check has already settled silently', async () => {
    const fixture = controller(release(), '1.2.3');
    fixture.updates.checkAutomatically();
    await Promise.resolve();

    await fixture.updates.checkManually();
    expect(fixture.checkLatestRelease).toHaveBeenCalledTimes(2);
    expect(fixture.updates.getSnapshot()).toMatchObject({
      kind: 'available',
      release: { version: '1.2.3' },
    });
  });

  it('makes malformed newer releases and failed manual checks explicitly unavailable', async () => {
    const malformed = controller({ ...release(), assets: [] });
    await malformed.updates.checkManually();
    expect(malformed.updates.getSnapshot()).toEqual({ kind: 'unavailable' });

    const unavailable = createReleaseUpdateController({
      buildIdentity: { build: 'abc123def456', commit: 'a'.repeat(40), version: '1.0.0' },
      host: {
        checkLatestRelease: () => Promise.reject(new Error('offline')),
        openDownload: () => Promise.resolve(),
      },
      skipPreference: { read: () => undefined, write: () => undefined },
    });
    if (unavailable === undefined) throw new Error('stable build must support update checks');
    await unavailable.checkManually();
    expect(unavailable.getSnapshot()).toEqual({ kind: 'unavailable' });
  });
});
