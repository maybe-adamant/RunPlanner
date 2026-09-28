import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('Windows installer release build metadata', () => {
  it('invokes the native GitHub CLI without a shell interpreting the jq pipes', () => {
    const script = readFileSync(join(repositoryRoot, 'scripts/assert-release-version.mjs'), 'utf8');
    expect(script).toContain("platform === 'win32' ? 'gh.exe' : 'gh'");
    expect(script).toContain("{ encoding: 'utf8', shell: false }");
    expect(script).toContain(
      "'.[] | select(.draft == false and .prerelease == false) | .tag_name'",
    );
  });

  it('passes one validated version and commit to Tauri and the frontend', () => {
    const workflow = readFileSync(
      join(repositoryRoot, '.github/workflows/windows-release.yml'),
      'utf8',
    );
    const tauriConfig = readFileSync(
      join(repositoryRoot, 'apps/planner/src-tauri/tauri.conf.json'),
      'utf8',
    );

    expect(workflow).toContain('$config = @{ version = $version } | ConvertTo-Json -Compress');
    expect(workflow).toContain('"release_sha=$env:GITHUB_SHA" >> $env:GITHUB_OUTPUT');
    expect(workflow).toContain(
      'RUN_PLANNER_BUILD_COMMIT: ${{ steps.release.outputs.release_sha }}',
    );
    expect(workflow).toContain("RUN_PLANNER_OFFICIAL_RELEASE: 'true'");
    expect(workflow).toContain(
      'RUN_PLANNER_RELEASE_VERSION: ${{ steps.release.outputs.release_version }}',
    );
    expect(workflow).toContain('--config "$env:TAURI_RELEASE_CONFIG"');
    expect(tauriConfig).toContain('"version": "../package.json"');
  });

  it('keeps an incomplete release private until its installer and updater assets are present', () => {
    const workflow = readFileSync(
      join(repositoryRoot, '.github/workflows/windows-release.yml'),
      'utf8',
    );

    expect(workflow).toContain('node scripts/assert-release-version.mjs $env:RELEASE_VERSION');
    expect(workflow).toContain('node scripts/assert-release-version.mjs "${RELEASE_VERSION}"');
    expect(workflow).toContain(
      'gh api "repos/$env:GITHUB_REPOSITORY/compare/main...$env:GITHUB_SHA" --jq .status',
    );
    expect(workflow).toContain('--draft');
    expect(workflow).toContain(
      'Release ${RELEASE_TAG} is already published and cannot be replaced.',
    );
    expect(workflow).toContain('"release/${RELEASE_ARTIFACT}.exe.sig"');
    expect(workflow).toContain('release/latest.json');
    expect(workflow).toContain('gh release edit "${RELEASE_TAG}" --draft=false --latest');

    const preparation = workflow.indexOf('- name: Prepare release metadata');
    const draft = workflow.indexOf('- name: Create or resume draft release');
    const manifest = workflow.indexOf('- name: Assemble updater manifest');
    const upload = workflow.indexOf('- name: Upload installer assets to draft');
    const publish = workflow.indexOf('- name: Publish complete draft release');
    expect(workflow.indexOf('GH_TOKEN: ${{ github.token }}', preparation)).toBeGreaterThan(
      preparation,
    );
    expect(workflow.indexOf('assert-release-version.mjs', preparation)).toBeGreaterThan(
      preparation,
    );
    expect(draft).toBeGreaterThan(preparation);
    expect(manifest).toBeGreaterThan(draft);
    expect(upload).toBeGreaterThan(manifest);
    expect(publish).toBeGreaterThan(upload);
    expect(workflow.indexOf('assert-release-version.mjs', publish)).toBeGreaterThan(publish);
    expect(
      workflow.indexOf('gh release edit "${RELEASE_TAG}" --draft=false --latest', publish),
    ).toBeGreaterThan(workflow.indexOf('Draft release ${RELEASE_TAG} is missing', publish));
  });

  it('refuses to build before the updater key is configured and keeps the key out of the build', () => {
    const workflow = readFileSync(
      join(repositoryRoot, '.github/workflows/windows-release.yml'),
      'utf8',
    );
    const step = (name: string) => {
      const start = workflow.indexOf(`- name: ${name}`);
      expect(start).toBeGreaterThan(0);
      const end = workflow.indexOf('- name: ', start + 1);
      return { start, text: workflow.slice(start, end === -1 ? undefined : end) };
    };
    const preparation = step('Prepare release metadata');
    const guard = step('Require updater signing configuration');
    const build = step('Build installer');
    const stage = step('Stage installer');
    const sign = step('Sign installer for the updater');
    const launch = step('Install and smoke-test desktop launch');
    expect(guard.start).toBeGreaterThan(preparation.start);
    expect(build.start).toBeGreaterThan(guard.start);
    expect(stage.start).toBeGreaterThan(build.start);
    expect(sign.start).toBeGreaterThan(stage.start);
    expect(launch.start).toBeGreaterThan(sign.start);

    expect(guard.text).toContain('updater-release.mjs assert-pubkey');
    expect(guard.text).toContain(
      "SIGNING_KEY_PRESENT: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY != '' }}",
    );
    expect(guard.text).not.toContain('TAURI_SIGNING_PRIVATE_KEY:');
    expect(build.text).toContain('tauri build --bundles nsis --no-sign');
    expect(build.text).not.toContain('TAURI_SIGNING_PRIVATE_KEY');
    expect(sign.text).toContain(
      'TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}',
    );
    expect(sign.text).toContain(
      'TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}',
    );
    expect(sign.text).toContain('node node_modules/@tauri-apps/cli/tauri.js signer sign');
    expect(workflow.match(/secrets\.TAURI_SIGNING_PRIVATE_KEY }}/g)).toHaveLength(1);
    expect(workflow.match(/secrets\.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}/g)).toHaveLength(1);
    expect(workflow).not.toContain('Swatinem/rust-cache');
    expect(workflow).not.toContain('--no-bundle');
  });

  it('builds, signs and launch-tests a dry run without tagging, drafting or publishing', () => {
    const workflow = readFileSync(
      join(repositoryRoot, '.github/workflows/windows-release.yml'),
      'utf8',
    );
    expect(workflow).toMatch(
      /dry_run:\n\s+description: .*\n\s+required: false\n\s+default: false\n\s+type: boolean/,
    );
    const release = workflow.indexOf('\n  release:\n');
    expect(release).toBeGreaterThan(0);
    expect(workflow.slice(release, workflow.indexOf('steps:', release))).toContain(
      'if: ${{ !inputs.dry_run }}',
    );
    const build = workflow.slice(0, release);
    expect(build).not.toContain('gh release');
    expect(build).not.toContain('git/refs');
    expect(build).not.toContain('dry_run }}');
  });
});
