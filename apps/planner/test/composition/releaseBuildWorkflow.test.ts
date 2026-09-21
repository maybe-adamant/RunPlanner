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
});
