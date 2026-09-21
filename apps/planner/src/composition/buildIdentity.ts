export interface BuildIdentity {
  readonly build: string;
  readonly commit?: string;
  readonly version: string;
}

export interface BuildIdentityInput {
  readonly commit?: string | undefined;
  readonly officialRelease?: string | undefined;
  readonly releaseVersion?: string | undefined;
}

const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const COMMIT_HASH = /^[0-9a-f]{40}$/;

export function createBuildIdentity(input: BuildIdentityInput): BuildIdentity {
  if (input.officialRelease !== undefined && input.officialRelease !== 'true') {
    throw new Error('RUN_PLANNER_OFFICIAL_RELEASE must be "true" when it is set.');
  }

  if (input.officialRelease !== 'true') {
    const commit = isCommitHash(input.commit) ? input.commit : undefined;
    return Object.freeze({
      ...(commit === undefined ? {} : { commit }),
      build: commit === undefined ? 'Local build' : shortBuild(commit),
      version: 'Development',
    });
  }

  if (!isStableSemVer(input.releaseVersion)) {
    throw new Error('Official releases require a stable RUN_PLANNER_RELEASE_VERSION.');
  }
  if (!isCommitHash(input.commit)) {
    throw new Error('Official releases require a full lowercase RUN_PLANNER_BUILD_COMMIT hash.');
  }

  return Object.freeze({
    build: shortBuild(input.commit),
    commit: input.commit,
    version: input.releaseVersion,
  });
}

export function createDevelopmentBuildIdentity(): BuildIdentity {
  return createBuildIdentity({});
}

function isStableSemVer(version: string | undefined): version is string {
  return version !== undefined && STABLE_SEMVER.test(version);
}

function isCommitHash(commit: string | undefined): commit is string {
  return commit !== undefined && COMMIT_HASH.test(commit);
}

function shortBuild(commit: string): string {
  return commit.slice(0, 12);
}
