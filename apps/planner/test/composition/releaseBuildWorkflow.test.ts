import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('Windows portable release build metadata', () => {
  it('passes one validated version and commit to Tauri and the frontend', () => {
    const workflow = readFileSync(
      join(repositoryRoot, '.github/workflows/windows-portable.yml'),
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

  it('keeps an incomplete release private until its portable assets are present', () => {
    const workflow = readFileSync(
      join(repositoryRoot, '.github/workflows/windows-portable.yml'),
      'utf8',
    );

    expect(workflow).toContain(
      'gh api --paginate "repos/$env:GITHUB_REPOSITORY/releases?per_page=100"',
    );
    expect(workflow).toContain('--draft');
    expect(workflow).toContain(
      'Release ${RELEASE_TAG} is already published and cannot be replaced.',
    );
    expect(workflow).toContain('"release/${RELEASE_ARTIFACT}.zip.sha256"');
    expect(workflow).toContain('gh release edit "${RELEASE_TAG}" --draft=false --latest');

    const preparation = workflow.indexOf('- name: Prepare release metadata');
    const draft = workflow.indexOf('- name: Create or resume draft release');
    const upload = workflow.indexOf('- name: Upload portable assets to draft');
    const publish = workflow.indexOf('- name: Publish complete draft release');
    expect(workflow.indexOf('GH_TOKEN: ${{ github.token }}', preparation)).toBeGreaterThan(
      preparation,
    );
    expect(workflow.indexOf('Compare-StableVersion', preparation)).toBeGreaterThan(preparation);
    expect(draft).toBeGreaterThan(preparation);
    expect(upload).toBeGreaterThan(draft);
    expect(publish).toBeGreaterThan(upload);
    expect(workflow.indexOf('require_newer_than_published', publish)).toBeGreaterThan(publish);
    expect(
      workflow.indexOf('gh release edit "${RELEASE_TAG}" --draft=false --latest', publish),
    ).toBeGreaterThan(workflow.indexOf('Draft release ${RELEASE_TAG} is missing', publish));
  });

  it('packages the executable with the release version in its filename', () => {
    const workflow = readFileSync(
      join(repositoryRoot, '.github/workflows/windows-portable.yml'),
      'utf8',
    );
    expect(workflow).toContain(
      'Copy-Item "apps/planner/src-tauri/target/release/run-planner.exe" (Join-Path $staging "RunPlanner-$env:RELEASE_VERSION.exe")',
    );
    expect(workflow).not.toContain('(Join-Path $staging "RunPlanner.exe")');
  });
});
