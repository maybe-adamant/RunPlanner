// Single owner of the stable-release version policy: an official release must
// be a stable SemVer value strictly newer than every published stable release.
// Both release-workflow jobs call this against the live release list, so the
// build fails early and the publish step still re-checks after the build.
import { spawnSync } from 'node:child_process';
import { exit, argv, env, platform, stderr, stdout } from 'node:process';

const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function fail(message) {
  stderr.write(`${message}\n`);
  exit(1);
}

const candidate = argv[2];
const repository = env.GITHUB_REPOSITORY;
if (candidate === undefined || !STABLE_SEMVER.test(candidate))
  fail(`Release version must be a stable SemVer value such as 0.1.0 (received ${candidate}).`);
if (repository === undefined || repository === '')
  fail('GITHUB_REPOSITORY must identify the repository whose releases gate this version.');

const listed = spawnSync(
  'gh',
  [
    'api',
    '--paginate',
    `repos/${repository}/releases?per_page=100`,
    '--jq',
    '.[] | select(.draft == false and .prerelease == false) | .tag_name',
  ],
  { encoding: 'utf8', shell: platform === 'win32' },
);
if (listed.error !== undefined || listed.status !== 0)
  fail(`Unable to inspect published stable releases: ${listed.error?.message ?? listed.stderr}`);

const parse = (version) => version.split('.').map(Number);
const candidateParts = parse(candidate);
for (const tag of listed.stdout.split('\n')) {
  const published = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(tag.trim())?.[1];
  if (published === undefined) continue;
  const publishedParts = parse(published);
  const newer = candidateParts.some(
    (part, index) =>
      part !== publishedParts[index] &&
      candidateParts.slice(0, index).every((prior, earlier) => prior === publishedParts[earlier]) &&
      part > publishedParts[index],
  );
  if (!newer)
    fail(`Release version ${candidate} must be newer than published stable release v${published}.`);
}
stdout.write(`Release version ${candidate} is newer than every published stable release.\n`);
