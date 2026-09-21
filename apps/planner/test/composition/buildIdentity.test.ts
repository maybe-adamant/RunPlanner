import { describe, expect, it } from 'vitest';

import { createBuildIdentity } from '@planner/composition/buildIdentity';

const commit = '0123456789abcdef0123456789abcdef01234567';

describe('build identity', () => {
  it('creates an immutable official release identity from validated release metadata', () => {
    const identity = createBuildIdentity({
      commit,
      officialRelease: 'true',
      releaseVersion: '1.2.3',
    });

    expect(identity).toEqual({ build: '0123456789ab', commit, version: '1.2.3' });
    expect(Object.isFrozen(identity)).toBe(true);
  });

  it.each([
    { commit, releaseVersion: undefined },
    { commit, releaseVersion: '1.2.3-beta.1' },
    { commit: undefined, releaseVersion: '1.2.3' },
    { commit: '01234567', releaseVersion: '1.2.3' },
  ])('rejects incomplete official release metadata %#', ({ commit, releaseVersion }) => {
    expect(() => createBuildIdentity({ commit, officialRelease: 'true', releaseVersion })).toThrow(
      /Official releases require/,
    );
  });

  it('labels local Git builds as Development without using the package version', () => {
    expect(createBuildIdentity({ commit })).toEqual({
      build: '0123456789ab',
      commit,
      version: 'Development',
    });
  });

  it('builds source archives without Git as Development', () => {
    expect(createBuildIdentity({})).toEqual({ build: 'Local build', version: 'Development' });
  });
});
